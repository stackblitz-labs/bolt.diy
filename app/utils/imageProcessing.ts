/**
 * Image processing utilities for resizing, format conversion, and validation
 */

export interface ProcessedImage {
  file: File;
  dataURL: string;
  wasProcessed: boolean;
  originalSize: number;
  processedSize: number;
  originalType: string;
  processedType: string;
}

export interface ImageProcessingOptions {
  maxSizeKB?: number; // Maximum file size in KB (default: 500KB)
  maxWidth?: number; // Maximum width in pixels (default: 1920)
  maxHeight?: number; // Maximum height in pixels (default: 1080)
  quality?: number; // JPEG quality 0-1 (default: 0.8)
  targetFormat?: 'jpeg' | 'png' | 'webp'; // Target format (default: 'jpeg')
}

const DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
  maxSizeKB: 500,
  maxWidth: 2048, // Increased from 1920 to preserve more detail
  maxHeight: 1536, // Increased from 1080 to preserve more detail
  quality: 0.9, // Start with higher quality
  targetFormat: 'jpeg',
};

const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const CONVERTIBLE_TYPES = ['image/svg+xml', 'image/bmp', 'image/tiff'];

/**
 * Check if a file type is supported by Anthropic
 */
export function isSupportedImageType(type: string): boolean {
  return SUPPORTED_TYPES.includes(type.toLowerCase());
}

/**
 * Check if a file type can be converted to a supported format
 */
export function isConvertibleImageType(type: string): boolean {
  return CONVERTIBLE_TYPES.includes(type.toLowerCase());
}

/**
 * Get file size in KB
 */
export function getFileSizeKB(file: File): number {
  return Math.round(file.size / 1024);
}

/**
 * Create a canvas from an image file
 */
function createCanvasFromImage(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      // Use natural dimensions for accurate canvas size
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      canvas.width = width;
      canvas.height = height;

      // Clear canvas and draw image at exact size
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      console.log(`Canvas created: ${width}x${height}`);

      // Clean up object URL
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    // Create object URL
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resize image while maintaining aspect ratio
 */
function resizeCanvas(canvas: HTMLCanvasElement, maxWidth: number, maxHeight: number): HTMLCanvasElement {
  const { width, height } = canvas;

  // Calculate the scaling factor to fit within max dimensions while preserving aspect ratio
  const scaleX = maxWidth / width;
  const scaleY = maxHeight / height;
  const scale = Math.min(scaleX, scaleY);

  // If scale is >= 1, no resizing needed
  if (scale >= 1) {
    return canvas;
  }

  // Calculate new dimensions (always maintaining exact aspect ratio)
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  console.log(`Resizing image: ${width}x${height} -> ${newWidth}x${newHeight} (scale: ${scale.toFixed(3)})`);

  // Create new canvas with resized dimensions
  const resizedCanvas = document.createElement('canvas');
  const ctx = resizedCanvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context for resizing');
  }

  resizedCanvas.width = newWidth;
  resizedCanvas.height = newHeight;

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the image scaled proportionally
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
  return resizedCanvas;
}

/**
 * Convert canvas to blob with specified format and quality
 */
function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      format,
      quality,
    );
  });
}

/**
 * Convert blob to File with new name and type
 */
function blobToFile(blob: Blob, originalName: string, newType: string): File {
  const extension = newType.split('/')[1];
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const newName = `${nameWithoutExt}.${extension}`;

  return new File([blob], newName, {
    type: newType,
    lastModified: Date.now(),
  });
}

/**
 * Convert blob to data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Process an image file: resize, convert format, and optimize
 */
