const CLOUD_FUNCTION_URL = 'https://us-central1-overpixel-hub.cloudfunctions.net/enhanceImage'
const TIMEOUT_MS = 7 * 60 * 1000
const MAX_PIXELS = 1000000

export type EnhanceScale = 4 | 8
export interface EnhanceOptions {
  scale: EnhanceScale
  version?: 'nightmare-general' | 'xinttao-anime'
  faceEnhance?: boolean
}

async function resizeImageIfNeeded(imageDataUrl: string): Promise<{ dataUrl: string; width: number; height: number; wasResized: boolean }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const handleLoad = () => {
      const originalWidth = img.naturalWidth
      const originalHeight = img.naturalHeight
      const totalPixels = originalWidth * originalHeight
      if (totalPixels <= MAX_PIXELS) {
        resolve({ dataUrl: imageDataUrl, width: originalWidth, height: originalHeight, wasResized: false })
        return
      }
      const ratio = Math.sqrt(MAX_PIXELS / totalPixels)
      const newWidth = Math.floor(originalWidth * ratio)
      const newHeight = Math.floor(originalHeight * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      try {
        ctx.drawImage(img, 0, 0, newWidth, newHeight)
        const resizedDataUrl = canvas.toDataURL('image/png', 1.0)
        resolve({ dataUrl: resizedDataUrl, width: newWidth, height: newHeight, wasResized: true })
      } catch {
        reject(new Error('Resize failed'))
      }
    }
    img.onload = handleLoad
    img.onerror = () => reject(new Error('Image load error'))
    img.src = imageDataUrl
  })
}

export async function enhanceImage(
  imageDataUrl: string,
  options: EnhanceOptions
): Promise<string> {
  const { scale, version = 'nightmare-general', faceEnhance = false } = options
  const resized = await resizeImageIfNeeded(imageDataUrl)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: resized.dataUrl,
        scale,
        face_enhance: faceEnhance,
        version,
        tile: 0
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      throw new Error('Upscale service error')
    }
    const data = await response.json()
    return data.url as string
  } catch (e: any) {
    clearTimeout(timeoutId)
    throw new Error(e?.message || 'Upscale failed')
  }
}
