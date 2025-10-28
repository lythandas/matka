import Fastify, { FastifyPluginCallback } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic, { FastifyStaticOptions } from '@fastify/static';
import path from 'path';
import fs from 'fs/promises';

import { connectDbAndCreateTables } from './db';
import { UPLOADS_DIR } from './config';
import userRoutes from './routes/userRoutes'; // Public user routes
import protectedUserRoutes from './routes/protectedUserRoutes'; // Protected user routes
import journeyRoutes from './routes/journeyRoutes';
import postRoutes from './routes/postRoutes';
import mediaRoutes from './routes/mediaRoutes';
import publicJourneyRoutes from './routes/publicJourneyRoutes'; // Import new public journey routes
import { authenticate } from './auth'; // Import authenticate hook

const fastify = Fastify({
  logger: {
    level: 'debug',
  },
  bodyLimit: 12 * 1024 * 1024,
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Health check endpoint for Docker (moved from publicRoutes)
fastify.get('/health', async (request, reply) => {
  return reply.code(200).send({ status: 'ok' });
});

// 1. Register public API routes (no authentication required)
fastify.register(userRoutes, { prefix: '/api' }); // Public user routes (login, register, users/exists)
fastify.register(publicJourneyRoutes); // NEW: Public journey routes - REGISTERED WITHOUT PREFIX HERE

// 2. Register protected API routes with a prefix and apply authentication hook
fastify.register(async (authenticatedInstance) => {
  authenticatedInstance.addHook('preHandler', authenticate);
  authenticatedInstance.register(protectedUserRoutes, { prefix: '/users' }); // Protected user routes (profile, admin user management)
  authenticatedInstance.register(journeyRoutes, { prefix: '/journeys' }); // Protected journey routes
  authenticatedInstance.register(postRoutes, { prefix: '/posts' }); // Protected post routes
  authenticatedInstance.register(mediaRoutes, { prefix: '/media' }); // Protected media upload route
}, { prefix: '/api' }); // All these routes will be under /api and authenticated

// 3. Register @fastify/static to serve uploaded files (e.g., /uploads/image.jpg)
const uploadStaticOptions: FastifyStaticOptions = {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
  decorateReply: false,
};
fastify.register(fastifyStatic, uploadStaticOptions);

// 4. SPA fallback: Serve index.html for any unmatched route
// This must be registered AFTER all other API routes to act as a catch-all for frontend routes.
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../frontend-dist'), // Path to your built frontend files
  prefix: '/', // Serve from the root path
  fallback: 'index.html', // When a file is not found, fallback to index.html
} as FastifyStaticOptions);


// Run the server
const start = async () => {
  try {
    await connectDbAndCreateTables(fastify.log);
    await fastify.listen({ port: 8080, host: '0.0.0.0' }); // Listen on 8080
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Failed to start Fastify server or connect to database');
    process.exit(1);
  }
};

start();