export async function processImage(file: File, options: ImageProcessingOptions = {}): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSizeKB = getFileSizeKB(file);

  // Check if file is already small enough and in correct format
  if (
    originalSizeKB <= opts.maxSizeKB &&
    isSupportedImageType(file.type) &&
    (opts.targetFormat === 'jpeg'
      ? file.type === 'image/jpeg'
      : opts.targetFormat === 'png'
        ? file.type === 'image/png'
        : opts.targetFormat === 'webp'
          ? file.type === 'image/webp'
          : true)
  ) {
    const dataURL = await blobToDataURL(file);
    return {
      file,
      dataURL,
      wasProcessed: false,
      originalSize: originalSizeKB,
      processedSize: originalSizeKB,
      originalType: file.type,
      processedType: file.type,
    };
  }

  try {
    // Create canvas from image
    const canvas = await createCanvasFromImage(file);
    const originalAspectRatio = canvas.width / canvas.height;
    console.log(
      `Original image dimensions: ${canvas.width}x${canvas.height} (aspect ratio: ${originalAspectRatio.toFixed(3)})`,
    );

    // Resize if needed
    const resizedCanvas = resizeCanvas(canvas, opts.maxWidth, opts.maxHeight);
    const newAspectRatio = resizedCanvas.width / resizedCanvas.height;
    console.log(
      `Final image dimensions: ${resizedCanvas.width}x${resizedCanvas.height} (aspect ratio: ${newAspectRatio.toFixed(3)})`,
    );

    // Verify aspect ratio is preserved (allow tiny rounding differences)
    const aspectRatioDiff = Math.abs(originalAspectRatio - newAspectRatio);
    if (aspectRatioDiff > 0.001) {
      console.warn(
        `⚠️ Aspect ratio changed! Original: ${originalAspectRatio.toFixed(3)}, New: ${newAspectRatio.toFixed(3)}`,
      );
    } else {
      console.log(`✅ Aspect ratio preserved: ${originalAspectRatio.toFixed(3)}`);
    }

    // Determine output format
    const outputFormat = `image/${opts.targetFormat}`;

    // Smart compression targeting 450-500KB range
    const targetMinKB = Math.max(450, opts.maxSizeKB - 50); // Target at least 450KB
    const targetMaxKB = opts.maxSizeKB; // Max 500KB

    let quality = opts.quality;
    let processedBlob: Blob;
    let attempts = 0;
    const maxAttempts = 12;
    let lastGoodBlob: Blob | null = null;
    let lastGoodQuality = quality;

    // First attempt with high quality
    processedBlob = await canvasToBlob(resizedCanvas, outputFormat, quality);
    let currentSizeKB = Math.round(processedBlob.size / 1024);
    console.log(`Attempt 1: Quality ${quality.toFixed(2)}, Size: ${currentSizeKB}KB`);

    // If first attempt is in target range, use it
    if (currentSizeKB >= targetMinKB && currentSizeKB <= targetMaxKB) {
      console.log(`✅ Perfect size on first attempt: ${currentSizeKB}KB`);
    } else if (currentSizeKB <= targetMaxKB) {
      // Too small - try to increase quality/size
      console.log(
        `Image too small (${currentSizeKB}KB), trying to get closer to ${targetMinKB}-${targetMaxKB}KB range`,
      );
      lastGoodBlob = processedBlob;
      lastGoodQuality = quality;

      // Binary search upwards to find better quality
      let minQuality = quality;
      let maxQuality = 1.0;

      for (attempts = 2; attempts <= maxAttempts && maxQuality - minQuality > 0.02; attempts++) {
        quality = (minQuality + maxQuality) / 2;
        processedBlob = await canvasToBlob(resizedCanvas, outputFormat, quality);
        currentSizeKB = Math.round(processedBlob.size / 1024);
        console.log(`Attempt ${attempts}: Quality ${quality.toFixed(2)}, Size: ${currentSizeKB}KB`);

        if (currentSizeKB > targetMaxKB) {
          maxQuality = quality;
        } else {
          minQuality = quality;
          if (currentSizeKB >= targetMinKB) {
            lastGoodBlob = processedBlob;
            lastGoodQuality = quality;
          }
        }
      }

      // Use the best result we found
      if (lastGoodBlob && Math.round(lastGoodBlob.size / 1024) >= targetMinKB) {
        processedBlob = lastGoodBlob;
        quality = lastGoodQuality;
        console.log(
          `✅ Using optimal result: Quality ${quality.toFixed(2)}, Size: ${Math.round(processedBlob.size / 1024)}KB`,
        );
      }
    } else {
      // Too large - reduce quality
      console.log(`Image too large (${currentSizeKB}KB), reducing quality`);

      // Binary search downwards
      let minQuality = 0.1;
      let maxQuality = quality;

      for (attempts = 2; attempts <= maxAttempts && maxQuality - minQuality > 0.02; attempts++) {
        quality = (minQuality + maxQuality) / 2;
        processedBlob = await canvasToBlob(resizedCanvas, outputFormat, quality);
        currentSizeKB = Math.round(processedBlob.size / 1024);
        console.log(`Attempt ${attempts}: Quality ${quality.toFixed(2)}, Size: ${currentSizeKB}KB`);

        if (currentSizeKB > targetMaxKB) {
          maxQuality = quality;
        } else {
          minQuality = quality;
          if (currentSizeKB >= targetMinKB) {
            break; // Found good result in target range
          }
        }
      }
    }

    // Create new file
    const processedFile = blobToFile(processedBlob, file.name, outputFormat);
    const dataURL = await blobToDataURL(processedBlob);
    const processedSizeKB = getFileSizeKB(processedFile);

    console.log(`Image processing complete: ${originalSizeKB}KB -> ${processedSizeKB}KB`);

    return {
      file: processedFile,
      dataURL,
      wasProcessed: true,
      originalSize: originalSizeKB,
      processedSize: processedSizeKB,
      originalType: file.type,
      processedType: outputFormat,
    };
  } catch (error) {
    console.error('Image processing failed:', error);
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate image file before processing
 */
export function validateImageFile(file: File): {
  isValid: boolean;
  error?: string;
  canConvert?: boolean;
} {
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    return {
      isValid: false,
      error: 'File is not an image',
    };
  }

  // Check if supported
  if (isSupportedImageType(file.type)) {
    return { isValid: true };
  }

  // Check if convertible
  if (isConvertibleImageType(file.type)) {
    return {
      isValid: true,
      canConvert: true,
    };
  }

  return {
    isValid: false,
    error: `Unsupported image format: ${file.type}. Supported formats: JPEG, PNG, GIF, WebP`,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(sizeKB: number): string {
  if (sizeKB < 1024) {
    return `${sizeKB} KB`;
  }
  return `${(sizeKB / 1024).toFixed(1)} MB`;
}
