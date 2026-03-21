import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Sparkles,
  Download,
  Wand2,
  Camera,
  ImagePlus,
  X,
  Loader2,
  Palette,
  Send,
  Layers,
  Type,
  Image as ImageIcon,
  MessageSquare,
  Zap,
  RotateCcw,
  CircleDot,
  ZoomIn,
  Minus,
  PenTool,
  Eraser,
} from "lucide-react";
import { applyBackgroundRemovalToBlob } from "@/features/dtf-factory/services/halftoneService";
import AntiTransparencyEditor from "@/features/dtf-factory/components/AntiTransparencyEditor";
import { useSession } from "@/contexts/SessionProvider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/dialog";
import { CreditsShopModal } from "./CreditsShopModal";
import { cn } from "@/lib/utils";
import "@/pages/Vetorizador.css";

interface VetorizadorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProcessingStatus = "idle" | "uploading" | "processing" | "done" | "error";

export const VetorizadorModal: React.FC<VetorizadorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { supabase } = useSession();
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | string | null>(null); // Changed type to include string
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<"standard" | "pro">(
    "standard",
  );
  const [dragActive, setDragActive] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedEffect, setSelectedEffect] = useState<string | null>(
    "vectorize",
  );
  const [inlinePrompt, setInlinePrompt] = useState("");
  const [aiCredits, setAiCredits] = useState<number>(0);
  const [isShopOpen, setIsShopOpen] = useState(false); // Existing state for shop visibility
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [previewBg, setPreviewBg] = useState<
    "transparent" | "white" | "black" | "gray" | "checkered"
  >("transparent");
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // --- FETCH CREDITS ---
  const fetchCredits = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles_v2")
      .select("ai_credits")
      .eq("uid", user.id)
      .single();

    if (!error && data) {
      setAiCredits(data.ai_credits || 0);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      fetchCredits();
    }
  }, [isOpen]);

  // ── Drag & Drop ──
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("A imagem é muito grande. O limite máximo é 10MB.");
      return;
    }
    setOriginalFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setResultImage(null);
      setStatus("idle");
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(fileName, file);

    if (uploadError) {
      if (uploadError.message.includes("maximum allowed size")) {
        throw new Error(
          "A imagem é muito grande para o servidor. Tente uma imagem menor que 10MB.",
        );
      }
      throw uploadError;
    }

    const { data } = supabase.storage.from("uploads").getPublicUrl(fileName);

    return data.publicUrl;
  };

  const vectorizeImage = async (
    imageUrl: string,
    model: "standard" | "pro" | "edit",
    prompt?: string,
  ) => {
    const { data: rawData, error } = await supabase.functions.invoke(
      "vectorize",
      {
        body: { image_url: imageUrl, model, prompt },
      },
    );

    if (error) throw error;

    let data = rawData;
    if (typeof rawData === "string") {
      try {
        data = JSON.parse(rawData);
      } catch {
        /* keep raw */
      }
    }
    return data;
  };

  const checkVectorizationStatus = async (vectorizationId: string) => {
    const { data: rawData, error } = await supabase.functions.invoke(
      `vectorize?id=${vectorizationId}`,
      {
        method: "GET",
      },
    );

    if (error) throw error;

    // Safety parsing in case Supabase returns a string
    let data = rawData;
    if (typeof rawData === "string") {
      try {
        data = JSON.parse(rawData);
      } catch {
        /* keep raw */
      }
    }
    return data;
  };

  const pollStatus = async (vectorizationId: string) => {
    const startTime = Date.now();
    const MAX_POLL_TIME = 10 * 60 * 1000; // 10 minutes timeout

    const check = async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        setStatus("error");
        toast.error("Tempo limite de processamento atingido. Tente novamente.");
        return;
      }

      try {
        const data = await checkVectorizationStatus(vectorizationId);
        console.log("[Vetorizador] Poll data:", data);

        if (data.status === "completed" && data.result_url) {
          setResultImage(data.result_url);
          setStatus("done");
          setSelectedEffect(null);
          setUserPrompt("");
          toast.success("Vetorização concluída!");
          setTimeout(() => fetchCredits(), 500);
          return; // Stop polling
        } else if (data.status === "failed") {
          setStatus("error");
          const errorMsg =
            data.error || data.error_message || "Falha na vetorização.";
          if (
            errorMsg.toLowerCase().includes("safety") ||
            errorMsg.toLowerCase().includes("copyright") ||
            errorMsg.toLowerCase().includes("policy")
          ) {
            toast.error(
              "A IA bloqueou a imagem por direitos autorais. Tente outra imagem.",
              { duration: 6000 },
            );
          } else {
            toast.error(errorMsg);
          }
          fetchCredits();
          return; // Stop polling
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        // Continue polling on transient errors unless it's a hard failure
        if (err.context?.response?.status === 404) {
          setStatus("error");
          return;
        }
      }

      // Schedule next check
      setTimeout(check, 3000);
    };

    check();
  };

  const effectOptions = [
    {
      id: "vectorize",
      label: "Vetor Clássico",
      icon: <PenTool size={24} />,
      desc: "Logos limpos, sem fundo, cores chapadas.",
      prompt:
        "recreate as a professional high-fidelity 2D vector logo, ensuring clean lines and flat colors. ULTRA HIGH RESOLUTION: output must be sharp and clear even at 400% zoom. RECREATE from scratch with perfect geometric shapes and solid flat colors. TIGHT CROP: ensure logo occupies 95% of the frame.",
    },
    {
      id: "embroidery",
      label: "Efeito Bordado",
      icon: <Layers size={24} />,
      desc: "Patch 3D realista, linhas detalhadas.",
      prompt:
        "HIGH-DETAILED EMBROIDERED PATCH of the logo. ULTRA HIGH RESOLUTION 4K. Elevated stitching and 3D texture. TIGHT CROP: logo must occupy 90-95% of the frame. HIGH CONTRAST BACKGROUND for visibility. Isolated on PNG background with no surrounding fabric or surface.",
    },
    {
      id: "puff",
      label: "Puff Print",
      icon: <Type size={24} />,
      desc: "Relevo 3D estilo estampa puff.",
      prompt:
        "3D puff print on fabric, raised ink, tactile texture, ULTRA HIGH RESOLUTION 4K. TIGHT CROP: occupy 95% of the frame. Isolated, transparent background, strictly no background.",
    },
    {
      id: "neon",
      label: "Efeito Neon",
      icon: <Zap size={24} />,
      desc: "Letreiro neon brilhante realista.",
      prompt:
        "glowing neon sign, vibrant colors, cinematic lighting, ULTRA HIGH RESOLUTION 4K. TIGHT CROP: occupy 95% of the frame. Isolated, transparent background, strictly no background.",
    },
    {
      id: "sticker",
      label: "Adesivo",
      icon: <ImageIcon size={24} />,
      desc: "Adesivo de vinil com borda branca.",
      prompt:
        "die-cut vinyl sticker, thick white border, glossy finish, ULTRA HIGH RESOLUTION 4K. TIGHT CROP: occupy 95% of the frame. Isolated, transparent background outside the sticker.",
    },
    {
      id: "custom",
      label: "Personalizado",
      icon: <MessageSquare size={24} />,
      desc: "Escreva exatamente o que deseja.",
      prompt: "",
    },
  ];

  const handleProcess = async (prompt?: string) => {
    const source = resultImage || originalFile;
    if (!source) return;

    // --- TABELA DE PREÇOS (Sincronizada com Backend) ---
    const COSTS = {
      standard: 1,
      pro: 3,
      edit: 1,
      bg_removal: 5,
    };

    const cost = prompt
      ? COSTS.edit
      : selectedModel === "pro"
        ? COSTS.pro
        : COSTS.standard;
    const currentCredits = aiCredits;

    if (currentCredits < cost) {
      toast.error(
        `Saldo insuficiente: você tem ${currentCredits} créditos e precisa de ${cost}.`,
      );
      setIsShopOpen(true); // Open the shop modal
      return;
    }

    const isEdit = !!prompt;
    setStatus(isEdit ? "processing" : "uploading");

    try {
      let imageUrl = "";
      if (typeof source === "string" && source.startsWith("http")) {
        imageUrl = source;
      } else if (source instanceof File) {
        // Check if source is a File object
        imageUrl = await uploadImage(source);
      } else {
        return;
      }

      const response = await vectorizeImage(
        imageUrl,
        isEdit ? "edit" : selectedModel,
        prompt,
      );

      console.log("Vectorization started:", response);

      if (response?.vectorization_id) {
        setStatus("processing");
        pollStatus(response.vectorization_id);
      } else {
        throw new Error("Erro na resposta da API");
      }
    } catch (err: any) {
      console.error("Vectorization error:", err);
      let errorMsg = "Erro ao processar imagem.";

      // Try to extract JSON error from Edge Function
      if (err.context?.response) {
        try {
          const errorData = await err.context.response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch (e) {
          errorMsg = err.message || errorMsg;
        }
      } else {
        errorMsg = err.message || errorMsg;
      }

      if (
        errorMsg.toLowerCase().includes("safety") ||
        errorMsg.toLowerCase().includes("copyright") ||
        errorMsg.toLowerCase().includes("policy")
      ) {
        toast.error(
          "A IA bloqueou esta imagem por direitos autorais ou política de segurança. Tente outra arte.",
          { duration: 6000 },
        );
      } else if (
        err.context?.response?.status === 503 ||
        errorMsg.toLowerCase().includes("credit") ||
        errorMsg.toLowerCase().includes("balance")
      ) {
        toast.error(
          "O sistema de IA está em manutenção ou sem créditos no momento. Por favor, avise o suporte.",
          { duration: 8000 },
        );
      } else {
        toast.error(errorMsg);
      }

      setStatus("error");
      fetchCredits();
    }
  };

  const pushToHistory = (imageUrl: string | null) => {
    if (!imageUrl) return;
    setImageHistory((prev) => [...prev.slice(-9), imageUrl]); // Keep last 10 steps
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY,
      );
      setTouchStartDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY,
      );
      const delta = dist - touchStartDist;
      if (Math.abs(delta) > 5) {
        setZoomLevel((prev) =>
          Math.max(1, Math.min(5, prev + (delta > 0 ? 0.1 : -0.1))),
        );
        setTouchStartDist(dist);
      }
    }
  };

  const handleUndo = () => {
    if (imageHistory.length === 0) return;
    const newHistory = [...imageHistory];
    const lastImage = newHistory.pop();
    setImageHistory(newHistory);
    setResultImage(lastImage || null);
    toast.info("Ação desfeita");
  };

  const handleAntiTransparencySave = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    pushToHistory(resultImage || originalImage);
    setResultImage(url);
    setIsRemovingBackground(false);
    setStatus("done");
    toast.success("Fundo removido com sucesso!");
  };

  const handleRemoveBackground = () => {
    console.log("[Vetorizador] Abrindo Removedor de Fundo...");
    setIsRemovingBackground(true);
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    // Logica legada removida — agora usamos o AntiTransparencyEditor
    console.log("[Vetorizador] Use o Removedor de Fundo para editar a imagem.");
  };

  const handleHalftoneWarning = () => {
    toast("Efeito Halftone Restrito", {
      description:
        "Este efeito é exclusivo para produção no DTF Factory. Use as ferramentas de lá para aplicar retículas!",
      action: {
        label: "Ir para DTF Factory",
        onClick: () => {
          if (resultImage) {
            handleTransferToFactory();
          } else {
            navigate("/dtf-factory");
          }
        },
      },
      duration: 6000,
    });
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlinePrompt.trim() || status === "processing") return;
    handleProcess(inlinePrompt);
    setInlinePrompt("");
  };

  const handleReset = () => {
    setOriginalImage(null);
    setOriginalFile(null);
    setResultImage(null);
    setStatus("idle");
    setUserPrompt("");
    setSelectedEffect(null);
    setInlinePrompt("");
    setZoomLevel(1);
    setImageHistory([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleDownload = async () => {
    if (!resultImage) return;

    try {
      toast.loading("Preparando download...", { id: "downloading" });
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vetoriza-ai-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Download concluído!", { id: "downloading" });
    } catch (error) {
      console.error("Download error:", error);
      window.open(resultImage, "_blank");
      toast.error("Erro no download direto. Abrindo imagem em nova aba.", {
        id: "downloading",
      });
    }
  };

  const handleTransferToFactory = (halftonePreset?: string) => {
    if (!resultImage) return;

    const transferState = {
      type: "VETORIZA_TO_FACTORY",
      data: {
        image: resultImage,
        prompt: inlinePrompt || userPrompt || "Vetorização via Gabi AI",
        halftonePreset: halftonePreset || "halftone_medio_preto",
        timestamp: Date.now(),
      },
    };

    localStorage.setItem(
      "OVERPIXEL_BRIDGE_STATE",
      JSON.stringify(transferState),
    );
    toast.success("Preparando produção no DTF Factory...");
    onClose();
    navigate("/dtf-factory");
  };

  const handleTransferToMontador = () => {
    if (!resultImage) return;

    const transferState = {
      type: "VETORIZA_TO_MONTADOR",
      data: {
        image: resultImage,
        prompt: inlinePrompt || userPrompt || "Vetorização via Gabi AI",
        timestamp: Date.now(),
      },
    };

    localStorage.setItem(
      "OVERPIXEL_BRIDGE_STATE",
      JSON.stringify(transferState),
    );
    toast.success("Enviando para o Montador de Layout...");
    onClose();
    navigate("/montador");
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className="w-[95vw] max-w-[1200px] h-[90vh] p-0 overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] bg-zinc-950/60 backdrop-blur-3xl dialog-content-vec"
          hideCloseButton
        >
          <VisuallyHidden>
            <DialogTitle>Vetorizador Premium AI</DialogTitle>
          </VisuallyHidden>

          <div className="dashboard-mobile-vec h-full w-full overflow-hidden">
            <div className="dashboard-content-vec h-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />

              <div className="header-vec">
                <div className="flex items-center gap-3">
                  <div className="icon-badge-vec">
                    <Sparkles
                      className="text-primary fill-primary/20"
                      size={24}
                    />
                  </div>
                  <div>
                    <h2 className="title-vec">Vetoriza AI</h2>
                    <p className="subtitle-vec">
                      A inteligência que transforma pixels em perfeição.
                    </p>
                  </div>
                </div>

                {/* WALLET DISPLAY */}
                <div className="wallet-vec" onClick={() => setIsShopOpen(true)}>
                  <div className="wallet-content-vec">
                    <Zap className="text-primary fill-primary" size={16} />
                    <div className="flex flex-col">
                      <span className="wallet-label-vec">Seus Créditos</span>
                      <span className="wallet-value-vec">
                        {aiCredits.toLocaleString()}
                      </span>
                    </div>
                    <button className="wallet-add-vec">
                      <Zap size={12} fill="currentColor" />
                    </button>
                  </div>
                </div>

                <button className="close-btn-vec" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>

              <div className="main-grid-vec overflow-hidden">
                {status === "idle" && !originalImage ? (
                  <div
                    className={`upload-zone-vec ${dragActive ? "active" : ""}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="upload-content-vec">
                      <div className="upload-icon-wrapper-vec">
                        <ImagePlus size={32} />
                      </div>
                      <h2 className="upload-title-vec">
                        Transforme sua Imagem Agora
                      </h2>
                      <p className="upload-subtitle-vec">
                        Arraste seu arquivo ou escolha uma opção abaixo:
                      </p>

                      <div className="upload-options-vec">
                        <button
                          className="action-btn-vec ghost flex-1 min-w-[120px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            cameraInputRef.current?.click();
                          }}
                        >
                          <Camera size={20} className="text-primary" />
                          <span>Tirar Foto</span>
                        </button>
                        <button
                          className="action-btn-vec ghost flex-1 min-w-[120px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                        >
                          <ImageIcon size={20} className="text-primary" />
                          <span>Galeria</span>
                        </button>
                      </div>
                      <p className="mt-4 text-[10px] uppercase tracking-widest text-white/20 font-bold">
                        JPG, PNG ou WEBP • Máx 10MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="preview-container-vec overflow-hidden">
                    <div className="preview-split-left">
                      <div className="preview-card-vec active">
                        <div className="card-header-vec flex justify-between items-center px-4">
                          <div className="flex items-center gap-3">
                            <span className="card-tag-vec">
                              {(status as string) === "processing"
                                ? "Processando IA..."
                                : (status as string) === "done"
                                  ? "Resultado Final"
                                  : "Imagem Original"}
                            </span>
                          </div>
                        </div>
                        <div
                          className="card-image-vec overflow-auto relative touch-none scrollbar-hide"
                          style={{
                            backgroundColor:
                              previewBg === "white"
                                ? "#fff"
                                : previewBg === "black"
                                  ? "#000"
                                  : previewBg === "gray"
                                    ? "#888"
                                    : "transparent",
                            backgroundImage:
                              previewBg === "checkered"
                                ? 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACtJREFUGFdjZEACDAwMgAxmMEEGEB8MAAmMAEYGJABmAAmMAEYIIwAQMAAYFBAE6q1f3AAAAABJRU5ErkJggg==") repeat'
                                : "none",
                          }}
                          onWheel={(e) => {
                            const container = e.currentTarget;
                            const rect = container.getBoundingClientRect();

                            // Posição do mouse relativa à área VISÍVEL do container
                            const mouseX = e.clientX - rect.left;
                            const mouseY = e.clientY - rect.top;

                            // Posição do ponto na imagem em relação ao topo-esquerdo do CONTEÚDO (scroll)
                            const scrollX = container.scrollLeft;
                            const scrollY = container.scrollTop;

                            const oldZoom = zoomLevel;
                            const delta = -e.deltaY;
                            // Zoom mais suave: 0.1 a 0.2
                            const zoomStep = 0.2;
                            const newZoom = Math.max(
                              1,
                              Math.min(
                                8,
                                oldZoom + (delta > 0 ? zoomStep : -zoomStep),
                              ),
                            );

                            if (newZoom !== oldZoom) {
                              const ratio = newZoom / oldZoom;
                              setZoomLevel(newZoom);

                              // Calculamos o novo scroll para manter o ponto sob o mouse
                              const targetScrollX =
                                (scrollX + mouseX) * ratio - mouseX;
                              const targetScrollY =
                                (scrollY + mouseY) * ratio - mouseY;

                              requestAnimationFrame(() => {
                                container.scrollLeft = targetScrollX;
                                container.scrollTop = targetScrollY;
                              });
                            }
                          }}
                          onTouchEnd={() => setTouchStartDist(null)}
                        >
                          {(status === "processing" ||
                            status === "uploading") &&
                          !resultImage ? (
                            <div className="loading-container-vec">
                              <Loader2
                                className="animate-spin text-primary"
                                size={48}
                              />
                              <p>
                                {status === "uploading"
                                  ? "Enviando arquivo..."
                                  : "A mágica está acontecendo..."}
                              </p>
                            </div>
                          ) : (
                            <>
                              <img
                                src={
                                  resultImage
                                    ? resultImage
                                    : originalImage || ""
                                }
                                alt={resultImage ? "Resultado" : "Original"}
                                className={`${status === "processing" ? "opacity-50" : ""} transition-all duration-200`}
                                style={{
                                  width: `${zoomLevel * 100}%`,
                                  height: `${zoomLevel * 100}%`,
                                  minWidth: "100%",
                                  minHeight: "100%",
                                  objectFit: "contain",
                                  maxWidth: "none",
                                  maxHeight: "none",
                                }}
                                onClick={handleImageClick}
                                draggable={false}
                              />
                              {status === "processing" && resultImage && (
                                <div className="loading-overlay-vec">
                                  <Loader2
                                    className="animate-spin text-primary"
                                    size={32}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* UI OVERLAYS (EXTERNOS AO SCROLL PARA FICAREM FIXOS SOBRE O PREVIEW) */}

                        {/* LIQUID GLASS ACTIONS */}
                        {(status === "idle" || status === "done") &&
                          (originalImage || resultImage) && (
                            <div className="floating-glass-actions-vec fade-in z-[100]">
                              <button
                                className="liquid-glass-btn-vec border-cyan-500/30"
                                onClick={handleRemoveBackground}
                                title="Remover Fundo (IA e Manual Interativo)"
                              >
                                <div className="liquid-glass-icon-vec">
                                  <Eraser size={20} className="text-cyan-400" />
                                </div>
                                <span className="liquid-glass-label-vec">
                                  Remover Fundo
                                </span>
                              </button>

                              <button
                                className="liquid-glass-btn-vec"
                                onClick={handleHalftoneWarning}
                                title="Efeito Halftone"
                              >
                                <div className="liquid-glass-icon-vec">
                                  <CircleDot size={20} />
                                </div>
                                <span className="liquid-glass-label-vec">
                                  Halftone
                                </span>
                              </button>
                            </div>
                          )}

                        {/* LIQUID GLASS LEFT ACTIONS (EXPANDABLE BUMP SIDEBAR) */}
                        {(status === "done" || imageHistory.length > 0) && (
                          <div
                            className={cn(
                              "floating-glass-left-vec fade-in z-30",
                              isSidebarExpanded
                                ? "is-expanded"
                                : "is-collapsed",
                            )}
                            onClick={() =>
                              !isSidebarExpanded && setIsSidebarExpanded(true)
                            }
                          >
                            {imageHistory.length > 0 && (
                              <button
                                className="liquid-glass-btn-vec border-orange-500/30 text-orange-400"
                                onClick={(e) => {
                                  if (isSidebarExpanded) {
                                    e.stopPropagation();
                                    handleUndo();
                                  } else {
                                    setIsSidebarExpanded(true);
                                  }
                                }}
                                title={
                                  isSidebarExpanded
                                    ? "Desfazer"
                                    : "Abrir Ferramentas"
                                }
                              >
                                <div className="liquid-glass-icon-vec">
                                  <RotateCcw size={18} />
                                </div>
                                <span className="liquid-glass-label-vec">
                                  Desfazer
                                </span>
                              </button>
                            )}

                            {status === "done" && resultImage && (
                              <div className="glass-group-vec mt-2">
                                <button
                                  className={`color-dot-btn ${previewBg === "white" ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewBg("white");
                                  }}
                                  title="Fundo Branco"
                                >
                                  <div className="w-full h-full rounded-full bg-white" />
                                </button>
                                <button
                                  className={`color-dot-btn ${previewBg === "black" ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewBg("black");
                                  }}
                                  title="Fundo Preto"
                                >
                                  <div className="w-full h-full rounded-full bg-black" />
                                </button>
                                <button
                                  className={`color-dot-btn ${previewBg === "gray" ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewBg("gray");
                                  }}
                                  title="Fundo Cinza"
                                >
                                  <div className="w-full h-full rounded-full bg-gray-500" />
                                </button>
                                <button
                                  className={`color-dot-btn checkered ${previewBg === "checkered" ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewBg("checkered");
                                  }}
                                  title="Fundo Xadrez"
                                />
                                <button
                                  className={`color-dot-btn transparent ${previewBg === "transparent" ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewBg("transparent");
                                  }}
                                  title="Reset Fundo"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}

                            {isSidebarExpanded && (
                              <div
                                className="fixed inset-0 z-[-1]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsSidebarExpanded(false);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* OPTIMIZED ZOOM & RESET AREA (OUTSIDE CARD) */}
                      {(status === "idle" || status === "done") &&
                        (originalImage || resultImage) && (
                          <div className="mt-4 flex flex-col items-center gap-3">
                            {/* COMPACT ZOOM (OUTSIDE PREVIEW) */}
                            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-xl p-1 rounded-full border border-white/10 shadow-lg px-3">
                              <button
                                onClick={() =>
                                  setZoomLevel((z) => Math.max(z - 0.5, 1))
                                }
                                className="p-1.5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all"
                                title="Menos Zoom"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter w-8 text-center">
                                {Math.round(zoomLevel * 100)}%
                              </span>
                              <button
                                onClick={() =>
                                  setZoomLevel((z) => Math.min(z + 0.5, 8))
                                }
                                className="p-1.5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all"
                                title="Mais Zoom"
                              >
                                <ZoomIn size={14} />
                              </button>
                            </div>

                            <button
                              className="group relative flex items-center justify-center gap-2 py-2.5 px-6 rounded-2xl transition-all duration-300 backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 shadow-2xl overflow-hidden"
                              onClick={handleReset}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <RotateCcw
                                size={18}
                                className="text-white/70 group-hover:text-primary transition-colors group-hover:rotate-[-45deg] duration-500"
                              />
                              <span className="text-sm font-medium text-white/90 tracking-wide uppercase">
                                Trocar Imagem
                              </span>
                            </button>
                          </div>
                        )}
                    </div>

                    <div className="preview-split-right">
                      <div className="model-selector-vec">
                        <button
                          className={`model-btn-vec ${selectedModel === "standard" ? "active" : ""}`}
                          onClick={() => setSelectedModel("standard")}
                        >
                          <Zap size={16} />
                          <span>Standard</span>
                          <span className="model-credits-vec">1 crédito</span>
                        </button>
                        <button
                          className={`model-btn-vec ${selectedModel === "pro" ? "active" : ""}`}
                          onClick={() => setSelectedModel("pro")}
                        >
                          <Sparkles size={16} />
                          <span>Pro HD</span>
                          <span className="model-credits-vec">3 créditos</span>
                        </button>
                      </div>

                      <div className="preview-actions-vec">
                        {resultImage && (
                          <div className="inline-agent-chat-vec fade-in">
                            <div className="agent-bubble-vec">
                              <div className="agent-avatar-vec">
                                <Sparkles size={24} />
                              </div>
                              <div className="agent-text-vec">
                                {(status as string) === "processing" ? (
                                  <p className="flex items-center gap-2">
                                    <Loader2
                                      className="animate-spin"
                                      size={16}
                                    />
                                    <strong>Gabi:</strong> Um momento...
                                  </p>
                                ) : (
                                  <p>
                                    <strong>Gabi:</strong> Ficou do seu gosto?
                                    Me diga o que mais quer alterar!
                                  </p>
                                )}
                              </div>
                            </div>

                            <form
                              onSubmit={handleInlineSubmit}
                              className="inline-chat-input-vec"
                            >
                              <input
                                type="text"
                                value={inlinePrompt}
                                onChange={(e) =>
                                  setInlinePrompt(e.target.value)
                                }
                                placeholder="Diga à Gabi o que ajustar..."
                                disabled={(status as string) === "processing"}
                              />
                              <button
                                type="submit"
                                disabled={
                                  !inlinePrompt.trim() ||
                                  (status as string) === "processing"
                                }
                              >
                                <Send size={18} />
                              </button>
                            </form>

                            <div className="inline-actions-row-vec">
                              <button
                                className="action-btn-vec primary"
                                onClick={handleDownload}
                              >
                                <Download size={20} />
                                Baixar
                              </button>
                              <button
                                className="action-btn-vec ghost"
                                onClick={handleReset}
                              >
                                Reset
                              </button>
                            </div>

                            <div className="production-bridge-vec fade-in mt-6 pt-6 border-t border-white/5">
                              <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-4">
                                Ações de Produção
                              </h4>
                              <div className="flex flex-col gap-3">
                                <button
                                  className="bridge-card-vec factory group"
                                  onClick={() => handleTransferToFactory()}
                                >
                                  <div className="bridge-card-icon-vec">
                                    <Zap size={20} className="text-cyan-400" />
                                  </div>
                                  <div className="bridge-card-info-vec">
                                    <span className="bridge-title-vec">
                                      Preparar DTF (Halftone)
                                    </span>
                                    <span className="bridge-desc-vec">
                                      Aplicar retícula e salvar para impressão
                                    </span>
                                  </div>
                                  <Sparkles
                                    size={16}
                                    className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  />
                                </button>

                                <button
                                  className="bridge-card-vec montador group"
                                  onClick={handleTransferToMontador}
                                >
                                  <div className="bridge-card-icon-vec">
                                    <Layers
                                      size={20}
                                      className="text-orange-400"
                                    />
                                  </div>
                                  <div className="bridge-card-info-vec">
                                    <span className="bridge-title-vec">
                                      Adicionar ao Montador
                                    </span>
                                    <span className="bridge-desc-vec">
                                      Enviar para o seu layout de produção
                                    </span>
                                  </div>
                                  <Sparkles
                                    size={16}
                                    className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {status !== "processing" && status !== "uploading" && (
                          <div className="effects-selection-area">
                            <h3 className="effects-title">Estilos Rápidos:</h3>
                            <div className="effects-chips-vec">
                              {effectOptions.map((effect) => (
                                <button
                                  key={effect.id}
                                  className={`effect-chip-vec ${selectedEffect === effect.id ? "active" : ""} ${effect.id === "vectorize" ? "highlighted" : ""}`}
                                  onClick={() => setSelectedEffect(effect.id)}
                                >
                                  <span className="effect-chip-icon">
                                    {effect.icon}
                                  </span>
                                  <span className="effect-chip-label">
                                    {effect.label}
                                  </span>
                                </button>
                              ))}
                            </div>

                            {selectedEffect === "custom" && (
                              <div className="observation-field-vec fade-in">
                                <div className="agent-bubble-vec mb-4">
                                  <div className="agent-avatar-vec">
                                    <Sparkles size={24} />
                                  </div>
                                  <div className="agent-text-vec">
                                    <p>
                                      <strong>Gabi:</strong> O que você deseja
                                      criar hoje? Descreva com detalhes e eu
                                      usarei minha inteligência para gerar do
                                      zero!
                                    </p>
                                  </div>
                                </div>
                                <div className="custom-prompt-chat-input-wrapper">
                                  <textarea
                                    value={userPrompt}
                                    onChange={(e) =>
                                      setUserPrompt(e.target.value)
                                    }
                                    placeholder="Ex: 'Um logotipo minimalista...'"
                                    rows={3}
                                    className="custom-prompt-textarea"
                                    disabled={
                                      (status as string) === "processing" ||
                                      (status as string) === "uploading"
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            <button
                              className={cn(
                                "action-btn-vec primary full mt-4 relative group",
                                !selectedEffect &&
                                  "opacity-50 cursor-not-allowed",
                              )}
                              onClick={() => {
                                if (!selectedEffect) {
                                  toast.error(
                                    "Por favor, selecione um estilo antes de continuar.",
                                  );
                                  return;
                                }
                                if (selectedEffect === "custom") {
                                  handleProcess(userPrompt || undefined);
                                } else {
                                  const effect = effectOptions.find(
                                    (e) => e.id === selectedEffect,
                                  );
                                  handleProcess(effect?.prompt || undefined);
                                }
                              }}
                              disabled={(status as string) === "processing"}
                            >
                              <Wand2 size={20} />
                              {resultImage
                                ? "Aplicar Estilo"
                                : "VETORIZAR AGORA"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isRemovingBackground && (
            <AntiTransparencyEditor
              imageUrl={resultImage || originalImage || ""}
              onClose={() => setIsRemovingBackground(false)}
              onSave={handleAntiTransparencySave}
              skipResize={true}
            />
          )}
        </DialogContent>

        <CreditsShopModal
          isOpen={isShopOpen}
          onClose={() => {
            setIsShopOpen(false);
            fetchCredits();
          }}
        />
      </Dialog>
    </>
  );
};
