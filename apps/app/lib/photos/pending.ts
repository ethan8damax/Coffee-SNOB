import { PHOTO_LIMITS } from "@coffeesnob/supabase";
import { PhotoRefused } from "./upload";

// Photos waiting to upload, one per log. The log is already saved; this keeps
// trying the upload so a bad connection doesn't lose the photo.
// ponytail: in memory only, so closing the app drops a queued photo; persist the
// queue (AsyncStorage) if that turns out to matter.
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];
const THEN_EVERY_MS = 600_000;

const pending = new Set<string>();
// The picked image, so your own entry shows it before (and right after) upload.
const previews = new Map<string, string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const isPending = (logId: string) => pending.has(logId);
export const previewFor = (logId: string) => previews.get(logId) ?? null;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function enqueuePhoto(logId: string, run: () => Promise<void>, previewUri?: string) {
  if (pending.has(logId)) return;
  pending.add(logId);
  if (previewUri) previews.set(logId, previewUri);
  notify();
  const start = Date.now();
  let tries = 0;
  const finish = () => {
    pending.delete(logId);
    notify();
  };
  const attempt = async () => {
    try {
      await run();
      finish();
    } catch (e) {
      if (e instanceof PhotoRefused || Date.now() - start >= PHOTO_LIMITS.retryHours * 3600_000) {
        previews.delete(logId);
        return finish();
      }
      setTimeout(attempt, RETRY_DELAYS_MS[tries++] ?? THEN_EVERY_MS);
    }
  };
  void attempt();
}

// Tests only.
export function _resetPending() {
  pending.clear();
  previews.clear();
  listeners.clear();
}
