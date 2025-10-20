import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Client as MinioClient } from 'minio';
import { Client as PgClient } from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

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
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

// Define image sizes for optimization
const IMAGE_SIZES = {
  small: { width: 300, height: 225 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

// Ensure bucket exists and set public read policy
async function ensureMinioBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET_NAME, 'us-east-1');
    fastify.log.info(`Bucket '${MINIO_BUCKET_NAME}' created.`);
  } else {
    fastify.log.info(`Bucket '${MINIO_BUCKET_NAME}' already exists.`);
  }

  // Set public read policy for the bucket
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          AWS: ['*'],
        },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${MINIO_BUCKET_NAME}/*`],
      },
    ],
  };

  try {
    await minioClient.setBucketPolicy(MINIO_BUCKET_NAME, JSON.stringify(policy));
    fastify.log.info(`Public read policy set for bucket '${MINIO_BUCKET_NAME}'.`);
  } catch (error) {
    fastify.log.error({ error }, `Error setting public read policy for bucket '${MINIO_BUCKET_NAME}'.`);
  }
}

// Ensure database table exists and populate with sample data if empty
async function ensureDbTable() {
  // Drop the table if it exists to ensure schema is always up-to-date in dev
  await pgClient.query('DROP TABLE IF EXISTS posts;');
  fastify.log.info('Existing posts table dropped (if any).');

  await pgClient.query(`
    CREATE TABLE posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      message TEXT NOT NULL,
      image_urls JSONB, -- Changed to JSONB to store multiple image URLs
      spotify_embed_url TEXT,
      coordinates JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  fastify.log.info('Posts table ensured.');

  const { rowCount } = await pgClient.query('SELECT 1 FROM posts LIMIT 1');
  if (rowCount === 0) {
    fastify.log.info('Posts table is empty, inserting sample data.');
    const samplePosts = [
      {
        title: "Marrakech Market Adventure",
        message: "Exploring the vibrant markets of Marrakech! The colors, sounds, and smells are an absolute feast for the senses. Every corner holds a new discovery.",
        image_urls: {
          small: "https://picsum.photos/seed/marrakech-small/300/225",
          medium: "https://picsum.photos/seed/marrakech-medium/600/450",
          large: "https://picsum.photos/seed/marrakech-large/1200/900",
        },
        spotify_embed_url: null,
        coordinates: null
      },
      {
        title: "Himalayan Sunrise",
        message: "Sunrise over the Himalayas. There's nothing quite like the crisp mountain air and the breathtaking views. Feeling incredibly small and inspired.",
        image_urls: {
          small: "https://picsum.photos/seed/himalayas-small/300/225",
          medium: "https://picsum.photos/seed/himalayas-medium/600/450",
          large: "https://picsum.photos/seed/himalayas-large/1200/900",
        },
        spotify_embed_url: null,
        coordinates: null
      },
      {
        title: "Roman Holiday",
        message: "Lost in the ancient streets of Rome. Every cobblestone tells a story, and the history here is palpable. Gelato in hand, life is good!",
        image_urls: {
          small: "https://picsum.photos/seed/rome-small/300/225",
          medium: "https://picsum.photos/seed/rome-medium/600/450",
          large: "https://picsum.photos/seed/rome-large/1200/900",
        },
        spotify_embed_url: null,
        coordinates: null
      },
      {
        title: "Great Barrier Reef Dive",
        message: "Diving into the crystal-clear waters of the Great Barrier Reef. The marine life is astounding, a kaleidoscope of colors beneath the surface.",
        image_urls: {
          small: "https://picsum.photos/seed/reef-small/300/225",
          medium: "https://picsum.photos/seed/reef-medium/600/450",
          large: "https://picsum.photos/seed/reef-large/1200/900",
        },
        spotify_embed_url: null,
        coordinates: null
      },
      {
        title: "Parisian Evening",
        message: "A serene evening by the Eiffel Tower. The city of lights truly lives up to its name. Parisian charm is simply irresistible.",
        image_urls: {
          small: "https://picsum.photos/seed/eiffel-small/300/225",
          medium: "https://picsum.photos/seed/eiffel-medium/600/450",
          large: "https://picsum.photos/seed/eiffel-large/1200/900",
        },
        spotify_embed_url: null,
        coordinates: null
      }
    ];

    for (const post of samplePosts) {
      await pgClient.query(
        'INSERT INTO posts (title, message, image_urls, spotify_embed_url, coordinates) VALUES ($1, $2, $3, $4, $5)',
        [post.title, post.message, post.image_urls, post.spotify_embed_url, post.coordinates]
      );
    }
    fastify.log.info('Sample posts inserted.');
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
    fastify.log.error({ error }, 'Error fetching posts');
    reply.status(500).send({ message: 'Failed to fetch posts' });
  }
});

// New endpoint for uploading images
fastify.post('/upload-image', async (request, reply) => {
  try {
    const { imageBase64, imageType } = request.body as { imageBase64: string; imageType: string };

    if (!imageBase64 || !imageType) {
      reply.status(400).send({ message: 'Missing imageBase64 or imageType' });
      return;
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      fastify.log.warn(`Image size (${buffer.length} bytes) exceeds limit (${MAX_IMAGE_SIZE_BYTES} bytes).`);
      reply.status(400).send({ message: 'Image size exceeds 8MB limit.' });
      return;
    }

    if (!imageType.startsWith('image/')) {
      fastify.log.warn(`Invalid image type received: ${imageType}`);
      reply.status(400).send({ message: 'Invalid image type.' });
      return;
    }
    const fileExtension = imageType.split('/')[1];
    if (!['jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(fileExtension)) {
      fastify.log.warn(`Unsupported image file extension: ${fileExtension}`);
      reply.status(400).send({ message: 'Unsupported image file format.' });
      return;
    }

    const imageUrls: { [key: string]: string } = {};
    const baseObjectName = randomUUID();
    const minioPublicUrlBase = process.env.MINIO_PUBLIC_URL_BASE || `http://localhost:${process.env.MINIO_PORT || '9000'}`;

    for (const sizeKey of Object.keys(IMAGE_SIZES) as Array<keyof typeof IMAGE_SIZES>) {
      const { width, height } = IMAGE_SIZES[sizeKey];
      const objectName = `${baseObjectName}-${sizeKey}.${fileExtension}`;
      
      fastify.log.info(`Resizing image to ${width}x${height} for object: ${objectName}`);
      let resizedBuffer;
      try {
        resizedBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        fastify.log.info(`Image resized to ${sizeKey}. New buffer size: ${resizedBuffer.length}`);
      } catch (sharpError) {
        fastify.log.error({ sharpError }, `Error during image resizing to ${sizeKey} with sharp.`);
        // Continue to next size or handle error as appropriate
        continue; 
      }

      const stream = new Readable();
      stream.push(resizedBuffer);
      stream.push(null);

      fastify.log.info(`Uploading object '${objectName}' to MinIO bucket '${MINIO_BUCKET_NAME}'`);
      await minioClient.putObject(MINIO_BUCKET_NAME, objectName, stream, resizedBuffer.length, {
        'Content-Type': imageType,
      });
      fastify.log.info(`Object '${objectName}' uploaded successfully.`);
      
      imageUrls[sizeKey] = `${minioPublicUrlBase}/${MINIO_BUCKET_NAME}/${objectName}`;
    }

    // Also store the original image URL if needed, or just rely on 'large' for highest quality
    // For simplicity, we'll just return the generated sizes.
    
    reply.status(200).send({ imageUrls });
  } catch (error) {
    fastify.log.error({ error }, 'Error uploading image');
    reply.status(500).send({ message: 'Failed to upload image' });
  }
});


// Create a new post with an optional image URL, title, Spotify embed, and coordinates
fastify.post('/posts', async (request, reply) => {
  try {
    const { title, message, imageUrls, spotifyEmbedUrl, coordinates } = request.body as { 
      title?: string; 
      message: string; 
      imageUrls?: { small?: string; medium?: string; large?: string }; // Updated to imageUrls object
      spotifyEmbedUrl?: string; 
      coordinates?: { lat: number; lng: number };
    };

    if (!message.trim() && !imageUrls && !spotifyEmbedUrl && !coordinates) {
      reply.status(400).send({ message: 'At least a message, image, Spotify URL, or coordinates are required.' });
      return;
    }

    fastify.log.info('Inserting post into database.');
    const result = await pgClient.query(
      'INSERT INTO posts (title, message, image_urls, spotify_embed_url, coordinates) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title || null, message, imageUrls || null, spotifyEmbedUrl || null, coordinates || null]
    );
    fastify.log.info(`Post inserted successfully. New post ID: ${result.rows[0].id}`);
    reply.status(201).send(result.rows[0]);
  } catch (error) {
    fastify.log.error({ error }, 'Error creating post');
    reply.status(500).send({ message: 'Failed to create post' });
  }
});

// Delete a post by ID
fastify.delete('/posts/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    fastify.log.info(`Attempting to delete post with ID: ${id}`);

    // First, get the post to check for image URLs
    const getPostResult = await pgClient.query('SELECT image_urls FROM posts WHERE id = $1', [id]);
    const post = getPostResult.rows[0];

    if (post && post.image_urls) {
      // Delete all associated image sizes from MinIO
      for (const sizeKey of Object.keys(post.image_urls)) {
        const imageUrl = post.image_urls[sizeKey];
        if (imageUrl) {
          const url = new URL(imageUrl);
          const objectName = url.pathname.split('/').pop();
          if (objectName) {
            fastify.log.info(`Deleting image '${objectName}' from MinIO.`);
            await minioClient.removeObject(MINIO_BUCKET_NAME, objectName);
            fastify.log.info(`Image '${objectName}' deleted from MinIO.`);
          }
        }
      }
    }

    // Then, delete the post from the database
    const result = await pgClient.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      fastify.log.warn(`Post with ID ${id} not found for deletion.`);
      reply.status(404).send({ message: 'Post not found' });
    } else {
      fastify.log.info(`Post with ID ${id} deleted successfully.`);
      reply.status(200).send({ message: 'Post deleted successfully', id: result.rows[0].id });
    }
  } catch (error) {
    fastify.log.error({ error }, 'Error deleting post');
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

    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();