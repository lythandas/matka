// src/utils/imagePreloader.ts

/**
 * Module-level background preloader for full-resolution images: PostDetailDialog
 * shows `urls.large`, and a preloaded image sits in the browser HTTP cache, so
 * opening a card in full screen is instant instead of a fresh multi-MB fetch.
 *
 * Budget guards (the goal is "instant when clicked", not "download the whole
 * journey"):
 *   - only URLs that were explicitly enqueued are fetched (callers gate on
 *     viewport proximity, see useImagePreload);
 *   - at most MAX_CONCURRENT downloads at a time, at low network priority
 *     (fetchPriority) so they never compete with thumbnails still loading;
 *   - once started a download is not aborted — cancelling an <img> mid-flight
 *     does not free the bytes already sent, and the image is wanted anyway;
 *     the concurrency cap plus viewport gating is what keeps a fast scroll
 *     from saturating the connection.
 *   - every URL is fetched at most once per page load (dedup on enqueue and
 *     on completion), and completion is remembered across cards.
 */

const settled = new Set<string>();
const enqueued = new Set<string>();
const queue: string[] = [];
let active = 0;
const MAX_CONCURRENT = 2;

function pump(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const url = queue.shift()!;
    enqueued.delete(url);
    active += 1;
    const image = new Image();
    const done = () => {
      active -= 1;
      settled.add(url);
      pump();
    };
    image.onload = done;
    image.onerror = done;
    // Hint that these downloads may yield to anything the user actually
    // waits for. Optional: older Safari simply ignores the property.
    (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
      "low";
    image.src = url;
  }
}

/** Queue full-resolution images for background download (deduplicated). */
export function enqueueImagePreload(urls: string[]): void {
  for (const url of urls) {
    if (!url || settled.has(url) || enqueued.has(url)) continue;
    enqueued.add(url);
    queue.push(url);
  }
  pump();
}
