"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";

import type { SearchIndex } from "@/lib/search/search-index";
import { normalizeSearchIndex } from "@/lib/search/normalize-search-index";

const CACHE_TTL_MS = 10 * 60 * 1000;

type SearchIndexStatus = "idle" | "loading" | "ready" | "error";

type CacheSnapshot = {
  data: SearchIndex | null;
  fetchedAt: number;
  status: SearchIndexStatus;
  error: string | null;
};

let cache: CacheSnapshot = {
  data: null,
  fetchedAt: 0,
  status: "idle",
  error: null,
};

let inflight: Promise<SearchIndex> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): CacheSnapshot {
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isFresh(fetchedAt: number): boolean {
  return fetchedAt > 0 && Date.now() - fetchedAt < CACHE_TTL_MS;
}

async function fetchSearchIndex(): Promise<SearchIndex> {
  const res = await fetch("/api/account/search-index");
  if (!res.ok) {
    throw new Error(`Search index request failed (${res.status})`);
  }
  return (await res.json()) as unknown as SearchIndex;
}

function parseSearchIndexPayload(raw: unknown): SearchIndex {
  return normalizeSearchIndex(raw);
}

export function invalidateSearchIndex(): void {
  inflight = null;
  cache = {
    data: null,
    fetchedAt: 0,
    status: "idle",
    error: null,
  };
  emit();
}

export function prefetchSearchIndex(): Promise<SearchIndex | null> {
  if (isFresh(cache.fetchedAt) && cache.data) {
    return Promise.resolve(cache.data);
  }

  if (inflight) {
    return inflight.catch(() => null);
  }

  cache = { ...cache, status: "loading", error: null };
  emit();

  inflight = fetchSearchIndex()
    .then((data) => {
      const normalized = parseSearchIndexPayload(data);
      cache = {
        data: normalized,
        fetchedAt: Date.now(),
        status: "ready",
        error: null,
      };
      inflight = null;
      emit();
      return normalized;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to load search index";
      cache = {
        ...cache,
        status: "error",
        error: message,
      };
      inflight = null;
      emit();
      throw err;
    });

  return inflight.catch(() => null);
}

export function useSearchIndex() {
  const { status: sessionStatus } = useSession();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const prefetch = useCallback(() => {
    if (sessionStatus !== "authenticated") return;
    void prefetchSearchIndex();
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (isFresh(cache.fetchedAt) && cache.data) return;
    void prefetchSearchIndex();
  }, [sessionStatus]);

  return {
    data: snapshot.data,
    status: snapshot.status,
    error: snapshot.error,
    prefetch,
    invalidate: invalidateSearchIndex,
  };
}
