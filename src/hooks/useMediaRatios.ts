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

/** Stable empty result: an empty media list never re-tiles anything. */
const NO_RATIOS: number[] = [];

/** Join for the cache-map key; a URL cannot contain a raw newline. */
const URL_SEPARATOR = "\n";

/** Load `url` in a detached <img> and publish its ratio to all waiters. */
function measure(url: string): void {
  const image = new Image();
  const finish = (ratio: number) => {
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
 * Subscribe to the ratio of `url`: cached → notified at once, otherwise when
 * the in-flight (or newly started) measurement lands. Returns an unsubscriber
 * so an unmounted card is never notified.
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
    pending?.delete(notify);
  };
}

/**
 * Aspect ratio (width / height) of each media URL, index-aligned with `urls`:
 * `ratios[i]` is photo i's real ratio once measured, FRAME_RATIO until then.
 * The frame re-tiles as ratios land; nothing waits on a ready flag.
 */
export function useMediaRatios(urls: string[]): number[] {
  const [, setMeasured] = React.useState(0);
  const urlsKey = urls.join(URL_SEPARATOR);

  // Keyed on the joined URLs (not the array identity) so a parent re-render
  // with the same photos keeps the same array reference, and blocks never
  // shuffle while loading.
  const ratios = React.useMemo(
    () =>
      urls.length === 0
        ? NO_RATIOS
        : urlsKey
            .split(URL_SEPARATOR)
            .map((url) => ratioCache.get(url) ?? FRAME_RATIO),
    [urlsKey, urls.length],
  );

  React.useEffect(() => {
    if (urlsKey === "") return;
    const unsubscribe = [...new Set(urlsKey.split(URL_SEPARATOR))].map(
      (url) =>
        requestRatio(url, (ratio) => {
          // Re-render only when the layout would actually change: unmeasured
          // photos already render as FRAME_RATIO.
          if (ratio !== FRAME_RATIO) setMeasured((count) => count + 1);
        }),
    );
    return () => {
      unsubscribe.forEach((off) => off());
    };
  }, [urlsKey]);

  return ratios;
}
