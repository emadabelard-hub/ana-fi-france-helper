export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Compresses an image File to reduce file size before upload
 * Returns a compressed Blob
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<Blob> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(url);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let { width, height } = img;

        // Scale down if necessary
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image with white background (for transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(
                `Image compressed: ${Math.round(file.size / 1024)}KB → ${Math.round(blob.size / 1024)}KB`
              );
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Compresses an image to reduce file size before sending to the API
 * Target: Max 1200px width/height, 0.6 JPEG quality (60%)
 * Goal: Keep payload under 1MB to prevent Edge Function timeouts
 */
export async function compressImage(base64Data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Calculate new dimensions (max 1200px)
        const MAX_SIZE = 1200;
        let { width, height } = img;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw image with white background (for transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with 0.6 quality (60%)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        
        console.log(`Image compressed: ${Math.round(base64Data.length / 1024)}KB → ${Math.round(compressedBase64.length / 1024)}KB`);
        
        resolve(compressedBase64);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };
    
    img.src = base64Data;
  });
}

/**
 * Check if the data is an image (starts with data:image/)
 */
export function isImageData(base64Data: string): boolean {
  return base64Data.startsWith('data:image/');
}

/**
 * Get human-readable file size in KB
 */
export function getFileSizeKB(base64Data: string): number {
  // Base64 is ~4/3 of the actual binary size
  const binarySize = (base64Data.length * 3) / 4;
  return Math.round(binarySize / 1024);
}

/**
 * Check if file size exceeds limit (in KB)
 */
export function isFileSizeExceeded(base64Data: string, maxSizeKB: number = 1024): boolean {
  return getFileSizeKB(base64Data) > maxSizeKB;
}
