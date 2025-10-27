// backend/src/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';
import { ApiUser } from './types';
import { isDbConnected } from './db';

declare module 'fastify' {
  interface FastifyRequest {
    user?: ApiUser;
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (user: ApiUser): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!isDbConnected) {
    reply.code(500).send({ message: 'Database not connected. Please try again later.' });
    return reply.sent;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ message: 'Authentication token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ApiUser;
    request.user = decoded;
  } catch (err) {
    reply.code(401).send({ message: 'Invalid or expired token' });
  }
};