// backend/src/db.ts
import { Client } from 'pg';
import fs from 'fs/promises';
import { UPLOADS_DIR } from './config';
import { FastifyBaseLogger } from 'fastify'; // Import FastifyBaseLogger type

export let dbClient: Client | null = null; // Initialize as null
export let isDbConnected = false;

export const connectDbAndCreateTables = async (logger: FastifyBaseLogger) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL is not defined. Please set it in your environment variables.');
    throw new Error('DATABASE_URL is not defined.');
  }

  isDbConnected = false; // Ensure it's false at the start of connection process

  const MAX_RETRIES = 10;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    let clientForAttempt: Client | null = null; // Initialize to null
    try {
      // Create a new client for each attempt
      clientForAttempt = new Client({
        connectionString: databaseUrl,
      });
      await clientForAttempt.connect();
      logger.info('Connected to PostgreSQL database');
      dbClient = clientForAttempt; // Assign the successfully connected client
      await createTables(logger);
      isDbConnected = true;
      return; // Success, exit function
    } catch (err: unknown) {
      retries++;
      logger.warn(`Failed to connect to PostgreSQL (attempt ${retries}/${MAX_RETRIES}): ${(err as Error).message}`);
      // If clientForAttempt was successfully initialized before the error, try to end it.
      // This check is important because clientForAttempt might not be assigned if new Client() itself failed.
      if (clientForAttempt && typeof clientForAttempt.end === 'function') {
        try {
          await clientForAttempt.end();
          logger.debug('Closed client after failed attempt.');
        } catch (endErr) {
          logger.error(endErr, 'Error ending client after failed connection attempt.');
        }
      }

      if (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        logger.error(err as Error, 'Failed to connect to PostgreSQL after multiple retries');
        isDbConnected = false;
        dbClient = null; // Ensure global dbClient is null on final failure
        throw new Error('Failed to connect to PostgreSQL after multiple retries');
      }
    }
  }
};

const createTables = async (logger: FastifyBaseLogger) => {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await dbClient!.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        name VARCHAR(255),
        surname VARCHAR(255),
        profile_image_url TEXT,
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      DO $$ BEGIN
          ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'en';
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS journeys (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        owner_username VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255),
        owner_surname VARCHAR(255),
        owner_profile_image_url TEXT,
        is_public BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(255) PRIMARY KEY,
        journey_id VARCHAR(255) REFERENCES journeys(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        author_username VARCHAR(255) NOT NULL,
        author_name VARCHAR(255),
        author_surname VARCHAR(255),
        author_profile_image_url TEXT,
        title VARCHAR(255),
        message TEXT NOT NULL,
        media_items JSONB,
        coordinates JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_draft BOOLEAN DEFAULT FALSE -- New column for drafts
      );

      DO $$ BEGIN
          ALTER TABLE posts ADD COLUMN is_draft BOOLEAN DEFAULT FALSE;
      EXCEPTION
          WHEN duplicate_column THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS journey_user_permissions (
        id VARCHAR(255) PRIMARY KEY,
        journey_id VARCHAR(255) REFERENCES journeys(id) ON DELETE CASCADE,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        can_read_posts BOOLEAN DEFAULT TRUE,
        can_publish_posts BOOLEAN DEFAULT TRUE,
        can_modify_post BOOLEAN DEFAULT TRUE,
        can_delete_posts BOOLEAN DEFAULT FALSE,
        UNIQUE (journey_id, user_id)
      );
    `);
    logger.info('Database tables checked/created successfully');
  } catch (err: unknown) {
    logger.error(err as Error, 'Error creating database tables');
    throw err;
  }
};