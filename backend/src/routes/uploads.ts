import { FastifyPluginAsync } from 'fastify';
import fastifyStatic from '@fastify/static';
import { UPLOADS_DIR, processAndSaveMedia } from '../utils/mediaProcessor'; // Updated import
import fs from 'fs/promises';

const uploadsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register fastify-static to serve uploaded images
  fastify.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
  });

  // Ensure the uploads directory exists on startup
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  fastify.log.info(`Ensured uploads directory exists at: ${UPLOADS_DIR}`);

  // New endpoint for uploading images and videos
  fastify.post('/upload-media', async (request, reply) => { // Renamed endpoint
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { fileBase64, fileType, isProfileImage } = request.body as { fileBase64: string; fileType: string; isProfileImage?: boolean }; // Generic fileBase64, fileType

      if (!fileBase64 || !fileType) {
        reply.status(400).send({ message: 'Missing fileBase64 or fileType' });
        return;
      }

      const backendExternalUrl = process.env.BACKEND_EXTERNAL_URL || 'http://localhost:3001'; 
      const mediaInfo = await processAndSaveMedia(Buffer.from(fileBase64, 'base64'), fileType, backendExternalUrl, fastify.log, !!isProfileImage); // Pass isProfileImage
      
      reply.status(200).send({ mediaInfo }); // Return structured mediaInfo
    } catch (error: any) {
      fastify.log.error({ error: error.message, stack: error.stack }, 'Error uploading media to local storage');
      reply.status(500).send({ message: error.message || 'Failed to upload media' });
    }
  });
};

export default uploadsRoutes;