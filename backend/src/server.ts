import Fastify from 'fastify';
import cors from '@fastify/cors';

// Import plugins and routes
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import usersRoutes from './routes/users';
import rolesRoutes from './routes/roles';
import journeysRoutes from './routes/journeys';
import postsRoutes from './routes/posts';
import uploadsRoutes from './routes/uploads';

const fastify = Fastify({
  logger: true,
  bodyLimit: 8 * 1024 * 1024, // Set body limit to 8MB for image uploads
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*', // Allow all origins for now, refine in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Register database plugin
fastify.register(dbPlugin);

// Register authentication plugin
fastify.register(authPlugin);

// Register routes
fastify.register(usersRoutes);
fastify.register(rolesRoutes);
fastify.register(journeysRoutes);
fastify.register(postsRoutes);
fastify.register(uploadsRoutes);

// Root route
fastify.get('/', async (request, reply) => {
  return { hello: 'world from Fastify backend!' };
});

// Run the server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Extend FastifyRequest with a user property (now matching the definition in auth.ts)
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      username: string;
      role: string;
      permissions: string[];
      name?: string;
      surname?: string;
      profile_image_url?: string;
    } | null;
  }
}