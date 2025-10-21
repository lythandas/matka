import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { FastifyBaseLogger } from 'fastify'; // Import FastifyBaseLogger

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const IMAGE_SIZES = {
  small: { width: 300, height: 225 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

export async function processAndSaveImage(
  imageBase64: string,
  imageType: string,
  backendBaseUrl: string, // This parameter will now be the EXTERNAL URL
  log: FastifyBaseLogger // Changed to FastifyBaseLogger
): Promise<{ [key: string]: string }> {
  const buffer = Buffer.from(imageBase64, 'base64');

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    log.warn({ bufferLength: buffer.length }, `Image size exceeds limit (${MAX_IMAGE_SIZE_BYTES} bytes).`); // Updated call
    throw new Error(`Image size exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
  }

  if (!imageType.startsWith('image/')) {
    log.warn({ imageType }, `Invalid image type received.`); // Updated call
    throw new Error('Invalid image type.');
  }
  const fileExtension = imageType.split('/')[1];
  if (!['jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(fileExtension)) {
    log.warn({ fileExtension }, `Unsupported image file extension.`); // Updated call
    throw new Error('Unsupported image file format.');
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const imageUrls: { [key: string]: string } = {};
  const baseFileName = randomUUID();

  for (const sizeKey of [...Object.keys(IMAGE_SIZES), 'original'] as Array<keyof typeof IMAGE_SIZES | 'original'>) {
    const objectName = `${baseFileName}-${sizeKey}.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, objectName);
    const publicUrl = `${backendBaseUrl}/uploads/${objectName}`; // Use the provided backendBaseUrl (external)

    let processedBuffer: Buffer = buffer;
    if (sizeKey !== 'original') {
      const { width, height } = IMAGE_SIZES[sizeKey];
      log.info(`Resizing image to ${width}x${height} for file: ${objectName}`); // Updated call
      try {
        processedBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        log.info(`Image resized to ${sizeKey}. New buffer size: ${processedBuffer.length}`); // Updated call
      } catch (sharpError) {
        log.warn({ sharpError }, `Error during image resizing to ${sizeKey} with sharp.`); // Updated call
        continue;
      }
    }

    await fs.writeFile(filePath, processedBuffer);
    log.info(`Image '${objectName}' saved locally at '${filePath}'.`); // Updated call
    imageUrls[sizeKey] = publicUrl;
  }

  return imageUrls;
}

export async function deleteImageFiles(imageUrls: { [key: string]: string }, log: FastifyBaseLogger) { // Changed to FastifyBaseLogger
  for (const sizeKey of Object.keys(imageUrls)) {
    const imageUrl = imageUrls[sizeKey];
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        const fileName = path.basename(url.pathname);
        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.unlink(filePath);
        log.info(`Image file '${fileName}' deleted from local storage.`); // Updated call
      } catch (fileError) {
        log.warn({ fileError }, `Could not delete local image file for URL: ${imageUrl}. It might not exist.`); // Updated call
      }
    }
  }
}