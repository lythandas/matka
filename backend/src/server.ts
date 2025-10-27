import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { FastifyStaticOptions } from '@fastify/static';
import path from 'path';
import fs from 'fs/promises';

import { connectDbAndCreateTables } from './db';
import { UPLOADS_DIR } from './config';
import publicRoutes from './routes/publicRoutes';
import userRoutes from './routes/userRoutes'; // Public user routes
import protectedUserRoutes from './routes/protectedUserRoutes'; // Protected user routes
import journeyRoutes from './routes/journeyRoutes';
import postRoutes from './routes/postRoutes';
import mediaRoutes from './routes/mediaRoutes';
import publicJourneyApiRoutes from './routes/publicJourneyApiRoutes'; // Import the new public journey API routes
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

// Register public routes (now only health check and old redirects)
// IMPORTANT: Register public API routes that should NOT be handled by the frontend's index.html fallback FIRST.
fastify.register(publicRoutes);
fastify.register(publicJourneyApiRoutes); // Register public journey API routes directly (without /api prefix)

// Register @fastify/static to serve frontend static files (e.g., index.html, JS, CSS)
// This should be registered after specific public API routes to avoid conflicts.
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../frontend-dist'), // Path to the frontend build output
  prefix: '/', // Serve from the root URL
  decorateReply: false,
  fallback: 'index.html', // Serve index.html for any unmatched routes
} as FastifyStaticOptions);

// Register @fastify/static to serve uploaded files (e.g., /uploads/image.jpg)
fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
  decorateReply: false,
});

// Register public user routes (no authentication hook applied here)
fastify.register(userRoutes, { prefix: '/api' });

// Register protected API routes with a prefix and apply authentication hook
fastify.register(async (authenticatedInstance) => {
  authenticatedInstance.addHook('preHandler', authenticate);
  authenticatedInstance.register(protectedUserRoutes, { prefix: '/users' }); // Protected user routes
  authenticatedInstance.register(journeyRoutes, { prefix: '/journeys' });
  authenticatedInstance.register(postRoutes, { prefix: '/posts' });
  authenticatedInstance.register(mediaRoutes, { prefix: '/media' }); // Changed to /media for consistency
}, { prefix: '/api' }); // All these routes will be under /api and authenticated

// The explicit catch-all route is removed as fastifyStatic with 'fallback' handles it.

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