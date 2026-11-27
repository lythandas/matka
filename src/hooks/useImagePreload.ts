// src/hooks/useImagePreload.ts
import * as React from "react";

import { enqueueImagePreload } from "@/utils/imagePreloader";

/**
 * Background-preload `urls` (full-resolution images) once `enabled` is true,
 * scheduled at idle time so the initial render and the thumbnail fetches get
 * the network first. Idempotent: the preloader deduplicates, so re-enabling
 * or overlapping callers cost nothing. Meant to be called with the same
 * viewport gate the card uses for its own thumbnails (`enabled` = the card
 * is near the viewport), which is what keeps a fast scroll from queueing the
 * whole wall.
 */
export function useImagePreload(urls: string[], enabled: boolean): void {
  // JSON encoding for a stable effect key, like useMediaRatios: a parent
  // re-render with the same URLs must not re-schedule (the preloader would
  // deduplicate anyway, but the idle callback churn is pointless).
  const urlsKey = JSON.stringify(urls);

  React.useEffect(() => {
    if (!enabled || urls.length === 0) return;
    const list = [...new Set(urls)].filter((url) => url !== "");
    if (list.length === 0) return;
    let cancelled = false;
    const start = () => {
      if (!cancelled) enqueueImagePreload(list);
    };
    if (typeof window.requestIdleCallback === "function") {
      // timeout: even on a permanently busy main thread, the preload starts
      // within 2 s — "eventually in background" beats "never".
      const id = window.requestIdleCallback(start, { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    // Safari has no requestIdleCallback: a short timeout is the pragmatic
    // equivalent (after first paint, off the critical path).
    const id = window.setTimeout(start, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // Keyed on the encoded URLs, never on the array identity — same
    // rationale as useMediaRatios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, enabled]);
}
