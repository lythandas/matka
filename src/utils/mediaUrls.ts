// src/utils/mediaUrls.ts

/**
 * Width of the card thumbnails served by the backend's /thumbs route
 * (backend/src/routes/thumbnailRoutes.ts). Keep in sync with
 * THUMBNAIL_WIDTH in backend/src/config.ts: the backend only serves this
 * single width (see the comment there for why it is not a parameter).
 */
export const THUMBNAIL_WIDTH = 800;

/**
 * URL of the downscaled variant of an uploaded image, or the URL unchanged
 * when it cannot be mapped to one (not an /uploads file, svg — vector, gif —
 * animated, no extension…). In those cases the caller simply loads the
 * original, like before.
 *
 * `/uploads/abc-original.jpg` → `/thumbs/abc-original.jpg.w800.jpg`
 * (PNG sources stay PNG so transparency survives; everything else becomes
 * JPEG — same rule as the backend.)
 */
export function thumbnailUrl(
  url: string | undefined | null,
  width: number = THUMBNAIL_WIDTH,
): string | undefined {
  if (!url) return undefined;
  const uploadsPrefix = "/uploads/";
  if (!url.startsWith(uploadsPrefix)) return url;
  const fileName = url.slice(uploadsPrefix.length);
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return url;
  const sourceExt = fileName.slice(dot + 1).toLowerCase();
  if (sourceExt === "svg" || sourceExt === "gif") return url;
  const thumbExt = sourceExt === "png" ? "png" : "jpg";
  return `/thumbs/${fileName.slice(0, dot)}.w${width}.${thumbExt}`;
}
