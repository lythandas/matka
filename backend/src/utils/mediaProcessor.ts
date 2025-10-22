import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { FastifyBaseLogger } from 'fastify';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Define separate max sizes for profile images and content media
export const MAX_PROFILE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CONTENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const IMAGE_SIZES = {
  small: { width: 300, height: 225 },
  medium: { width: 600, height: 450 },
  large: { width: 1200, height: 900 },
};

// Supported image and video types for validation
const SUPPORTED_IMAGE_EXTENSIONS = ['jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic', 'heif'];
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm']; // Common mobile video extensions

export async function processAndSaveMedia(
  fileBuffer: Buffer,
  fileType: string,
  backendBaseUrl: string,
  log: FastifyBaseLogger,
  isProfileImage: boolean = false // New parameter to differentiate processing
): Promise<{ type: 'image'; urls: { [key: string]: string } } | { type: 'video'; url: string }> {
  const maxSizeBytes = isProfileImage ? MAX_PROFILE_IMAGE_SIZE_BYTES : MAX_CONTENT_FILE_SIZE_BYTES;

  if (fileBuffer.length > maxSizeBytes) {
    log.warn({ bufferLength: fileBuffer.length, maxSizeBytes }, `File size exceeds limit (${maxSizeBytes} bytes).`);
    throw new Error(`File size exceeds ${maxSizeBytes / (1024 * 1024)}MB limit.`);
  }

  const fileExtension = fileType.split('/')[1];

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  if (fileType.startsWith('image/')) {
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(fileExtension)) {
      log.warn({ fileType }, `Unsupported image type received.`);
      throw new Error('Unsupported image file format.');
    }

    const imageUrls: { [key: string]: string } = {};
    const baseFileName = randomUUID();

    if (fileExtension === 'gif') {
      // For GIFs, save the original file directly without resizing or format conversion
      const objectName = `${baseFileName}-original.gif`;
      const filePath = path.join(UPLOADS_DIR, objectName);
      const publicUrl = `${backendBaseUrl}/uploads/${objectName}`;

      await fs.writeFile(filePath, fileBuffer);
      log.info(`GIF '${objectName}' saved locally at '${filePath}'.`);
      // For GIFs, all sizes can point to the original GIF for simplicity, or just 'original'
      imageUrls.original = publicUrl;
      imageUrls.medium = publicUrl; // Use original for medium preview as well
      imageUrls.large = publicUrl; // Use original for large preview as well
      imageUrls.small = publicUrl; // Use original for small preview as well
      return { type: 'image', urls: imageUrls };
    } else {
      // For other image types, proceed with resizing and conversion to JPEG
      const sizesToProcess = isProfileImage ? ['medium'] : [...Object.keys(IMAGE_SIZES), 'original'];

      for (const sizeKey of sizesToProcess as Array<keyof typeof IMAGE_SIZES | 'original' | 'medium'>) {
        const objectName = `${baseFileName}-${sizeKey}.jpeg`; // Always save as JPEG for non-GIFs
        const filePath = path.join(UPLOADS_DIR, objectName);
        const publicUrl = `${backendBaseUrl}/uploads/${objectName}`;

        let processedBuffer: Buffer = fileBuffer;
        if (sizeKey !== 'original') {
          const { width, height } = IMAGE_SIZES[sizeKey === 'medium' && isProfileImage ? 'medium' : sizeKey];
          log.info(`Resizing image to ${width}x${height} for file: ${objectName}`);
          try {
            processedBuffer = await sharp(fileBuffer)
              .resize(width, height, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 }) // Convert to JPEG
              .toBuffer();
            log.info(`Image resized to ${sizeKey}. New buffer size: ${processedBuffer.length}`);
          } catch (sharpError) {
            log.warn({ sharpError }, `Error during image resizing to ${sizeKey} with sharp.`);
            continue;
          }
        } else {
          // For original, convert to JPEG if not already
          try {
            processedBuffer = await sharp(fileBuffer).jpeg({ quality: 90 }).toBuffer();
          } catch (sharpError) {
            log.warn({ sharpError }, `Error converting original image to JPEG with sharp.`);
            continue;
          }
        }

        await fs.writeFile(filePath, processedBuffer);
        log.info(`Image '${objectName}' saved locally at '${filePath}'.`);
        imageUrls[sizeKey] = publicUrl;
      }
      return { type: 'image', urls: imageUrls };
    }

  } else if (fileType.startsWith('video/')) {
    if (!SUPPORTED_VIDEO_EXTENSIONS.includes(fileExtension)) {
      log.warn({ fileType }, `Unsupported video type received.`);
      throw new Error('Unsupported video file format.');
    }

    const baseFileName = randomUUID();
    const objectName = `${baseFileName}-original.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, objectName);
    const publicUrl = `${backendBaseUrl}/uploads/${objectName}`;

    await fs.writeFile(filePath, fileBuffer);
    log.info(`Video '${objectName}' saved locally at '${filePath}'.`);
    return { type: 'video', url: publicUrl };

  } else {
    log.warn({ fileType }, `Unsupported file type received.`);
    throw new Error('Unsupported file type.');
  }
}

export async function deleteMediaFiles(
  mediaInfo: { type: 'image'; urls: { [key: string]: string } } | { type: 'video'; url: string } | string | undefined | null,
  log: FastifyBaseLogger
) {
  if (!mediaInfo) return;

  const filesToDelete: string[] = [];

  if (typeof mediaInfo === 'string') { // For profile_image_url which is a direct string
    filesToDelete.push(mediaInfo);
  } else if (mediaInfo.type === 'image') {
    Object.values(mediaInfo.urls).forEach(url => filesToDelete.push(url));
  } else if (mediaInfo.type === 'video') {
    filesToDelete.push(mediaInfo.url);
  }

  for (const mediaUrl of filesToDelete) {
    if (mediaUrl) {
      try {
        const url = new URL(mediaUrl);
        const fileName = path.basename(url.pathname);
        const filePath = path.join(UPLOADS_DIR, fileName);
        await fs.unlink(filePath);
        log.info(`Media file '${fileName}' deleted from local storage.`);
      } catch (fileError) {
        log.warn({ fileError }, `Could not delete local media file for URL: ${mediaUrl}. It might not exist.`);
      }
    }
  }
}