// backend/src/config.ts
import path from 'path';

export const JWT_SECRET: string = process.env.JWT_SECRET || ''; // Initialize with empty string for type safety
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please set it in your environment variables.');
  process.exit(1); // Exit if secret is not set
}

// Use an environment variable for UPLOADS_DIR, with a fallback for local development
export const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');