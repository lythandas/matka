// src/config/constants.ts
export const MAX_PROFILE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CONTENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/heic,image/heif";
export const SUPPORTED_VIDEO_TYPES = "video/mp4,video/quicktime,video/webm"; // Common mobile video types
export const SUPPORTED_MEDIA_TYPES = `${SUPPORTED_IMAGE_TYPES},${SUPPORTED_VIDEO_TYPES}`;