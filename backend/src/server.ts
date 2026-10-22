import Fastify, { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic, { FastifyStaticOptions } from '@fastify/static';
import path from 'path';
import fs from 'fs/promises';

import { connectDbAndCreateTables, closeDb } from './db';
import { UPLOADS_PATH, ALLOWED_ORIGINS } from './config';
import userRoutes from './routes/userRoutes';
import protectedUserRoutes from './routes/protectedUserRoutes';
import journeyRoutes from './routes/journeyRoutes';
import postRoutes from './routes/postRoutes';
import mediaRoutes from './routes/mediaRoutes';
import publicJourneyRoutes from './routes/publicJourneyRoutes';
import { authenticate } from './auth';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  bodyLimit: 12 * 1024 * 1024,
});

// Register rate limiting
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Register CORS plugin
fastify.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Health check endpoint for Docker
fastify.get('/health', async (request, reply) => {
  return reply.code(200).send({ status: 'ok' });
});

// 1. Register public API routes (no authentication required)
fastify.register(userRoutes, { prefix: '/api' });
fastify.register(publicJourneyRoutes, { prefix: '/api' });

// 2. Register protected API routes with a prefix and apply authentication hook
fastify.register(async (authenticatedInstance) => {
  authenticatedInstance.addHook('preHandler', authenticate);
  authenticatedInstance.register(protectedUserRoutes, { prefix: '/users' });
  authenticatedInstance.register(journeyRoutes, { prefix: '/journeys' });
  authenticatedInstance.register(postRoutes, { prefix: '/posts' });
  authenticatedInstance.register(mediaRoutes, { prefix: '/media' });
}, { prefix: '/api' });

// 3. Register @fastify/static to serve uploaded files
const uploadStaticOptions: FastifyStaticOptions = {
  root: UPLOADS_PATH,
  prefix: '/uploads/',
  decorateReply: false,
};
fastify.register(fastifyStatic, uploadStaticOptions);

// 4. Serve static frontend assets
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../frontend-dist'),
  prefix: '/',
  decorateReply: true,
});

// 5. SPA fallback
fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
  if (request.method === 'GET' && !request.url.startsWith('/api') && !request.url.startsWith('/uploads')) {
    reply.sendFile('index.html', path.join(__dirname, '../../frontend-dist'));
  } else {
    reply.code(404).send({ message: 'Route not found' });
  }
});

// Run the server
const start = async () => {
  try {
    await connectDbAndCreateTables(fastify.log);
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err: unknown) {
    fastify.log.error(err as Error, 'Failed to start Fastify server or connect to database');
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    await closeDb();
    fastify.log.info('Server and database connections closed.');
    process.exit(0);
  } catch (err) {
    fastify.log.error(err as Error, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
