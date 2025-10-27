// src/utils/image-crop.ts

/**
 * This function was adapted from `react-easy-crop`'s example.
 * It creates an image element from a URL.
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // Needed to avoid canvas taint issues
    image.src = url;
  });

/**
 * This function was adapted from `react-easy-crop`'s example.
 * It returns the cropped image as a Blob.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation: number = 0
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = rotation * (Math.PI / 180);

  // calculate bounding box for the rotated image
  const { width, height } = image;
  const sin = Math.sin(rotRad);
  const cos = Math.cos(rotRad);
  const sWidth = Math.abs(width * cos) + Math.abs(height * sin);
  const sHeight = Math.abs(width * sin) + Math.abs(height * cos);

  // set canvas size to match the bounding box
  canvas.width = sWidth;
  canvas.height = sHeight;

  // translate canvas context to a central point to allow rotation around the center.
  ctx.translate(sWidth / 2, sHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(1, 1); // No scaling needed here, handled by react-easy-crop
  ctx.translate(-width / 2, -height / 2);

  // draw rotated image
  ctx.drawImage(image, 0, 0);

  // cropped canvas
  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    return null;
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    croppedCanvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.95); // Use JPEG for smaller file size, 95% quality
  });
}