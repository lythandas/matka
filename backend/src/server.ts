import Fastify, { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
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
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // Set logger level based on NODE_ENV
  },
  bodyLimit: 12 * 1024 * 1024,
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*', // CONSIDER: Restrict this to your specific frontend domain(s) in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Health check endpoint for Docker (moved from publicRoutes)
fastify.get('/health', async (request, reply) => {
  return reply.code(200).send({ status: 'ok' });
});

// 1. Register public API routes (no authentication required)
fastify.register(userRoutes, { prefix: '/api' }); // Public user routes (login, register, users/exists)
fastify.register(publicJourneyRoutes, { prefix: '/api' }); // Public journey routes - REGISTERED WITH /api PREFIX

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
  decorateReply: false, // No need for sendFile on this instance
};
fastify.register(fastifyStatic, uploadStaticOptions);

// 4. Serve static frontend assets (e.g., CSS, JS, images, index.html)
// IMPORTANT: decorateReply is now true to enable reply.sendFile in the notFoundHandler
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../frontend-dist'), // Path to your built frontend files
  prefix: '/', // Serve from the root path
  decorateReply: true, // <--- Changed to true to enable reply.sendFile
});

// 5. SPA fallback: Catch all other GET requests that are not API or /uploads
// This must be registered LAST to act as a catch-all for frontend routes.
fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
  if (request.method === 'GET' && !request.url.startsWith('/api') && !request.url.startsWith('/uploads')) {
    // It's likely a frontend route, serve index.html
    // reply.sendFile is now available because decorateReply was set to true
    reply.sendFile('index.html', path.join(__dirname, '../../frontend-dist'));
  } else {
    // It's a genuine 404 for an API route or an upload that doesn't exist
    reply.code(404).send({ message: 'Route not found' });
  }
});


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