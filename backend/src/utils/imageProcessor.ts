import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export const IMAGE_SIZES = {
  small: { width: 300, height: 225 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

export async function processAndSaveImage(
  imageBase64: string,
  imageType: string,
  backendBaseUrl: string,
  log: (obj: any, msg?: string) => void // Logger function from Fastify
): Promise<{ [key: string]: string }> {
  const buffer = Buffer.from(imageBase64, 'base64');

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    log({ bufferLength: buffer.length }, `Image size exceeds limit (${MAX_IMAGE_SIZE_BYTES} bytes).`);
    throw new Error('Image size exceeds 8MB limit.');
  }

  if (!imageType.startsWith('image/')) {
    log({ imageType }, `Invalid image type received.`);
    throw new Error('Invalid image type.');
  }
  const fileExtension = imageType.split('/')[1];
  if (!['jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(fileExtension)) {
    log({ fileExtension }, `Unsupported image file extension.`);
    throw new Error('Unsupported image file format.');
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const imageUrls: { [key: string]: string } = {};
  const baseFileName = randomUUID();

  for (const sizeKey of [...Object.keys(IMAGE_SIZES), 'original'] as Array<keyof typeof IMAGE_SIZES | 'original'>) {
    const objectName = `${baseFileName}-${sizeKey}.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, objectName);
    const publicUrl = `${backendBaseUrl}/uploads/${objectName}`;

    let processedBuffer: Buffer = buffer;
    if (sizeKey !== 'original') {
      const { width, height } = IMAGE_SIZES[sizeKey];
      log(`Resizing image to ${width}x${height} for file: ${objectName}`);
      try {
        processedBuffer = await sharp(buffer)
          .resize(width, height, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        log(`Image resized to ${sizeKey}. New buffer size: ${processedBuffer.length}`);
      } catch (sharpError) {
        log({ sharpError }, `Error during image resizing to ${sizeKey} with sharp.`);
        continue;
      }
    }

    await fs.writeFile(filePath, processedBuffer);
    log(`Image '${objectName}' saved locally at '${filePath}'.`);
    imageUrls[sizeKey] = publicUrl;
  }

  return imageUrls;
}

export async function deleteImageFiles(imageUrls: { [key: string]: string }, log: (obj: any, msg?: string) => void) {
  for (const sizeKey of Object.keys(imageUrls)) {
    const imageUrl = imageUrls[sizeKey];
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        const fileName = path.basename(url.pathname);
        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.unlink(filePath);
        log(`Image file '${fileName}' deleted from local storage.`);
      } catch (fileError) {
        log({ fileError }, `Could not delete local image file for URL: ${imageUrl}. It might not exist.`);
      }
    }
  }
}