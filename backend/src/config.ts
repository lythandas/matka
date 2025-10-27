// backend/src/config.ts
import path from 'path';

export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please set it in your environment variables.');
  process.exit(1);
}

export const BACKEND_EXTERNAL_URL = process.env.BACKEND_EXTERNAL_URL || 'http://localhost:3001';
export const UPLOADS_DIR = path.join(__dirname, '../uploads');