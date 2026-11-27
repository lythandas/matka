// backend/src/routes/thumbnailRoutes.ts
import { FastifyInstance, FastifyReply } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  UPLOADS_PATH,
  THUMBS_PATH,
  THUMBNAIL_WIDTH,
  THUMBNAIL_JPEG_QUALITY,
} from '../config';

/**
 * Public thumbnail serving, mirroring the /uploads static route: media files
 * are unauthenticated today (the UUID in the file name is the capability
 * token), so thumbnails must not be more protected than the originals they
 * derive from. Registering this outside the authenticated scope keeps the
 * model coherent.
 *
 * URL shape: /thumbs/<original-file-name>.w<width>.<fmt> — e.g. a request for
 * a downscaled version of /uploads/abc-original.jpg is
 * /thumbs/abc-original.jpg.w800.jpg. Only the width configured in
 * THUMBNAIL_WIDTH is served (see config.ts for why).
 *
 * Output format by source extension:
 *   - svg  → 302 to the original (vector, scales by itself)
 *   - gif  → 302 to the original (sharp would flatten animation to one frame)
 *   - png  → PNG (preserves alpha)
 *   - everything else (jpg/jpeg/webp/bmp/tiff) → JPEG quality 75, flattened on
 *     white so a transparent webp does not turn black.
 *
 * Generated thumbnails are cached in THUMBS_PATH under the requested file
 * name and served with immutable caching (the name embeds the source UUID and
 * width, so it can never change meaning). Generation is write-to-temp +
 * rename, so two concurrent requests for the same thumbnail race safely.
 */

/** Character set of a valid thumbnail file name (no path separators possible). */
const THUMB_NAME_PATTERN = /^(.+)\.w(\d{1,4})\.(jpg|png)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
};

function serveThumbnail(reply: FastifyReply, buffer: Buffer, contentType: string): void {
  reply.headers({
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(buffer.length),
  });
  reply.send(buffer);
}

export default async function thumbnailRoutes(fastify: FastifyInstance) {
  fastify.get('/thumbs/:fileName', async (request, reply) => {
    const { fileName } = request.params as { fileName: string };

    const match = THUMB_NAME_PATTERN.exec(fileName);
    if (!match) {
      return reply.code(400).send({ message: 'Invalid thumbnail file name' });
    }
    const sourceName = match[1];
    const requestedWidth = parseInt(match[2], 10);
    const requestedFormat = match[3];

    // Path traversal guard: the pattern charset allows dots, so reject the
    // ".."-style names explicitly on top of it.
    if (sourceName.includes('..') || sourceName.startsWith('.')) {
      return reply.code(400).send({ message: 'Invalid thumbnail file name' });
    }

    if (requestedWidth !== THUMBNAIL_WIDTH) {
      return reply.code(404).send({ message: 'Unknown thumbnail width' });
    }

    const sourceExt = path.extname(sourceName).slice(1).toLowerCase();
    if (sourceExt === 'svg' || sourceExt === 'gif') {
      // Not rasterisable usefully (vector / animated): the original scales
      // fine, let the browser fetch it directly.
      return reply.redirect(`/uploads/${encodeURIComponent(sourceName)}`);
    }

    const outputFormat = sourceExt === 'png' ? 'png' : 'jpg';
    if (requestedFormat !== outputFormat) {
      return reply.code(404).send({ message: 'Unknown thumbnail variant' });
    }

    const thumbPath = path.join(THUMBS_PATH, fileName);
    const contentType = CONTENT_TYPES[outputFormat];

    // Cache hit: no sharp work at all.
    try {
      const cached = await fs.readFile(thumbPath);
      serveThumbnail(reply, cached, contentType);
      return reply;
    } catch {
      // Miss (or unreadable) — regenerate below.
    }

    const sourcePath = path.join(UPLOADS_PATH, sourceName);
    let buffer: Buffer;
    try {
      await fs.stat(sourcePath);
      // rotate() applies the EXIF orientation before resizing, so a phone
      // photo keeps its upright orientation; withoutEnlargement keeps an
      // already-small image at its natural size instead of blurring it up.
      let pipeline = sharp(sourcePath).rotate().resize({
        width: THUMBNAIL_WIDTH,
        withoutEnlargement: true,
      });
      if (outputFormat === 'png') {
        pipeline = pipeline.png({ compressionLevel: 9 });
      } else {
        pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({
          quality: THUMBNAIL_JPEG_QUALITY,
          mozjpeg: true,
        });
      }
      buffer = await pipeline.toBuffer();
    } catch (error: unknown) {
      // Missing source or unprocessable file: degrade to the original instead
      // of a hard error, so a broken thumbnail never blocks a card.
      fastify.log.warn(error, `Thumbnail generation failed for ${sourceName}, falling back to the original`);
      return reply.redirect(`/uploads/${encodeURIComponent(sourceName)}`);
    }

    // Persist for the next request. Temp file + rename is atomic on the same
    // volume (THUMBS_PATH defaults to a subdirectory of UPLOADS_PATH), so
    // concurrent generations of the same name cannot serve a half-written
    // file; the rename loser just gets overwritten.
    try {
      await fs.mkdir(THUMBS_PATH, { recursive: true });
      const tempPath = path.join(THUMBS_PATH, `.${process.pid}-${Math.random().toString(36).slice(2)}.tmp`);
      await fs.writeFile(tempPath, buffer);
      await fs.rename(tempPath, thumbPath);
    } catch (error: unknown) {
      // Serving works even when persisting fails (e.g. read-only volume).
      fastify.log.warn(error, `Failed to cache thumbnail ${fileName}`);
    }

    serveThumbnail(reply, buffer, contentType);
    return reply;
  });
}
