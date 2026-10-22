// backend/src/config.ts
import path from 'path';

export const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please set it in your environment variables.');
  process.exit(1);
}

if (JWT_SECRET.length < 16) {
  console.error('JWT_SECRET must be at least 16 characters long.');
  process.exit(1);
}

// Use an environment variable for uploads path, with a fallback for local development
export const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');

// CORS origin — comma-separated list of allowed origins, or '*' for all
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

export const ALLOWED_ORIGINS = CORS_ORIGIN === '*'
  ? '*'
  : CORS_ORIGIN.split(',').map(s => s.trim());

// Password validation
export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  return null;
}

// Media upload validation
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed file types: extension -> MIME prefix mapping
export const ALLOWED_FILE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff',
  'mp4', 'webm', 'ogg', 'quicktime',
]);

// Magic bytes for image type sniffing
export const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
  bmp: [0x42, 0x4D],
  svg: [0x3C], // '<'
};

export const VIDEO_MAGIC_BYTES: Record<string, number[]> = {
  mp4: [0x66, 0x74, 0x79, 0x70], // "ftyp" at offset 4, but we check bytes 4-7
  webm: [0x1A, 0x45, 0xDF, 0xA3],
  ogg: [0x4F, 0x67, 0x67, 0x53], // "OggS"
};
