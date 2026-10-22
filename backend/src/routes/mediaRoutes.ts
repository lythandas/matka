// backend/src/routes/mediaRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient } from '../db';
import { MediaInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import {
  UPLOADS_PATH,
  MAX_UPLOAD_SIZE_BYTES,
  ALLOWED_FILE_EXTENSIONS,
} from '../config';
import { mapDbUserToApiUser } from '../utils';

function detectFileExtension(buffer: Buffer, declaredType: string): string | null {
  const declaredExt = declaredType.split('/')[1]?.toLowerCase() || '';

  // Check magic bytes for common image formats
  if (buffer.length >= 3) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpg';
    }
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'png';
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'gif';
    }
    if (buffer.length >= 4 && buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return 'bmp';
    }
  }

  // Check for WebP (RIIFF....WEBP)
  if (buffer.length >= 12) {
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return 'webp';
      }
    }
  }

  // Check for SVG (XML text)
  if (buffer.length >= 1 && buffer[0] === 0x3C) {
    const head = buffer.slice(0, Math.min(100, buffer.length)).toString('utf8');
    if (head.includes('<svg') || head.includes('<?xml')) {
      return 'svg';
    }
  }

  // Check for video formats
  if (buffer.length >= 12) {
    // MP4: "ftyp" at offset 4
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
      return 'mp4';
    }
  }
  if (buffer.length >= 4) {
    // WebM
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
      return 'webm';
    }
    // OGG
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x47 && buffer[3] === 0x53) {
      return 'ogg';
    }
  }

  // Fall back to declared extension if magic bytes didn't match
  if (declaredExt && ALLOWED_FILE_EXTENSIONS.has(declaredExt)) {
    return declaredExt;
  }

  return null;
}

export default async function mediaRoutes(fastify: FastifyInstance) {

  fastify.post('/upload-media', {
    schema: {
      body: {
        type: 'object',
        required: ['fileBase64', 'fileType'],
        properties: {
          fileBase64: { type: 'string' },
          fileType: { type: 'string' },
          isProfileImage: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { fileBase64, fileType, isProfileImage } = request.body as { fileBase64: string; fileType: string; isProfileImage: boolean };

    if (!fileBase64 || !fileType) {
      return reply.code(400).send({ message: 'File data and type are required' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');

    if (buffer.length === 0) {
      return reply.code(400).send({ message: 'File is empty' });
    }

    if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
      return reply.code(400).send({ message: `File exceeds maximum size of ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB` });
    }

    // Detect the real file type from magic bytes
    const detectedExt = detectFileExtension(buffer, fileType);
    if (!detectedExt) {
      return reply.code(400).send({ message: 'Unsupported or unrecognized file type' });
    }

    const mediaId = uuidv4();
    const fileName = `${mediaId}-original.${detectedExt}`;
    const filePath = path.join(UPLOADS_PATH, fileName);

    try {
      await fs.mkdir(UPLOADS_PATH, { recursive: true });
      await fs.writeFile(filePath, buffer);
    } catch (error: unknown) {
      fastify.log.error(error, 'Error saving uploaded file:');
      return reply.code(500).send({ message: 'Failed to save uploaded file' });
    }

    const mediaBaseUrl = '/uploads';

    let mediaInfo: MediaInfo;
    if (fileType.startsWith('image/')) {
      mediaInfo = {
        type: 'image',
        urls: {
          small: `${mediaBaseUrl}/${fileName}`,
          medium: `${mediaBaseUrl}/${fileName}`,
          large: `${mediaBaseUrl}/${fileName}`,
          original: `${mediaBaseUrl}/${fileName}`,
        }
      };
    } else if (fileType.startsWith('video/')) {
      mediaInfo = {
        type: 'video',
        url: `${mediaBaseUrl}/${fileName}`,
      };
    } else {
      return reply.code(400).send({ message: 'Unsupported media type' });
    }

    if (isProfileImage && mediaInfo.type === 'image') {
      const updateResult = await dbClient!.query(
        'UPDATE users SET profile_image_url = $1 WHERE id = $2 RETURNING id, username, is_admin, name, surname, profile_image_url, language, created_at',
        [mediaInfo.urls.medium, request.user.id]
      );
      if (updateResult.rows.length > 0) {
        request.user = mapDbUserToApiUser(updateResult.rows[0]);
      }
    }

    return { mediaInfo };
  });
}
