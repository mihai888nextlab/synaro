"use client";

import * as React from "react";

export type AppNotificationType =
  | "ai_task_done"
  | "ai_task_failed"
  | "agent_run_done"
  | "agent_run_failed"
  | "info";

export type AppNotification = {
  id: string;
  createdAtMs: number;
  title: string;
  description?: string;
  type: AppNotificationType;
  href?: string;
  unread: boolean;
  meta?: Record<string, unknown>;
};

type Ctx = {
  notifications: AppNotification[];
  unreadCount: number;
  push: (n: Omit<AppNotification, "id" | "createdAtMs" | "unread"> & { unread?: boolean }) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
};

const STORAGE_KEY = "synaro:notifications:v1";
const MAX_NOTIFICATIONS = 50;

const NotificationsContext = React.createContext<Ctx | null>(null);

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadStored(): AppNotification[] {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<AppNotification[]>(localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((n) => typeof n?.id === "string" && typeof n?.title === "string");
}

function store(list: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // ignore
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);

  React.useEffect(() => {
    setNotifications(loadStored());
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    store(notifications);
  }, [notifications]);

  const push = React.useCallback(
    (n: Omit<AppNotification, "id" | "createdAtMs" | "unread"> & { unread?: boolean }) => {
      const id = `n-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const createdAtMs = Date.now();
      const unread = n.unread ?? true;
      setNotifications((prev) => [
        { id, createdAtMs, unread, ...n },
        ...prev,
      ].slice(0, MAX_NOTIFICATIONS));
    },
    [],
  );

  const markAllRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const markRead = React.useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  }, []);

  const clearAll = React.useCallback(() => setNotifications([]), []);

  const unreadCount = React.useMemo(
    () => notifications.reduce((acc, n) => acc + (n.unread ? 1 : 0), 0),
    [notifications],
  );

  const value: Ctx = React.useMemo(
    () => ({ notifications, unreadCount, push, markAllRead, markRead, clearAll }),
    [notifications, unreadCount, push, markAllRead, markRead, clearAll],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = React.useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

export function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!canUseBrowserNotifications()) return "denied";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (!canUseBrowserNotifications()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, options);
  } catch {
    // ignore
  }
}

let notificationAudioContext: AudioContext | null = null;

type ChimeNote = {
  frequency: number;
  at: number;
  duration: number;
  peak: number;
};

/** Soft ascending completion chime (~650ms), similar to SaaS success alerts. */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const ctx = notificationAudioContext ?? new AudioContext();
    notificationAudioContext = ctx;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const start = ctx.currentTime + 0.01;
    const notes: ChimeNote[] = [
      { frequency: 523.25, at: 0, duration: 0.2, peak: 0.055 },
      { frequency: 659.25, at: 0.13, duration: 0.24, peak: 0.065 },
      { frequency: 783.99, at: 0.28, duration: 0.42, peak: 0.05 },
    ];

    const master = ctx.createGain();
    master.gain.setValueAtTime(1, start);
    master.connect(ctx.destination);

    for (const note of notes) {
      const t0 = start + note.at;
      const osc = ctx.createOscillator();
      const tone = ctx.createGain();
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.frequency, t0);

      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(note.frequency * 2, t0);

      tone.gain.setValueAtTime(0.0001, t0);
      tone.gain.exponentialRampToValueAtTime(note.peak, t0 + 0.028);
      tone.gain.exponentialRampToValueAtTime(0.0001, t0 + note.duration);

      shimmerGain.gain.setValueAtTime(0.0001, t0);
      shimmerGain.gain.exponentialRampToValueAtTime(note.peak * 0.18, t0 + 0.02);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.duration * 0.85);

      osc.connect(tone);
      shimmer.connect(shimmerGain);
      tone.connect(master);
      shimmerGain.connect(master);

      osc.start(t0);
      shimmer.start(t0);
      osc.stop(t0 + note.duration + 0.06);
      shimmer.stop(t0 + note.duration + 0.06);
    }
  } catch {
    // ignore — autoplay policies or missing Web Audio
  }
}

