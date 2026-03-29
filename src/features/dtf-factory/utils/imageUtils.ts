
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

export const resizeImageExact = (imageUrl: string, targetW: number, targetH: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(imageUrl);
                return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);
            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(imageUrl);
                    return;
                }
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        };
        img.onerror = (e) => reject(e);
        img.src = imageUrl;
    });
};

export const cmToPx = (cm: number) => Math.round(cm * 118.11);
export const pxToCm = (px: number) => Math.round((px / 118.11) * 100) / 100;

export const chooseUpscaleFactor = (targetLongestPx: number, baseInputPx = 1152) => {
    if (baseInputPx * 2 >= targetLongestPx) return 2;
    if (baseInputPx * 4 >= targetLongestPx) return 4;
    return 8;
};

export const downscaleToLongest = (imageUrl: string, longestPx: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            const isLandscape = img.naturalWidth >= img.naturalHeight;
            const targetW = isLandscape ? longestPx : Math.round(longestPx * ratio);
            const targetH = isLandscape ? Math.round(longestPx / ratio) : longestPx;
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(imageUrl);
                return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);
            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(imageUrl);
                    return;
                }
                resolve(URL.createObjectURL(blob));
            }, 'image/png');
        };
        img.onerror = (e) => reject(e);
        img.src = imageUrl;
    });
};

export const dataUrlToBlob = (dataUrl: string) => {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
};

export const performUpscaleWithCloud = async (imageBlob: Blob, factor: number): Promise<Blob> => {
    const url = import.meta.env.VITE_UPSCALE_FUNCTION_URL;
    if (!url) return imageBlob;
    const form = new FormData();
    form.append('image', imageBlob, 'input.png');
    form.append('factor', String(factor));
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) return imageBlob;
    const blob = await res.blob();
    return blob;
};

export const ensureOpaquePixels = async (input: Blob): Promise<Blob> => {
    const bitmap = await createImageBitmap(input);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return input;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob || input), 'image/png');
    });
};
