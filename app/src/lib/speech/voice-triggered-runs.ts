const STORAGE_KEY = "synaro.voiceTriggeredRuns";

function readSet(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
}

export function markVoiceTriggeredRun(runId: string) {
  const ids = readSet();
  ids.add(runId);
  writeSet(ids);
}

export function isVoiceTriggeredRun(runId: string): boolean {
  return readSet().has(runId);
}

/** Returns true once per run id, then removes the marker. */
export function consumeVoiceTriggeredRun(runId: string): boolean {
  const ids = readSet();
  if (!ids.has(runId)) return false;
  ids.delete(runId);
  writeSet(ids);
  return true;
}
