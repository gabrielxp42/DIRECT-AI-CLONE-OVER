import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Loader2, X } from 'lucide-react'
import { getCroppedImg, PixelCrop } from './canvasUtils'
import { enhanceImage, EnhanceScale } from './esrganService'

const CloudEnhancerStandalone: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [upscaleFactor, setUpscaleFactor] = useState<EnhanceScale>(4)
  const [showCropModal, setShowCropModal] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setImageToCrop(dataUrl)
        setShowCropModal(true)
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const handleCropComplete = async () => {
    if (imageToCrop && imgRef.current) {
      const img = imgRef.current
      const crop: PixelCrop = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }
      const cropped = await getCroppedImg(imageToCrop, crop)
      if (cropped) {
        setSelectedImage(cropped)
        setResultImage(null)
      }
    }
    setShowCropModal(false)
  }

  const handleUpscale = async () => {
    if (!selectedImage) return
    setIsProcessing(true)
    try {
      const url = await enhanceImage(selectedImage, { scale: upscaleFactor, faceEnhance: true })
      setResultImage(url)
    } catch {
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async (imageUrl?: string) => {
    const targetImage = imageUrl || resultImage
    if (!targetImage) return
    const response = await fetch(targetImage)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `enhanced-${upscaleFactor}x-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen relative text-white">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 10% 10%, rgba(56,189,248,0.18), transparent 60%),' +
            'radial-gradient(800px 500px at 85% 20%, rgba(147,197,253,0.18), transparent 60%),' +
            'linear-gradient(180deg, #05070b 0%, #0a0d13 100%)'
        }}
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src="/logo melhorador cloud.png" alt="Melhorador Cloud" className="h-14 w-14 object-contain" />
            <h1 className="text-3xl font-black tracking-tight">Melhorador Cloud</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={upscaleFactor}
              onChange={(e) => setUpscaleFactor(Number(e.target.value) as EnhanceScale)}
              className="bg-white/10 backdrop-blur border border-white/15 rounded-lg px-3 py-2 text-sm"
            >
              <option value={4}>4x</option>
              <option value={8}>8x</option>
            </select>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-black"
              style={{ background: 'linear-gradient(180deg, #7dd3fc, #38bdf8)' }}
            >
              <Upload size={16} />
              Selecionar Imagem
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-h-[60vh] flex items-center justify-center relative">
          {!selectedImage && (
            <div className="text-center text-gray-300">
              <p className="mb-3">Solte uma imagem aqui, clique para selecionar, ou cole do clipboard</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-black"
                style={{ background: 'linear-gradient(180deg, #7dd3fc, #38bdf8)' }}
              >
                <Upload size={16} />
                Selecionar Imagem
              </button>
            </div>
          )}
          {selectedImage && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <img src={selectedImage} alt="Selecionada" className="max-h-[55vh] object-contain rounded-lg" />
              <div className="mt-6 flex items-center gap-2">
                <button
                  onClick={handleUpscale}
                  disabled={!selectedImage || isProcessing}
                  className="px-4 py-2 text-black font-bold rounded-lg disabled:opacity-50"
                  style={{ background: 'linear-gradient(180deg, #7dd3fc, #38bdf8)' }}
                >
                  {isProcessing ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Processando</span> : 'Melhorar'}
                </button>
                <button
                  onClick={() => handleDownload()}
                  disabled={!resultImage}
                  className="px-4 py-2 bg-white text-black font-bold rounded-lg disabled:opacity-50"
                >
                  Baixar
                </button>
              </div>
              {resultImage && (
                <div className="mt-6">
                  <img src={resultImage} alt="Resultado" className="max-h-[55vh] object-contain rounded-lg" />
                </div>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {showCropModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]"
            >
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-full max-w-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">Pré-visualização</h3>
                  <button onClick={() => setShowCropModal(false)} className="text-gray-400 hover:text-white"><X /></button>
                </div>
                <div className="max-h-[60vh] overflow-auto flex items-center justify-center">
                  {imageToCrop && (
                    <img ref={imgRef} alt="Preview" src={imageToCrop} className="max-h-[50vh] object-contain rounded-lg" />
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowCropModal(false)} className="px-4 py-2 bg-white/10 rounded-lg">Cancelar</button>
                  <button onClick={handleCropComplete} className="px-4 py-2 text-black font-bold rounded-lg" style={{ background: 'linear-gradient(180deg, #7dd3fc, #38bdf8)' }}>Usar imagem</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default CloudEnhancerStandalone
