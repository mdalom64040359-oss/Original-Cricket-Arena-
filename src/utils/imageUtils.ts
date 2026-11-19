export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function compressImageToDataUrl(file: File, maxDimension = 256): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, or WebP).');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image is too large (max 10 MB). Please choose a smaller photo.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read the selected image file.'));
      image.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image processing is unavailable in this browser.');
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const webpUrl = canvas.toDataURL('image/webp', 0.84);
    if (webpUrl.startsWith('data:image/webp')) {
      return webpUrl;
    }

    return canvas.toDataURL('image/jpeg', 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
