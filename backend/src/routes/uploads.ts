import { FastifyPluginAsync } from 'fastify';
import fastifyStatic from '@fastify/static';
import { UPLOADS_DIR, processAndSaveImage } from '../utils/imageProcessor';
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

  // New endpoint for uploading images
  fastify.post('/upload-image', async (request, reply) => {
    if (!request.user || !request.user.id) {
      reply.status(401).send({ message: 'Authentication required.' });
      return;
    }

    try {
      const { imageBase64, imageType } = request.body as { imageBase64: string; imageType: string };

      if (!imageBase64 || !imageType) {
        reply.status(400).send({ message: 'Missing imageBase64 or imageType' });
        return;
      }

      const backendBaseUrl = `http://localhost:3001`; // Assuming backend is accessible at this URL
      const imageUrls = await processAndSaveImage(imageBase64, imageType, backendBaseUrl, fastify.log.warn);
      
      reply.status(200).send({ imageUrls });
    } catch (error: any) {
      fastify.log.error({ error }, 'Error uploading image to local storage');
      reply.status(500).send({ message: error.message || 'Failed to upload image' });
    }
  });
};

export default uploadsRoutes;