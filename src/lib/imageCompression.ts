/**
 * Compresses an image to reduce file size before sending to the API
 * Target: Max 1024px width/height, 0.7 JPEG quality
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
        
        // Calculate new dimensions (max 1024px)
        const MAX_SIZE = 1024;
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
        
        // Convert to JPEG with 0.7 quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        
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
 * Get human-readable file size
 */
export function getFileSizeKB(base64Data: string): number {
  // Base64 is ~4/3 of the actual binary size
  const binarySize = (base64Data.length * 3) / 4;
  return Math.round(binarySize / 1024);
}
