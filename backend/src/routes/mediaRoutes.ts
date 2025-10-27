// backend/src/routes/mediaRoutes.ts
import { FastifyInstance } from 'fastify';
import { dbClient } from '../db';
import { authenticate } from '../auth';
import { MediaInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { BACKEND_EXTERNAL_URL, UPLOADS_DIR } from '../config';
import { mapDbUserToApiUser } from '../utils';

export default async function mediaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Handle media upload
  fastify.post('/upload-media', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
    const { fileBase64, fileType, isProfileImage } = request.body as { fileBase64: string; fileType: string; isProfileImage: boolean };

    if (!fileBase64 || !fileType) {
      return reply.code(400).send({ message: 'File data and type are required' });
    }

    const mediaId = uuidv4();
    const fileExtension = fileType.split('/')[1] || 'bin';
    const fileName = `${mediaId}-original.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      const buffer = Buffer.from(fileBase64, 'base64');
      await fs.writeFile(filePath, buffer);
    } catch (error: unknown) {
      console.error('Error saving uploaded file:', error);
      return reply.code(500).send({ message: 'Failed to save uploaded file' });
    }

    const mediaBaseUrl = `${BACKEND_EXTERNAL_URL}/uploads`;

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
      const updateResult = await dbClient.query(
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