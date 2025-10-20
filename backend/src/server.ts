import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Client as MinioClient } from 'minio';
import { Client as PgClient } from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const fastify = Fastify({
  logger: true
});

// Register CORS plugin
fastify.register(cors, {
  origin: '*', // Allow all origins for now, refine in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Database Client
const pgClient = new PgClient({
  connectionString: process.env.DATABASE_URL,
});

// MinIO Client
const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const MINIO_BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'journey-images';

// Ensure bucket exists
async function ensureMinioBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET_NAME, 'us-east-1');
    fastify.log.info(`Bucket '${MINIO_BUCKET_NAME}' created.`);
  } else {
    fastify.log.info(`Bucket '${MINIO_BUCKET_NAME}' already exists.`);
  }
}

// Ensure database table exists
async function ensureDbTable() {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  fastify.log.info('Posts table ensured.');
}

// Function to populate with sample posts if the table is empty
async function populateSamplePosts() {
  const countResult = await pgClient.query('SELECT COUNT(*) FROM posts');
  if (parseInt(countResult.rows[0].count, 10) === 0) {
    fastify.log.info('Posts table is empty, populating with sample data...');

    const samplePosts = [
      {
        message: "Lost in the vibrant streets of Marrakech. The colors, the sounds, the spices – an absolute feast for the senses! Every corner holds a new adventure.",
        image_url: "https://images.unsplash.com/photo-1518895949257-7621c3c786d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8bWFycmFrZWNoLHRyYXZlbHwxfHx8fHwxNzE5OTQ1NjAw&ixlib=rb-4.0.3&q=80&w=1080"
      },
      {
        message: "Sunrise over the Grand Canyon. Words cannot describe the sheer scale and beauty of this natural wonder. Feeling incredibly small and grateful.",
        image_url: "https://images.unsplash.com/photo-1527489377706-5bf97e608852?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8Z3JhbmRfY2FueW9uLHN1bnJpc2V8MXx8fHwxNzE5OTQ1NjAw&ixlib=rb-4.0.3&q=80&w=1080"
      },
      {
        message: "Exploring ancient ruins in Rome. Imagine the stories these stones could tell! A journey through history that truly humbles you.",
        image_url: "https://images.unsplash.com/photo-1552832230-c0197ceef0fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8cm9tZSxhbmNpZW50X3J1aW5zfDF8fHx8MTcxOTk0NTYwMA&ixlib=rb-4.0.3&q=80&w=1080"
      },
      {
        message: "Island hopping in Thailand. Crystal clear waters, white sandy beaches, and delicious street food. This is paradise found!",
        image_url: "https://images.unsplash.com/photo-1501854140801-50d016989504?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8dGhhaWxhbmQsaXNsYW5kfDF8fHx8MTcxOTk0NTYwMA&ixlib=rb-4.0.3&q=80&w=1080"
      },
      {
        message: "Hiking through the lush landscapes of Patagonia. The air is crisp, the views are breathtaking, and every step is an adventure.",
        image_url: "https://images.unsplash.com/photo-1547476990-f5411026917b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8cGF0YWdvbmlhLWhpa2luZ3wxfHx8fHwxNzE5OTQ1NjAw&ixlib=rb-4.0.3&q=80&w=1080"
      }
    ];

    for (const post of samplePosts) {
      await pgClient.query(
        'INSERT INTO posts (message, image_url) VALUES ($1, $2)',
        [post.message, post.image_url]
      );
    }
    fastify.log.info('Sample posts added successfully.');
  } else {
    fastify.log.info('Posts table already contains data, skipping sample data population.');
  }
}

// Routes
fastify.get('/', async (request, reply) => {
  return { hello: 'world from Fastify backend!' };
});

// Get all posts
fastify.get('/posts', async (request, reply) => {
  try {
    const result = await pgClient.query('SELECT * FROM posts ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    fastify.log.error('Error fetching posts:', error);
    reply.status(500).send({ message: 'Failed to fetch posts' });
  }
});

// Create a new post with an optional image
fastify.post('/posts', async (request, reply) => {
  try {
    const { message, imageBase64, imageType } = request.body as { message: string; imageBase64?: string; imageType?: string };
    let imageUrl: string | undefined;

    if (imageBase64 && imageType) {
      const buffer = Buffer.from(imageBase64, 'base64');
      const objectName = `${randomUUID()}.${imageType.split('/')[1]}`; // e.g., uuid.jpeg
      const resizedBuffer = await sharp(buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true }) // Resize for web display
        .toBuffer();

      const stream = new Readable();
      stream.push(resizedBuffer);
      stream.push(null);

      await minioClient.putObject(MINIO_BUCKET_NAME, objectName, stream, resizedBuffer.length, {
        'Content-Type': imageType,
      });
      // Use MINIO_PUBLIC_URL_BASE for URLs accessible from the frontend
      imageUrl = `${process.env.MINIO_PUBLIC_URL_BASE || `http://localhost:${process.env.MINIO_PORT || '9000'}`}/${MINIO_BUCKET_NAME}/${objectName}`;
    }

    const result = await pgClient.query(
      'INSERT INTO posts (message, image_url) VALUES ($1, $2) RETURNING *',
      [message, imageUrl]
    );
    reply.status(201).send(result.rows[0]);
  } catch (error) {
    fastify.log.error('Error creating post:', error);
    reply.status(500).send({ message: 'Failed to create post' });
  }
});

// Delete a post by ID
fastify.delete('/posts/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };

    // First, get the post to check for an image URL
    const getPostResult = await pgClient.query('SELECT image_url FROM posts WHERE id = $1', [id]);
    const post = getPostResult.rows[0];

    if (post && post.image_url) {
      // Extract object name from URL
      const url = new URL(post.image_url);
      const objectName = url.pathname.split('/').pop();
      if (objectName) {
        await minioClient.removeObject(MINIO_BUCKET_NAME, objectName);
        fastify.log.info(`Image '${objectName}' deleted from MinIO.`);
      }
    }

    // Then, delete the post from the database
    const result = await pgClient.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      reply.status(404).send({ message: 'Post not found' });
    } else {
      reply.status(200).send({ message: 'Post deleted successfully', id: result.rows[0].id });
    }
  } catch (error) {
    fastify.log.error('Error deleting post:', error);
    reply.status(500).send({ message: 'Failed to delete post' });
  }
});

// Run the server
const start = async () => {
  try {
    await pgClient.connect();
    fastify.log.info('Connected to PostgreSQL database.');

    await ensureMinioBucket();
    await ensureDbTable();
    await populateSamplePosts(); // Call this after ensuring the table exists

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();