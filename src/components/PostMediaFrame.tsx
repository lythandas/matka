import * as React from "react";

import { MediaInfo } from "@/types";
import { useMediaRatios } from "@/hooks/useMediaRatios";
import {
  DEFAULT_GAP,
  FRAME_RATIO,
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

export interface PostMediaFrameProps {
  media: MediaInfo[];
  className?: string;
}

type ImageInfo = Extract<MediaInfo, { type: "image" }>;
type VideoInfo = Extract<MediaInfo, { type: "video" }>;

/** Display URL of an image media item, in ListPostCard's preference order. */
function imageUrl(image: ImageInfo): string {
  return image.urls.medium ?? image.urls.original ?? "";
}

/**
 * One fixed 4:3 frame per post card, tiling the post's photos as a justified
 * block chart (block geometry from computeJustifiedBlocks, in px). Re-tiles
 * as the measured aspect ratios land and as the frame is resized; a lone
 * video fills the frame instead of the chart.
 */
const PostMediaFrame: React.FC<PostMediaFrameProps> = ({ media, className }) => {
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

  const ratios = useMediaRatios(
    React.useMemo(() => images.map(imageUrl), [images]),
  );

  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const px = Math.floor(entries[entries.length - 1].contentRect.width);
      // Only whole-pixel changes update the state, so a settling layout
      // with fractional width jitters cannot re-render in a loop.
      setWidth((previous) => (px !== previous ? px : previous));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Nothing to show at all: no frame, and never a layout call.
  if (images.length === 0 && !video) return null;

  // A video takes over the whole frame when there is at most one photo.
  const showVideo = Boolean(video) && images.length <= 1;

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
      className={
        className ? `${MEDIA_FRAME_CLASS} ${className}` : MEDIA_FRAME_CLASS
      }
      style={MEDIA_FRAME_STYLE}
    >
      {showVideo && video ? (
        <video
          src={video.url}
          muted
          playsInline
          className="h-full w-full object-cover"
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
                src={imageUrl(images[index])}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = "/placeholder.svg";
                  event.currentTarget.onerror = null;
                }}
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
