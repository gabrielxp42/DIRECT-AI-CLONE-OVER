import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Loader2, ArrowLeftRight, X } from 'lucide-react'
import { enhanceImage, EnhanceScale } from './esrganService'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

const CloudEnhancerStandalone: React.FC = () => {
  const navigate = useNavigate()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [upscaleFactor, setUpscaleFactor] = useState<EnhanceScale>(4)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [comparePct, setComparePct] = useState<number>(50)
  const [scale, setScale] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [draggingPan, setDraggingPan] = useState<boolean>(false)
  const [draggingCompare, setDraggingCompare] = useState<boolean>(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
    setComparePct(50)
  }, [selectedImage])

  const processImageFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 20MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        const maxSize = 1400
        
        // 1. Resize for API (Max 1400px)
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height / width) * maxSize)
            width = maxSize
          } else {
            width = Math.round((width / height) * maxSize)
            height = maxSize
          }
        }
        
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, width, height)
        const baseDataUrl = canvas.toDataURL('image/jpeg', 0.95)
        
        // 2. Create Pixelated Preview (Downscaled by 3x for chunky pixels)
        const previewWidth = Math.round(width / 3)
        const previewHeight = Math.round(height / 3)
        const previewCanvas = document.createElement('canvas')
        previewCanvas.width = previewWidth
        previewCanvas.height = previewHeight
        const previewCtx = previewCanvas.getContext('2d')
        if (!previewCtx) return
        previewCtx.drawImage(canvas, 0, 0, previewWidth, previewHeight)
        const previewDataUrl = previewCanvas.toDataURL('image/jpeg', 0.6)

        setSelectedImage(baseDataUrl)
        setPreviewImage(previewDataUrl)
        setResultImage(null)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
    e.target.value = ''
  }

  const handleFileFromBlob = (file: File) => {
    processImageFile(file)
  }

  const handleUpscale = async () => {
    if (!selectedImage) return
    setIsProcessing(true)
    try {
      const url = await enhanceImage(selectedImage, { scale: upscaleFactor, faceEnhance: true })
      setResultImage(url)
      toast.success('Imagem melhorada com sucesso!')
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao melhorar imagem')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!resultImage) return
    const response = await fetch(resultImage)
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!selectedImage) return
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    setDraggingPan(true)
  }

  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (draggingCompare && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
        setComparePct(pct)
      } else if (draggingPan && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x
        const dy = e.clientY - dragStartRef.current.y
        dragStartRef.current = { x: e.clientX, y: e.clientY }
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      }
    }

    const handleGlobalUp = () => {
      setDraggingPan(false)
      setDraggingCompare(false)
      dragStartRef.current = null
    }

    if (draggingCompare || draggingPan) {
      window.addEventListener('pointermove', handleGlobalMove)
      window.addEventListener('pointerup', handleGlobalUp)
    }

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove)
      window.removeEventListener('pointerup', handleGlobalUp)
    }
  }, [draggingCompare, draggingPan])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!selectedImage) return
      e.preventDefault()
      
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Coordenadas em relação ao centro do container (pois transform-origin é center)
      const cx = mouseX - rect.width / 2
      const cy = mouseY - rect.height / 2

      const dir = e.deltaY < 0 ? 1.1 : 0.9
      
      setScale(prevScale => {
        const newScale = Math.min(15, Math.max(0.2, prevScale * dir))
        if (newScale !== prevScale) {
          setPan(prevPan => {
            const imgX = (cx - prevPan.x) / prevScale
            const imgY = (cy - prevPan.y) / prevScale
            
            return {
              x: cx - imgX * newScale,
              y: cy - imgY * newScale
            }
          })
        }
        return newScale
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel as any)
  }, [selectedImage])

  return (
    <div className="min-h-screen relative text-white">
      <div className="absolute inset-0 -z-10" style={{ background:
        'radial-gradient(1200px 600px at 10% 10%, rgba(56,189,248,0.18), transparent 60%),' +
        'radial-gradient(800px 500px at 85% 20%, rgba(147,197,253,0.18), transparent 60%),' +
        'linear-gradient(180deg, #05070b 0%, #0a0d13 100%)'
      }} />
      <div className="max-w-[96vw] mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-8">
          <div 
            className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (window.innerWidth >= 768) {
                window.dispatchEvent(new CustomEvent('OVERPIXEL_NAVIGATE', { detail: '/' }));
              } else {
                window.dispatchEvent(new CustomEvent('toggle-launcher'));
              }
            }}
          >
            <img src="/logo melhorador cloud.png" alt="Melhorador Cloud" className="h-14 w-14 object-contain" />
            <h1 className="text-3xl font-black tracking-tight">Melhorador Cloud</h1>
          </div>
          {resultImage && (
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 rounded-xl font-bold text-black shadow-[0_4px_15px_rgba(56,189,248,0.3)] hover:scale-105 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)' }}
            >
              Baixar Resultado
            </button>
          )}
        </div>

        <div
          className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 w-[98vw] mx-auto flex flex-col items-center justify-center relative shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
          style={{ height: 'calc(100vh - 120px)' }}
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer?.files?.[0]
            if (file) handleFileFromBlob(file)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          
          {!selectedImage ? (
            <div 
              className="w-full h-full flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white/20 rounded-2xl hover:bg-white/5 transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-white/5 p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
                <Upload className="w-12 h-12 text-sky-400" />
              </div>
              <p className="text-xl text-gray-200 font-medium mb-2">Clique ou arraste sua imagem aqui</p>
              <p className="text-gray-400">Suporta JPG, PNG e WebP (máx 10MB)</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center relative group">
               
              <button
                onClick={() => { setSelectedImage(null); setResultImage(null); }}
                className="absolute z-50 top-4 right-4 w-10 h-10 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{
                  background: 'rgba(239,68,68,0.25)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  boxShadow: '0 8px 32px rgba(239,68,68,0.2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)'
                }}
                title="Remover imagem"
              >
                <X className="w-5 h-5" />
              </button>

              <div 
                ref={containerRef}
                className="relative w-full h-full overflow-hidden rounded-2xl bg-black/40"
                onPointerDown={handlePointerDown}
                style={{ 
                  cursor: draggingPan ? 'grabbing' : (draggingCompare ? 'col-resize' : 'grab'),
                  touchAction: 'none'
                }}
              >
                {/* Camada: Imagem Original */}
                <div className="absolute inset-0 pointer-events-none">
                  <div 
                    className="w-full h-full"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                      transformOrigin: 'center',
                      transition: (draggingPan || draggingCompare) ? 'none' : 'transform 0.1s ease-out'
                    }}
                  >
                    <img 
                      src={resultImage ? (previewImage || selectedImage) : selectedImage} 
                      alt="Original" 
                      className="w-full h-full object-contain pointer-events-none select-none"
                      style={resultImage ? { 
                        imageRendering: 'pixelated',
                        WebkitImageRendering: 'pixelated',
                        msInterpolationMode: 'nearest-neighbor'
                      } : undefined}
                      draggable={false}
                    />
                  </div>
                </div>

                {/* Camada: Imagem Resultado (Com Clip Path para o Slider) */}
                {resultImage && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ clipPath: `inset(0 0 0 ${comparePct}%)` }}
                  >
                    <div 
                      className="w-full h-full"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: 'center',
                        transition: (draggingPan || draggingCompare) ? 'none' : 'transform 0.1s ease-out'
                      }}
                    >
                      <img 
                        src={resultImage} 
                        alt="Resultado" 
                        className="w-full h-full object-contain pointer-events-none select-none"
                        draggable={false}
                      />
                    </div>
                  </div>
                )}

                {/* Animação de Loading: Scan Invertido */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div
                        className="w-full h-full"
                        style={{
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                          transformOrigin: 'center'
                        }}
                      >
                        {/* Wrapper exato da imagem para a máscara funcionar */}
                        <div 
                          className="relative w-full h-full"
                          style={{
                            maskImage: `url("${selectedImage}")`,
                            WebkitMaskImage: `url("${selectedImage}")`,
                            maskSize: 'contain',
                            WebkitMaskSize: 'contain',
                            maskPosition: 'center',
                            WebkitMaskPosition: 'center',
                            maskRepeat: 'no-repeat',
                            WebkitMaskRepeat: 'no-repeat'
                          }}
                        >
                          <motion.div
                            className="absolute top-0 left-0 right-0 h-[50%]"
                            initial={{ y: '-100%' }}
                            animate={{ y: '250%' }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          >
                            <div 
                              className="w-full h-full" 
                              style={{
                                backdropFilter: 'invert(1) hue-rotate(180deg) brightness(1.2)',
                                WebkitBackdropFilter: 'invert(1) hue-rotate(180deg) brightness(1.2)',
                                background: 'linear-gradient(to bottom, transparent 0%, rgba(56,189,248,0.1) 100%)'
                              }} 
                            />
                            <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,1),0_0_40px_rgba(56,189,248,0.8)]" />
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Linha do Slider */}
                {resultImage && (
                  <div 
                    className="absolute top-0 bottom-0 z-50 flex items-center justify-center"
                    style={{
                      left: `${comparePct}%`,
                      transform: 'translateX(-50%)',
                      width: '4px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 0 15px rgba(0,0,0,0.8)',
                      cursor: 'col-resize',
                      touchAction: 'none'
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setDraggingCompare(true)
                    }}
                  >
                    <div className="absolute w-10 h-10 bg-black/30 backdrop-blur-md border border-white/60 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.8)] pointer-events-none">
                      <ArrowLeftRight className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação Inferiores (Sobrepostos ao Canva) */}
              {!resultImage && (
                <div className="absolute z-50 bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-2xl">
                  <button onClick={() => setUpscaleFactor(2 as EnhanceScale)} className={`px-5 py-2.5 rounded-xl font-medium transition-all ${upscaleFactor === 2 ? 'bg-white/20 text-white shadow-inner' : 'hover:bg-white/10 text-gray-300'}`}>2x</button>
                  <button onClick={() => setUpscaleFactor(4 as EnhanceScale)} className={`px-5 py-2.5 rounded-xl font-medium transition-all ${upscaleFactor === 4 ? 'bg-white/20 text-white shadow-inner' : 'hover:bg-white/10 text-gray-300'}`}>4x</button>
                  <button onClick={() => setUpscaleFactor(8 as EnhanceScale)} className={`px-5 py-2.5 rounded-xl font-medium transition-all ${upscaleFactor === 8 ? 'bg-white/20 text-white shadow-inner' : 'hover:bg-white/10 text-gray-300'}`}>8x</button>
                  <div className="w-[1px] h-8 bg-white/20 mx-2" />
                  <button
                    onClick={handleUpscale}
                    disabled={isProcessing}
                    className="px-8 py-2.5 rounded-xl font-bold text-black disabled:opacity-50 flex items-center gap-2 transition-transform active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)', boxShadow: '0 4px 15px rgba(56,189,248,0.4)' }}
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `Melhorar ${upscaleFactor}x`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CloudEnhancerStandalone
