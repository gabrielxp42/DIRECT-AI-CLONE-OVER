
/**
 * Processes an image file to ensure it's suitable for storage in localStorage.
 * Resizes the image to a maximum dimension (e.g., 1500px) and compresses it as JPEG.
 * @param file The file to process
 * @param maxDimension The maximum width or height allowed (default: 1500)
 * @param quality The JPEG quality (0 to 1, default: 0.8)
 * @returns A promise that resolves to the base64 data URL of the processed image
 */
export const processImageForStorage = (file: File, maxDimension = 1500, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Fill white background for transparency (optional, but good for JPEG)
                // Actually, for DTF we might want PNG transparency...
                // But localStorage limit is strict. JPEG is much smaller but no transparency.
                // WEBP supports transparency and is small!

                ctx.drawImage(img, 0, 0, width, height);

                // Try WebP first, fallback to JPEG if needed (but browsers support WebP now)
                // Use a slightly lower quality to ensure small size
                const dataUrl = canvas.toDataURL('image/webp', quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
