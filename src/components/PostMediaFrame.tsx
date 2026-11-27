import * as React from "react";

import { MediaInfo } from "@/types";
import { useMediaRatios } from "@/hooks/useMediaRatios";
import { useImagePreload } from "@/hooks/useImagePreload";
import { thumbnailUrl } from "@/utils/mediaUrls";
import { cn } from "@/lib/utils";
import {
  DEFAULT_GAP,
  FRAME_RATIO,
  MAX_MEDIA_BLOCKS,
  computeJustifiedBlocks,
  frameHeight,
  visibleMediaCount,
} from "@/utils/mediaLayout";

/** Class of the single fixed 4:3 media frame (reused by Task 4's map branch). */
export const MEDIA_FRAME_CLASS =
  "relative w-full overflow-hidden rounded-md bg-black";

/** Inline style pinning the frame to the 4:3 ratio (reused by Task 4). */
export const MEDIA_FRAME_STYLE: React.CSSProperties = {
  aspectRatio: String(FRAME_RATIO),
};

/** Rendered for an image with no URL at all (never measured). */
const PLACEHOLDER_SRC = "/placeholder.svg";

export interface PostMediaFrameProps {
  media: MediaInfo[];
  /** Alt text for the tiled photos (ListPostCard passes the post title). */
  alt?: string;
  className?: string;
}

type ImageInfo = Extract<MediaInfo, { type: "image" }>;
type VideoInfo = Extract<MediaInfo, { type: "video" }>;

/**
 * Display URL of an image media item, in ListPostCard's preference order —
 * downscaled to the backend's thumbnail variant when the URL maps to one
 * (same aspect ratio, a fraction of the bytes), "" when the item has no URL
 * at all.
 */
function imageUrl(image: ImageInfo): string {
  return thumbnailUrl(image.urls.medium ?? image.urls.original) ?? "";
}

/**
 * Full-resolution URL of an image media item, in PostDetailDialog's
 * preference order — what a click on the card will show, and therefore what
 * the background preloader should warm the browser cache with.
 */
function fullSizeUrl(image: ImageInfo): string {
  return image.urls.large ?? image.urls.original ?? image.urls.medium ?? "";
}

/** Src of a rendered block: a URL-less image shows the placeholder directly. */
function imageSrc(image: ImageInfo): string {
  return imageUrl(image) || PLACEHOLDER_SRC;
}

/**
 * onError of a block <img>: a failed thumbnail (backend not upgraded,
 * generation failed) retries the original full-size URL rather than dropping
 * the photo; only a second failure shows the placeholder. The attribute is
 * read back because `element.src` would return an absolute URL.
 */
function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  image: ImageInfo,
): void {
  const element = event.currentTarget;
  if (element.getAttribute("src")?.startsWith("/thumbs/")) {
    element.onerror = () => {
      element.onerror = null;
      element.src = PLACEHOLDER_SRC;
    };
    element.src = image.urls.medium ?? image.urls.original ?? PLACEHOLDER_SRC;
    return;
  }
  element.onerror = null;
  element.src = PLACEHOLDER_SRC;
}

/**
 * One fixed 4:3 frame per post card, tiling the post's photos as a justified
 * block chart (block geometry from computeJustifiedBlocks, in px). Re-tiles
 * as the measured aspect ratios land and as the frame is resized; a post
 * with no photo at all plays its video in the frame instead. Ratio requests
 * are issued only for photos that can be rendered, and only once the frame
 * is near the viewport.
 */
