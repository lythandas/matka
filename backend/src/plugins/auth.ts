import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Secret for JWTs

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      username: string;
      role: string;
      permissions: string[];
    } | null;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7, authHeader.length);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string; permissions: string[] };
        request.user = decoded;
      } catch (error) {
        fastify.log.warn('Invalid or expired JWT provided.');
      }
    }
  });
};

export default fp(authPlugin);