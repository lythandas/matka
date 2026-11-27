import * as React from "react";

import { FRAME_RATIO } from "@/utils/mediaLayout";

/**
 * Measured aspect ratios (width / height) per media URL, shared across every
 * post card: two cards showing the same photo measure it once. Failed or
 * zero-size measurements are cached as FRAME_RATIO so a broken URL never
 * retries.
 */
const ratioCache = new Map<string, number>();

/** Callbacks waiting for a URL whose measurement is still in flight. */
const waiters = new Map<string, Set<(ratio: number) => void>>();

/** In-flight measurement images, so the last waiter can abort one. */
const inflight = new Map<string, HTMLImageElement>();

/**
 * 1x1 transparent pixel. Aborting an in-flight image by pointing its `src`
 * at "" would resolve against the document URL and fire one wasted request,
 * so an aborted measurement is pointed here instead.
 */
const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Stable empty result: an empty media list never re-tiles anything. */
const NO_RATIOS: number[] = [];

/** Load `url` in a detached <img> and publish its ratio to all waiters. */
function measure(url: string): void {
  const image = new Image();
  inflight.set(url, image);
  const finish = (ratio: number) => {
    inflight.delete(url);
    ratioCache.set(url, ratio);
    const pending = waiters.get(url);
    waiters.delete(url);
    pending?.forEach((notify) => notify(ratio));
  };
  image.onload = () => {
    const { naturalWidth, naturalHeight } = image;
    finish(
      naturalWidth > 0 && naturalHeight > 0
        ? naturalWidth / naturalHeight
        : FRAME_RATIO,
    );
  };
  image.onerror = () => finish(FRAME_RATIO);
  image.src = url;
}

/**
 * Drop a pending measurement: handlers are nulled so the load/error never
 * fires, and `src` is pointed at a blank pixel (not "") so no document-URL
 * request is issued. A later subscriber for the same URL starts cleanly:
 * no stale waiter set, no image that can never settle.
 */
function abortInflight(url: string): void {
  const image = inflight.get(url);
  if (!image) return;
  inflight.delete(url);
  image.onload = null;
  image.onerror = null;
  image.src = BLANK_PIXEL;
}

/**
 * Subscribe to the ratio of `url`: cached → notified at once, otherwise when
 * the in-flight (or newly started) measurement lands. Returns an unsubscriber
 * so an unmounted card is never notified; when the last waiter for a URL
 * unsubscribes, its pending measurement is aborted, so a fast scroll stops
 * paying for photos it no longer shows.
 */
function requestRatio(
  url: string,
  notify: (ratio: number) => void,
): () => void {
  const cached = ratioCache.get(url);
  if (cached !== undefined) {
    notify(cached);
    return () => {};
  }
  let pending = waiters.get(url);
  if (!pending) {
    pending = new Set();
    waiters.set(url, pending);
    measure(url);
  }
  pending.add(notify);
  return () => {
    if (!pending?.delete(notify)) return;
    // Only the live waiter set may abort: a stale unsubscriber (e.g. a
    // StrictMode double-mount) must not kill a measurement restarted
    // after it.
    if (pending.size === 0 && waiters.get(url) === pending) {
      waiters.delete(url);
      abortInflight(url);
    }
  };
}

/**
 * Aspect ratio (width / height) of each media URL, index-aligned with `urls`:
 * `ratios[i]` is photo i's real ratio once measured, FRAME_RATIO until then.
 * The frame re-tiles as ratios land; nothing waits on a ready flag.
 *
 * `enabled` gates the network: until it is true the hook subscribes to
 * nothing, so off-screen cards issue zero requests. Empty URLs are never
 * requested (they render the placeholder, whose ratio nobody needs) and so
 * never enter the shared cache.
 */
export function useMediaRatios(
  urls: string[],
  enabled: boolean = true,
): number[] {
  const [measured, setMeasured] = React.useState(0);
  // JSON encoding: unambiguous per URL (no separator a URL could contain),
  // and the memo below derives its output from `urls` itself, so the
  // index-aligned invariant is visible rather than implied by a split.
  const urlsKey = JSON.stringify(urls);

  // Keyed on the encoded URLs (not the array identity) so a parent re-render
  // with the same photos keeps the same array reference, and blocks never
  // shuffle while loading. `measured` bumps whenever a ratio lands, so the
  // memo re-runs and the returned array picks up the cached value.
  const ratios = React.useMemo(
    () =>
      urls.length === 0
        ? NO_RATIOS
        : urls.map((url) => ratioCache.get(url) ?? FRAME_RATIO),
    // `measured` looks unused here but is the signal that the shared
    // ratioCache gained an entry — removing it freezes the array at
    // FRAME_RATIO forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [urlsKey, urls.length, measured],
  );

  React.useEffect(() => {
    if (!enabled || urls.length === 0) return;
    const unsubscribe = [...new Set(urls)]
      .filter((url) => url !== "")
      .map((url) =>
        requestRatio(url, (ratio) => {
          // Re-render only when the layout would actually change: unmeasured
          // photos already render as FRAME_RATIO.
          if (ratio !== FRAME_RATIO) setMeasured((count) => count + 1);
        }),
      );
    return () => {
      unsubscribe.forEach((off) => off());
    };
  }, [urls, enabled]);

  return ratios;
}