const PostMediaFrame: React.FC<PostMediaFrameProps> = ({
  media,
  alt = "",
  className,
}) => {
  const images = React.useMemo(
    () =>
      media.filter(
        (item): item is ImageInfo => item.type === "image",
      ),
    [media],
  );
  const video = media.find(
    (item): item is VideoInfo => item.type === "video",
  );

  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  // Only URLs that can be rendered are measured, under the same cap the
  // render path uses: once the frame width is known, visibleMediaCount gives
  // the real block count (4 below 480 px), so a mobile card never keeps
  // fetching photos it cannot show. Before the first ResizeObserver callback
  // the cap falls back to MAX_MEDIA_BLOCKS — measurement is viewport-gated
  // and the observer reports an initial size before the frame can come into
  // view, so the fallback list is rarely requested. The slice is always a
  // prefix of `images`, so block↔ratio index alignment cannot shift, and
  // shrinking it releases the dropped URLs' waiters (aborting their in-flight
  // measurements). A 20-photo post on a phone measures 4 photos, not 20.
  const cappedImages = React.useMemo(() => {
    const cap =
      width > 0 ? visibleMediaCount(width, images.length) : MAX_MEDIA_BLOCKS;
    return images.slice(0, cap);
  }, [images, width]);
  const measuredUrls = React.useMemo(
    () => cappedImages.map(imageUrl),
    [cappedImages],
  );

  // Same slice, full-resolution URLs: what PostDetailDialog will show when
  // the card is clicked. Measuring ratios on the thumbnails is correct (the
  // backend only shrinks, never crops, so the ratio is identical).
  const preloadUrls = React.useMemo(
    () => cappedImages.map(fullSizeUrl),
    [cappedImages],
  );

  // Measurement is viewport-gated: until the frame comes within a few
  // hundred pixels of the viewport, zero ratio requests are issued (the
  // rendered <img loading="lazy"> handles its own gating). Once seen, a
  // card keeps its ratios — there is no un-see on scroll-up.
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const element = frameRef.current;
    if (!element || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView]);

  // Index-aligned with `images` ("" entries included): the hook never
  // requests an empty URL — the placeholder's ratio is nobody's business,
  // and "" would poison a shared cache key — so such entries simply stay at
  // the FRAME_RATIO fallback.
  const ratios = useMediaRatios(measuredUrls, inView);

  // Full-resolution preload for the detail dialog, gated on the same
  // in-view signal as the thumbnails and scheduled at idle: the visible
  // photos of a card the user has actually scrolled to are what a click will
  // open, and the preloader's concurrency cap keeps this off the critical
  // path. Photos beyond the block cap stay unloaded — the dialog fetches
  // them on demand (accepted trade: they are behind a "+N" veil anyway).
  useImagePreload(preloadUrls, inView);

  React.useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    // Browsers without ResizeObserver still get a one-shot whole-pixel
    // width instead of a blank wall.
    if (typeof ResizeObserver === "undefined") {
      const px = Math.floor(element.clientWidth);
      setWidth((previous) => (px !== previous ? px : previous));
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const px = Math.floor(entries[entries.length - 1].contentRect.width);
      // Only whole-pixel changes update the state, so a settling layout
      // with fractional width jitter cannot re-render in a loop.
      setWidth((previous) => (px !== previous ? px : previous));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Nothing to show at all: no frame, and never a layout call.
  if (images.length === 0 && !video) return null;

  // A video plays in the frame only when the post has no photo at all —
  // with any photo present, the photo chart wins (today's list behaviour).
  const showVideo = Boolean(video) && images.length === 0;

  const visible = visibleMediaCount(width, images.length);
  const hidden = images.length - visible;

  // First paint (width === 0): frame with no blocks, never NaN geometry.
  // Never called with an empty ratios array (visible >= 1 whenever reached).
  const blocks =
    showVideo || width === 0 || visible === 0
      ? null
      : computeJustifiedBlocks(
          ratios.slice(0, visible),
          width,
          frameHeight(width),
          DEFAULT_GAP,
        );

  return (
    <div
      ref={frameRef}
      className={cn(MEDIA_FRAME_CLASS, className)}
      style={MEDIA_FRAME_STYLE}
    >
      {showVideo && video ? (
        // object-contain: a 9:16 phone video stays whole on the black
        // frame instead of being cropped to ~42% of its height, with the
        // native controls sitting over visible content.
        <video
          src={video.url}
          controls
          className="h-full w-full object-contain"
        />
      ) : (
        blocks?.map((block, index) => {
          const isLast = index === blocks.length - 1;
          return (
            <div
              key={index}
              className="absolute overflow-hidden"
              style={{
                left: block.x,
                top: block.y,
                width: block.w,
                height: block.h,
              }}
            >
              <img
                src={imageSrc(images[index])}
                // The post title is announced once per frame: the other
                // blocks are decorative to a screen reader.
                alt={index === 0 ? alt : ""}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(event) => handleImageError(event, images[index])}
              />
              {isLast && hidden > 0 && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-sm font-bold text-white">
                  +{hidden}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default PostMediaFrame;
