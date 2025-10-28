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

// 1. Register public routes that are NOT part of the /api prefix and are NOT frontend assets.
fastify.register(publicRoutes); // Contains /health and a redirect for old public journey paths.

// 2. Register all API routes (both public and protected) with the /api prefix.
fastify.register(userRoutes, { prefix: '/api' }); // Public user routes (login, register, users/exists)
fastify.register(publicJourneyApiRoutes, { prefix: '/api' }); // Public journey API routes (e.g., /api/public/journeys/by-name/...)

// Register protected API routes with a prefix and apply authentication hook
fastify.register(async (authenticatedInstance) => {
  authenticatedInstance.addHook('preHandler', authenticate);
  authenticatedInstance.register(protectedUserRoutes, { prefix: '/users' }); // Protected user routes (profile, admin user management)
  authenticatedInstance.register(journeyRoutes, { prefix: '/journeys' }); // Protected journey routes
  authenticatedInstance.register(postRoutes, { prefix: '/posts' }); // Protected post routes
  authenticatedInstance.register(mediaRoutes, { prefix: '/media' }); // Protected media upload route
}, { prefix: '/api' }); // All these routes will be under /api and authenticated

// 3. Register @fastify/static to serve uploaded files (e.g., /uploads/image.jpg)
fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
  decorateReply: false,
});

// 4. Register @fastify/static to serve frontend static files (e.g., index.html, JS, CSS)
// This MUST be the ABSOLUTE LAST route registered for the root path to act as a catch-all for frontend routes.
// Any route not matched by the above API routes or /uploads will fall here, serving index.html for React Router.
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../frontend-dist'), // Path to the frontend build output
  prefix: '/', // Serve from the root URL
  decorateReply: false,
  fallback: 'index.html', // Serve index.html for any unmatched routes
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