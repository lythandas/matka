// backend/src/config.ts
import path from 'path';

export const JWT_SECRET: string = process.env.JWT_SECRET || ''; // Initialize with empty string for type safety
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please set it in your environment variables.');
  process.exit(1); // Exit if secret is not set
}

export const BACKEND_EXTERNAL_URL = process.env.BACKEND_EXTERNAL_URL || 'http://localhost:3001';
export const UPLOADS_DIR = path.join(__dirname, '../uploads');