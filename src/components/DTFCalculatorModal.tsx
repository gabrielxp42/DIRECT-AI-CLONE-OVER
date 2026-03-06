import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, LayoutGrid, Ruler, Layers, ChevronRight, ChevronUp, ChevronDown, Info, HelpCircle, AlertTriangle, Plus, Minus, Maximize2, RotateCcw, RotateCw, RefreshCw, MessageSquare, Share2, Copy, Download, Image as ImageIcon, Loader2, Sparkles, Bot, Settings2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";
import { toPng, toBlob } from 'html-to-image';
import { useIsPlusMode } from "@/hooks/useIsPlusMode";
import { GabiActionDialog } from "@/components/GabiActionDialog";
import { useClientes } from "@/hooks/useDataFetch";
import { useBackgroundTasks } from "@/hooks/useBackgroundTasks";
import { useSession } from "@/contexts/SessionProvider";
import { getValidToken } from "@/utils/tokenGuard";
import { supabase as supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { Check, ChevronsUpDown, Search, User, X } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { packItems2D } from "@/utils/binPacking";
import { WhatsAppButton } from "./WhatsAppButton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { TutorialGuide } from './TutorialGuide';
import { useTour } from '@/hooks/useTour';
import { CALCULADORA_TOUR } from '@/utils/tours';
import { useIsMobile } from '@/hooks/use-mobile';

const itemColors = [
    { bg: "bg-emerald-400/90", border: "border-emerald-600/30", text: "text-emerald-950", dot: "bg-emerald-500", shadow: "rgba(16,185,129,0.4)" },
    { bg: "bg-purple-400/90", border: "border-purple-600/30", text: "text-purple-950", dot: "bg-purple-500", shadow: "rgba(168,85,247,0.4)" },
    { bg: "bg-amber-400/90", border: "border-amber-600/30", text: "text-amber-950", dot: "bg-amber-500", shadow: "rgba(245,158,11,0.4)" },
    { bg: "bg-pink-400/90", border: "border-pink-600/30", text: "text-pink-950", dot: "bg-pink-500", shadow: "rgba(236,72,153,0.4)" },
    { bg: "bg-cyan-400/90", border: "border-cyan-600/30", text: "text-cyan-950", dot: "bg-cyan-500", shadow: "rgba(6,182,212,0.4)" },
    { bg: "bg-rose-400/90", border: "border-rose-600/30", text: "text-rose-950", dot: "bg-rose-500", shadow: "rgba(244,63,94,0.4)" },
    { bg: "bg-indigo-400/90", border: "border-indigo-600/30", text: "text-indigo-950", dot: "bg-indigo-500", shadow: "rgba(99,102,241,0.4)" },
];

interface DTFCalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        imageWidth?: number;
        imageHeight?: number;
        quantity?: number;
        rollWidth?: number;
        calculation_mode?: 'quantity_in_meters' | 'fixed_quantity';
    };
}

// --- Componentes Auxiliares (Definidos fora para evitar re-montagem e perda de foco) ---

const GlassTooltip = ({ children, content }: { children: React.ReactNode, content: string }) => (
    <TooltipProvider>
        <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent portalled={false} className="bg-slate-950/80 backdrop-blur-2xl border border-white/10 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary-custom)]/60" />
                    <span className="tracking-tight uppercase">{content}</span>
                </div>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

const InfoTooltip = ({
    label,
    content,
    id,
    className,
    fieldId,
    hoveredField,
    setHoveredField
}: {
    label: string,
    content: string,
    id?: string,
    className?: string,
    fieldId: string,
    hoveredField: string | null,
    setHoveredField: (id: string | null) => void
}) => (
    <TooltipProvider>
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
                <div
                    className={cn("flex items-start gap-1 cursor-help group w-fit", className)}
                    onMouseEnter={() => setHoveredField(fieldId)}
                    onMouseLeave={() => setHoveredField(null)}>
                    <Label
                        htmlFor={id}
                        className={cn(
                            "text-[11px] leading-tight decoration-dotted underline-offset-4 group-hover:underline transition-all cursor-help",
                            hoveredField === fieldId ? "text-primary underline" : "text-muted-foreground"
                        )}>
                        {label}
                    </Label>
                    <HelpCircle className={cn(
                        "h-3 w-3 mt-0.5 shrink-0 transition-colors",
                        hoveredField === fieldId ? "text-primary" : "text-muted-foreground/50"
                    )} />
                </div>
            </TooltipTrigger>
            <TooltipContent portalled={false} side="top" className="max-w-[200px] bg-slate-950/80 backdrop-blur-2xl border border-white/10 text-white text-[11px] font-medium px-4 py-2.5 rounded-2xl shadow-2xl animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-[0_0_8px_var(--primary-custom)]/60 shrink-0" />
                    <span className="leading-relaxed tracking-tight">{content}</span>
                </div>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

// Componente de Input numérico Cirúrgico V4 - Soft Precision
const NumberInput = ({
    id,
    value,
    onChange,
    min = 0,
    max = 9999,
    step = 1,
    fieldId,
    className = "",
    highlight = false,
    setHoveredField,
    placeholder = "",
    suffix = "",
    showButtons = true
}: {
    id: string,
    value: number | undefined | null,
    onChange: (val: number) => void,
    min?: number,
    max?: number,
    step?: number,
    fieldId: string,
    className?: string,
    highlight?: boolean,
    setHoveredField: (id: string | null) => void,
    placeholder?: string,
    suffix?: string,
    showButtons?: boolean,
    version?: string
}) => {
    const [displayValue, setDisplayValue] = useState<string>(value?.toString() || "");

    useEffect(() => {
        if (value !== undefined && value !== null) {
            const currentDisplayNum = parseFloat(displayValue);
            if (currentDisplayNum !== value || displayValue === "") {
                setDisplayValue(value.toString());
            }
        } else {
            setDisplayValue("");
        }
    }, [value]);

    const increment = () => {
        const currentVal = value || 0;
        const newValue = Math.min(max, Math.round((currentVal + step) * 100) / 100);
        onChange(newValue);
    };

    const decrement = () => {
        const currentVal = value || 0;
        const newValue = Math.max(min, Math.round((currentVal - step) * 100) / 100);
        onChange(newValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(',', '.');
        setDisplayValue(val);
        const num = parseFloat(val);
        if (!isNaN(num)) {
            const clamped = Math.max(min, Math.min(max, num));
            onChange(clamped);
        }
    };

    const handleBlur = () => {
        setHoveredField(null);
        if (displayValue === '') {
            onChange(min);
            setDisplayValue(min.toString());
            return;
        }
        const num = parseFloat(displayValue);
        if (isNaN(num)) {
            setDisplayValue(value?.toString() || min.toString());
        } else {
            const clamped = Math.max(min, Math.min(max, num));
            onChange(clamped);
            setDisplayValue(clamped.toString());
        }
    };

    const isHovered = false; // We use parent's setHoveredField instead

    return (
        <div
            className={cn(
                "relative flex flex-col items-center border rounded-lg transition-all duration-300 overflow-hidden backdrop-blur-sm shadow-sm hover:shadow-md dark:shadow-none",
                "bg-[var(--primary-custom)]/20 dark:bg-zinc-900/60",
                highlight ? "border-primary/40 shadow-[0_0_12px_rgba(255,242,0,0.15)] ring-1 ring-primary/5" : "border-zinc-200/60 dark:border-zinc-800/60",
                "focus-within:border-primary/60 focus-within:shadow-[0_0_15px_rgba(255,242,0,0.2)]",
                className
            )}
            onMouseEnter={() => setHoveredField(fieldId)}
            onMouseLeave={() => setHoveredField(null)}
        >
            {showButtons && (
                <button
                    type="button"
                    onClick={increment}
                    disabled={value !== undefined && value !== null && value >= max}
                    className="w-full h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-20 active:scale-95 touch-manipulation z-20"
                >
                    <ChevronUp className="h-3.5 w-3.5 stroke-[1.5px]" />
                </button>
            )}

            <div className="relative w-full">
                <Input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    value={displayValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    onFocus={(e) => {
                        e.target.select();
                        setHoveredField(fieldId);
                    }}
                    onBlur={handleBlur}
                    className={cn(
                        "h-8 text-center font-black text-base bg-transparent border-none focus-visible:ring-0 shadow-none selection:bg-primary/20 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 !bg-transparent",
                        showButtons ? "py-0" : "py-1"
                    )}
                />
                {suffix && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-black text-zinc-400 dark:text-zinc-600 uppercase pointer-events-none tracking-tighter px-0.5">
                        {suffix}
                    </span>
                )}
            </div>

            {showButtons && (
                <button
                    type="button"
                    onClick={decrement}
                    disabled={value !== undefined && value !== null && value <= min}
                    className="w-full h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-20 active:scale-95 touch-manipulation z-20"
                >
                    <ChevronDown className="h-3.5 w-3.5 stroke-[1.5px]" />
                </button>
            )}
        </div>
    );
};

export const DTFCalculatorModal = ({ isOpen, onClose, initialData }: DTFCalculatorModalProps) => {
    const isMobile = useIsMobile();
    const { canSendDirectly: isPlusMode } = useIsPlusMode();

    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [selectedClienteId, setSelectedClienteId] = useState<string>("");
    const [clienteOpen, setClienteOpen] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

    const { data: clientes = [] } = useClientes();
    const { addTask, updateTask, updateStep } = useBackgroundTasks();
    const { session, profile } = useSession();

    const selectedCliente = useMemo(() =>
        clientes.find(c => c.id === selectedClienteId),
        [clientes, selectedClienteId]);

    // --- MODO RÁPIDO (WIZARD) ---
    type CalculatorMode = 'quick' | 'multi';
    const [mode, setMode] = useState<CalculatorMode>('quick');
    const [quickGoal, setQuickGoal] = useState<'quantity' | 'meters'>('meters'); // 'quantity' = quanto cabe em X metros, 'meters' = quantos metros para X logos
    const [quickMetersInput, setQuickMetersInput] = useState(1);

    // Inputs (Modo Rápido/Simples)
    const [rollWidth, setRollWidth] = useState(58);
    const [imageWidth, setImageWidth] = useState(10);
    const [imageHeight, setImageHeight] = useState(10);
    const [separation, setSeparation] = useState(0.2);
    const [margin, setMargin] = useState(0.2);
    const [quantity, setQuantity] = useState(50);

    // Sync initialData when modal opens
    useEffect(() => {
        if (isOpen && initialData) {
            if (initialData.rollWidth) setRollWidth(initialData.rollWidth);
            if (initialData.imageWidth) setImageWidth(initialData.imageWidth);
            if (initialData.imageHeight) setImageHeight(initialData.imageHeight);
            if (initialData.quantity) {
                if (initialData.calculation_mode === 'quantity_in_meters') {
                    setQuickGoal('quantity');
                    setQuickMetersInput(initialData.quantity);
                } else {
                    setQuickGoal('meters');
                    setQuantity(initialData.quantity);
                }
            }
        }
    }, [isOpen, initialData]);

    // --- MULTI-ITEM MODE ---
    interface MultiItem {
        id: string;
        name: string;
        width: number;
        height: number;
        quantity: number;
        imagesPerRow?: number;
        isOverflowing?: boolean;
        shouldRotate?: boolean;
    }

    const [items, setItems] = useState<MultiItem[]>([
        { id: crypto.randomUUID(), name: 'Item 1', width: 10, height: 10, quantity: 50 }
    ]);
    const [isFillDialogOpen, setIsFillDialogOpen] = useState(false);
    const [activeFillingItemId, setActiveFillingItemId] = useState<string | null>(null);
    const [fillTargetMeters, setFillTargetMeters] = useState(1);

    const { isTourOpen, currentStep, startTour, nextStep, prevStep, closeTour, shouldAutoStart } = useTour(CALCULADORA_TOUR, 'calculadora');

    useEffect(() => {
        if (isOpen && shouldAutoStart) {
            const timer = setTimeout(startTour, 800);
            return () => clearTimeout(timer);
        }
    }, [isOpen, shouldAutoStart, startTour]);

    // Listen for tour-driven mode changes
    useEffect(() => {
        const handleTourMode = (e: any) => {
            if (e.detail === 'simple' || e.detail === 'multi') {
                setMode(e.detail === 'simple' ? 'quick' : 'multi');
            }
        };
        window.addEventListener('tour-set-mode', handleTourMode);
        return () => window.removeEventListener('tour-set-mode', handleTourMode);
    }, []);

    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
            name: `Item ${items.length + 1}`,
            width: 5,
            height: 5,
            quantity: 50
        }]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const updateItem = (id: string, field: keyof MultiItem, value: any) => {
        setItems(prevItems => prevItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const rotateItem = (id: string) => {
        setItems(prevItems => prevItems.map(item =>
            item.id === id ? { ...item, width: item.height, height: item.width } : item
        ));
    };
    // --- END MULTI-ITEM MODE ---

    const handleShareWhatsApp = () => {
        setActionDialogOpen(true);
    };

    const handleConfirmWhatsAppSend = async (message: string) => {
        if (!selectedCliente && !selectedClienteId) {
            showError("Selecione um cliente para enviar o orçamento.");
            return;
        }

        const phone = (selectedCliente?.telefone || '').replace(/\D/g, '');
        if (!phone) {
            showError("O cliente selecionado não possui um telefone cadastrado.");
            return;
        }

        const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
        setActionDialogOpen(false);
        setIsSendingWhatsApp(true);

        const steps = [
            { id: 'text-send', label: 'Enviar Orçamento', status: 'pending' as const }
        ];

        const taskId = addTask({
            title: `Orçamento DTF`,
            description: `Enviando para ${selectedCliente?.nome || 'Cliente'}`,
            status: 'processing',
            progress: 0,
            steps
        });

        try {
            updateStep(taskId, 'text-send', 'loading');
            updateTask(taskId, { progress: 30 });

            const validToken = await getValidToken();
            const effectiveToken = validToken || session?.access_token;

            const resp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveToken}`,
                    'apikey': SUPABASE_ANON_KEY
                },
                body: JSON.stringify({
                    action: 'send-message',
                    phone: formattedPhone,
                    message: message
                })
            });

            const result = await resp.json();
            if (!resp.ok || result?.error) {
                throw new Error(result?.message || 'Falha ao enviar orçamento');
            }

            updateStep(taskId, 'text-send', 'completed');
            updateTask(taskId, { progress: 100, status: 'completed' });
            showSuccess("Orçamento enviado para a fila de processamento!");

        } catch (error: any) {
            console.error("Erro ao enviar WhatsApp:", error);
            updateStep(taskId, 'text-send', 'error');
            updateTask(taskId, { status: 'error', error: error.message });
            showError(`Erro ao enviar: ${error.message}`);
        } finally {
            setIsSendingWhatsApp(false);
        }
    };
    // UX State
    const [hoveredField, setHoveredField] = useState<string | null>(null);
    const [targetMeters, setTargetMeters] = useState<number>(0);
    const [isExporting, setIsExporting] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);

    const aiTips = [
        "Gere orçamentos sem precisar montar arquivo! ✨",
        "Quer saber quantas logos cabem no metro? 🧠",
        "Ajuste as margens para simular o sangramento real. 🎯",
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTipIndex((prev) => (prev + 1) % aiTips.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [aiTips.length]);

    // Results calculation
    const results = useMemo(() => {
        const usableWidth = rollWidth - (margin * 2);
        const totalImageWidth = imageWidth + separation;
        const totalImageHeight = imageHeight + separation;

        const imagesPerRow = Math.max(1, Math.floor((usableWidth + separation) / totalImageWidth));

        // Se estiver no modo "Quanto cabe em X metros", recalcula a quantidade
        let finalQuantity = quantity;
        if (mode === 'quick' && quickGoal === 'quantity') {
            const usableHeight = (quickMetersInput * 100) - (margin * 2);
            const totalRows = Math.floor((usableHeight + separation) / totalImageHeight);
            finalQuantity = Math.max(1, totalRows * imagesPerRow);
        }

        const totalRows = Math.ceil(finalQuantity / imagesPerRow);

        // Altura real do conteúdo = (linhas * altura_logo) + (espaços entre linhas)
        const contentHeight = totalRows > 0
            ? (totalRows * imageHeight) + ((totalRows - 1) * separation)
            : 0;
        const totalHeightCm = contentHeight + (margin * 2);
        const totalMeters = totalHeightCm / 100;

        // Proteção contra divisão por zero
        const safeImageHeight = Math.max(0.1, imageHeight);
        const imagesPerMeter = (100 / (safeImageHeight + separation)) * imagesPerRow;
        const currentContentWidth = (imagesPerRow * imageWidth) + ((imagesPerRow - 1) * separation);

        // Eficiência baseada em ÁREA (unificada com o modo multi-item)
        const totalInkArea = finalQuantity * imageWidth * imageHeight;
        const totalMaterialArea = rollWidth * totalHeightCm;
        const efficiency = totalMaterialArea > 0 ? (totalInkArea / totalMaterialArea) * 100 : 0;

        // Sobra lateral real (Margem configurada + espaço vazio que sobrou por não caber mais uma logo)
        const realSideMargin = (rollWidth - currentContentWidth) / 2;

        // Preview rendering values
        const previewLimit = 200;
        const previewQuantity = Math.min(previewLimit, finalQuantity);
        const previewRows = Math.ceil(previewQuantity / imagesPerRow);
        const hasWarning = finalQuantity > previewLimit;

        const previewContentHeight = previewRows > 0
            ? (previewRows * imageHeight) + ((previewRows - 1) * separation)
            : 0;
        const previewTotalHeightCm = previewContentHeight + (margin * 2);

        return {
            imagesPerRow,
            totalRows,
            totalMeters,
            imagesPerMeter: Math.max(0, parseFloat(imagesPerMeter.toFixed(1))),
            efficiency: Math.max(0, Math.min(100, Math.round(efficiency))),
            usableWidth,
            contentHeight,
            contentWidth: currentContentWidth,
            realSideMargin,
            totalHeightCm,
            previewContentHeight,
            previewTotalHeightCm,
            hasWarning,
            finalQuantity
        };
    }, [rollWidth, imageWidth, imageHeight, separation, margin, quantity, mode, quickGoal, quickMetersInput]);

    // Multi-Item Results calculation (2D Bin Packing Engine)
    const multiResults = useMemo(() => {
        const usableWidth = rollWidth - (margin * 2);
        const previewLimit = 200; // Limit rendering for performance

        // Mapeia os itens do formato local para o formato do algoritmo
        const itemsToPack = items.map((i, index) => ({
            ...i,
            allowRotation: false, // Disabling auto-rotation to preserve row alignment
            originalIndex: index // Keep track to assign colors later
        }));

        // Executa o empacotamento cirúrgico 2D MaxRects
        const packedData = packItems2D(usableWidth, separation, itemsToPack);

        const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
        const hasWarning = totalQuantity > previewLimit;

        // Preview rendering limit (para não explodir a DOM React)
        const previewPlacedItems = packedData.placedItems.slice(0, previewLimit);

        // Calcular a altura ocupada especificamente pelos itens visualizados
        let previewContentHeightCm = 0;
        if (previewPlacedItems.length > 0) {
            previewContentHeightCm = Math.max(...previewPlacedItems.map(i => i.y + i.packHeight)) - separation;
            if (previewContentHeightCm < 0) previewContentHeightCm = 0;
        }

        const totalHeightCm = packedData.totalHeightCm + (margin * 2);
        const previewTotalHeightCm = previewContentHeightCm > 0 ? previewContentHeightCm + (margin * 2) : 0;
        const totalMeters = packedData.totalHeightCm / 100;

        // Efficiency (Area-based)
        const totalInkArea = items.reduce((acc, item) => acc + (item.width * item.height * item.quantity), 0);
        const totalMaterialArea = rollWidth * totalHeightCm;
        const efficiency = totalMaterialArea > 0 ? (totalInkArea / totalMaterialArea) * 100 : 0;

        // Legado compatibility (para handleTargetMeters não dar quebra inesperada)
        const itemsWithLegacyProps = items.map(item => {
            const imagesPerRow = Math.max(1, Math.floor((usableWidth + separation) / (item.width + separation)));
            const isOverflowing = item.width > usableWidth && item.height > usableWidth;
            const shouldRotate = item.width > usableWidth && item.height <= usableWidth;
            return { ...item, imagesPerRow, isOverflowing, shouldRotate };
        });

        const realSideMargin = (rollWidth - packedData.contentWidth) / 2;

        return {
            items: itemsWithLegacyProps,
            placedItems: packedData.placedItems,
            previewPlacedItems,
            totalMeters: Math.max(0, totalMeters),
            totalQuantity,
            totalHeightCm,
            previewTotalHeightCm,
            usableWidth,
            hasWarning,
            totalItemsOverflowing: packedData.totalItemsOverflowing,
            itemsToOptimize: packedData.itemsToOptimize,
            efficiency: Math.round(efficiency),
            contentWidth: packedData.contentWidth,
            realSideMargin
        };
    }, [rollWidth, margin, separation, items]);

    const visualTotalHeightCm = useMemo(() => {
        if (isExporting) return mode === 'quick' ? results.totalHeightCm : multiResults.totalHeightCm;
        return mode === 'quick' ? results.previewTotalHeightCm : multiResults.previewTotalHeightCm;
    }, [isExporting, mode, results, multiResults]);

    const handleTargetMetersChange = (meters: number, itemId?: string) => {
        setTargetMeters(meters);
        if (meters <= 0) return;

        if (mode === 'quick') {
            const usableHeight = (meters * 100) - (margin * 2);
            if (usableHeight <= 0) return;
            const rowHeightWithGap = imageHeight + separation;
            const totalRows = Math.floor((usableHeight + separation) / rowHeightWithGap);

            if (totalRows > 0) {
                const newQuantity = totalRows * results.imagesPerRow;
                setQuantity(newQuantity);
            }
        } else if (itemId) {
            const item = multiResults.items.find(i => i.id === itemId);
            if (item) {
                const targetHeightCm = meters * 100;
                const rowHeightWithGap = item.height + separation;
                const totalRows = Math.floor((targetHeightCm + separation) / rowHeightWithGap);
                if (totalRows > 0) {
                    const newQuantity = totalRows * item.imagesPerRow;
                    updateItem(itemId, 'quantity', newQuantity);
                }
            }
        }
    };

    const generateQuoteSummary = () => {
        const companyName = profile?.company_name ? ` ${profile.company_name}` : "";

        if (mode === 'quick') {
            const itemsPerRowText = results.imagesPerRow === 1 ? '1 item por fileira' : `${results.imagesPerRow} itens por fileira`;

            if (quickGoal === 'meters') {
                return `🌟 *Orçamento${companyName}*\n\n` +
                    `Vi aqui que em *${quickMetersInput} metros* de rolo (${rollWidth}cm), conseguimos encaixar *${results.finalQuantity} unidades* da sua logo de ${imageWidth}x${imageHeight}cm.\n\n` +
                    `Ficou bem otimizado: cabem *${itemsPerRowText}* e tivemos *${results.efficiency}%* de aproveitamento do material. 🚀`;
            } else {
                return `🌟 *Orçamento${companyName}*\n\n` +
                    `Para produzir as *${results.finalQuantity} unidades* que você precisa (${imageWidth}x${imageHeight}cm), vamos usar *${results.totalMeters.toFixed(2)} metros* do rolo de ${rollWidth}cm.\n\n` +
                    `Na organização que fiz, couberam *${itemsPerRowText}* com um aproveitamento de *${results.efficiency}%*. Ficou ótimo! ✨`;
            }
        }

        const itemsCount = multiResults.items.filter(i => i.quantity > 0).length;
        return `🌟 *Orçamento${companyName} (Mix de Itens)*\n\n` +
            `Fiz a otimização dos seus *${itemsCount} itens* diferentes e chegamos a um total de *${multiResults.totalQuantity} logos*.\n\n` +
            `Para produzir tudo isso, vamos precisar de *${multiResults.totalMeters.toFixed(2)} metros* linear (rolo de ${rollWidth}cm).\n\n` +
            `O aproveitamento total do material foi de *${multiResults.efficiency}%*. 🚀`;
    };

    const handleCopyToClipboard = () => {
        const text = generateQuoteSummary();
        navigator.clipboard.writeText(text);
        showSuccess("Orçamento copiado para a área de transferência!");
    };


    const handleDownloadImage = async () => {
        if (!previewRef.current) return;
        setIsExporting(true);
        try {
            // Pequeno delay para garantir que o DOM está pronto e estilos aplicados
            await new Promise(resolve => setTimeout(resolve, 100));

            // Ajustar qualidade baseado no tamanho para evitar crash
            const isVeryLarge = visualTotalHeightCm > 300;

            const dataUrl = await toPng(previewRef.current, {
                backgroundColor: '#ffffff',
                quality: 0.95,
                pixelRatio: isVeryLarge ? 1.5 : 2
            });
            const link = document.createElement('a');
            const filename = mode === 'quick'
                ? `orcamento-dtf-${results.finalQuantity}un-${imageWidth}x${imageHeight}cm.png`
                : `orcamento-dtf-multi-${multiResults.totalQuantity}itens-${multiResults.totalMeters.toFixed(2)}m.png`;
            link.download = filename;
            link.href = dataUrl;
            link.click();
            showSuccess("Imagem do preview baixada com sucesso!");
        } catch (err) {
            console.error('Erro ao exportar imagem:', err);
            showError("Não foi possível gerar a imagem do preview.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopyImageToClipboard = async () => {
        if (!previewRef.current) return;
        setIsExporting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const blob = await toBlob(previewRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 2
            });
            if (blob) {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);
                showSuccess("Imagem copiada! Agora é só colar (Ctrl+V) no WhatsApp.");
            }
        } catch (err) {
            console.error('Erro ao copiar imagem:', err);
            showError("Seu navegador não suporta copiar imagens diretamente.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent
                    onPointerDownOutside={(e) => isTourOpen && e.preventDefault()}
                    onInteractOutside={(e) => isTourOpen && e.preventDefault()}
                    onEscapeKeyDown={(e) => isTourOpen && e.preventDefault()}
                    className={cn(
                        "max-h-[96vh] overflow-hidden transition-all duration-300 flex flex-col",
                        // Liquid Glass Base
                        "bg-white/90 dark:bg-slate-950/80 backdrop-blur-2xl backdrop-saturate-150",
                        // Borders and Shadows
                        "border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                        // Internal Gloss
                        "before:absolute before:inset-0 before:bg-gradient-to-tr before:from-white/10 before:to-transparent before:pointer-events-none",
                        isMobile ? "max-w-[100vw] w-full p-3 pb-safe rounded-[2rem] h-[95vh]" : "max-w-[95vw] w-[1152px] h-[850px] [@media(min-width:1024px)_and_(max-height:950px)]:[zoom:0.9] [@media(min-width:1024px)_and_(max-height:850px)]:[zoom:0.85] [@media(min-width:1024px)_and_(max-height:750px)]:[zoom:0.8] p-4 lg:p-5 rounded-3xl"
                    )}
                >
                    <DialogHeader className="space-y-1.5">
                        <div id="calculator-title" className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-primary" />
                                <DialogTitle className="text-xl font-bold tracking-tight text-slate-950 dark:text-primary">Calculadora de Orçamento DTF</DialogTitle>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={startTour}
                                className="text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 gap-1.5 rounded-full px-2.5 py-1 h-7 animate-in fade-in slide-in-from-right-2 duration-700">
                                <HelpCircle className="h-3.5 w-3.5" /> Aprenda a usar
                            </Button>
                        </div>
                        <DialogDescription className="text-slate-600 dark:text-slate-400 text-[10px] hidden lg:block">
                            Simule o aproveitamento das suas imagens no rolo e calcule a metragem necessária.
                        </DialogDescription>
                        <div className="flex items-center gap-1.5 mt-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-full w-fit border border-slate-200 dark:border-slate-700/50 shadow-sm animate-in slide-in-from-bottom-2 duration-500">
                            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 animate-pulse" />
                            <span className="text-[10px] text-slate-700 dark:text-slate-200 font-bold" key={currentTipIndex}>
                                {aiTips[currentTipIndex]}
                            </span>
                        </div>
                    </DialogHeader>

                    {/* Mode Toggle */}
                    <div id="calculator-mode-switch" className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit mt-1.5">
                        <button
                            onClick={() => {
                                setMode('quick');
                            }}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                                mode === 'quick'
                                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}>
                            <Sparkles className="h-3.5 w-3.5" /> Modo Rápido
                        </button>
                        <button
                            onClick={() => setMode('multi')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                                mode === 'multi'
                                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}>
                            <Layers className="h-3.5 w-3.5" /> Múltiplos Itens
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 h-full items-start overflow-y-auto md:overflow-hidden custom-scrollbar pr-1 -mr-1">
                            {/* Formulário - 5 colunas */}
                            <div id="calculator-material-settings" className="md:col-span-4 lg:col-span-5 space-y-4 overflow-y-auto h-auto md:h-full custom-scrollbar pr-1 md:pr-4 pb-20 md:pb-10">
                                {mode === 'quick' ? (
                                    <Card className="border-primary/20 bg-white/40 dark:bg-primary/5 backdrop-blur-md shadow-sm flex flex-col overflow-hidden">
                                        <div className="p-3 lg:p-4 flex-1 space-y-3">
                                            {/* SEÇÃO 1: Largura do Material */}
                                            <div className="space-y-1.5">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                        <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-black">1</div>
                                                        Largura da Folha (Rolo)
                                                    </h3>
                                                </div>
                                                <div className="space-y-2">
                                                    <NumberInput
                                                        id="quickRollWidth"
                                                        value={rollWidth}
                                                        onChange={setRollWidth}
                                                        min={10}
                                                        max={120}
                                                        step={1}
                                                        fieldId="rollWidth"
                                                        suffix="cm"
                                                        showButtons={false}
                                                        className="w-full"
                                                        setHoveredField={setHoveredField}
                                                    />
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[30, 58].map((w) => (
                                                            <button
                                                                key={w}
                                                                onClick={() => setRollWidth(w)}
                                                                className={cn(
                                                                    "py-1.5 rounded-lg text-[10px] font-black transition-all border",
                                                                    rollWidth === w
                                                                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                                                        : "bg-[var(--primary-custom)]/5 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                                                                )}>
                                                                {w}CM {w === 58 ? '(PADRÃO)' : '(PEQUENO)'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator className="bg-primary/5" />

                                            {/* SEÇÃO 2: Tamanho da Logo */}
                                            <div className="space-y-1.5">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                        <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-black">2</div>
                                                        Tamanho do Adesivo
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] uppercase font-black text-slate-400">Largura (cm)</Label>
                                                        <NumberInput
                                                            id="quickWidth"
                                                            value={imageWidth}
                                                            onChange={setImageWidth}
                                                            min={0.5}
                                                            max={rollWidth - 2}
                                                            step={0.1}
                                                            fieldId="imageSize"
                                                            showButtons={false}
                                                            className="w-full"
                                                            setHoveredField={setHoveredField}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[9px] uppercase font-black text-slate-400">Altura (cm)</Label>
                                                        <NumberInput
                                                            id="quickHeight"
                                                            value={imageHeight}
                                                            onChange={setImageHeight}
                                                            min={0.5}
                                                            max={100}
                                                            step={0.1}
                                                            fieldId="imageSize"
                                                            showButtons={false}
                                                            className="w-full"
                                                            setHoveredField={setHoveredField}
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const tmp = imageWidth;
                                                        setImageWidth(imageHeight);
                                                        setImageHeight(tmp);
                                                    }}
                                                    className="w-full h-7 text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/5 rounded-lg border border-primary/10 gap-1.5">
                                                    <RefreshCw className="h-3 w-3" /> Girar 90°
                                                </Button>
                                            </div>

                                            <Separator className="bg-primary/5" />

                                            {/* SEÇÃO 3: Objetivo */}
                                            <div className="space-y-1.5 pb-1">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                                        <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-black">3</div>
                                                        O que deseja calcular?
                                                    </h3>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => setQuickGoal('meters')}
                                                        className={cn(
                                                            "p-2 rounded-xl border-2 transition-all flex flex-col items-center text-center gap-1 min-h-[60px] justify-center",
                                                            quickGoal === 'meters' ? "border-primary bg-primary/10" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                                                        )}>
                                                        <Ruler className={cn("h-4 w-4", quickGoal === 'meters' ? "text-primary" : "text-slate-400")} />
                                                        <div className={cn("font-black text-[9px] leading-tight", quickGoal === 'meters' ? "text-slate-900 dark:text-white" : "text-slate-500")}>Saber metragem de material</div>
                                                    </button>

                                                    <button
                                                        onClick={() => setQuickGoal('quantity')}
                                                        className={cn(
                                                            "p-3 rounded-xl border-2 transition-all flex flex-col items-center text-center gap-1 min-h-[80px] justify-center",
                                                            quickGoal === 'quantity' ? "border-primary bg-primary/10" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                                                        )}>
                                                        <Layers className={cn("h-4 w-4", quickGoal === 'quantity' ? "text-primary" : "text-slate-400")} />
                                                        <div className={cn("font-black text-[9px] leading-tight", quickGoal === 'quantity' ? "text-slate-900 dark:text-white" : "text-slate-500")}>Saber quantas logos no metro</div>
                                                    </button>
                                                </div>

                                                <div className="mt-2 space-y-4">
                                                    {quickGoal === 'meters' ? (
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] uppercase font-black text-primary">Quantas logos no total?</Label>
                                                            <NumberInput
                                                                id="quickQuantity"
                                                                value={quantity}
                                                                onChange={setQuantity}
                                                                min={1}
                                                                max={10000}
                                                                step={10}
                                                                fieldId="quantity"
                                                                className="w-full text-xl font-black"
                                                                setHoveredField={setHoveredField}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] uppercase font-black text-primary">Quantos metros de rolo?</Label>
                                                            <NumberInput
                                                                id="quickMeters"
                                                                value={quickMetersInput}
                                                                onChange={setQuickMetersInput}
                                                                min={0.5}
                                                                max={50}
                                                                step={0.5}
                                                                fieldId="meters"
                                                                suffix="m"
                                                                className="w-full text-xl font-black"
                                                                setHoveredField={setHoveredField}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Configurações Simplificadas de Margem e Espaço (Botões Únicos) */}
                                        <div className="px-4 py-3 bg-slate-100/50 dark:bg-slate-800/20 border-t border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center justify-between mb-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                                    Ajustes de Impressão
                                                </Label>
                                                <InfoTooltip
                                                    fieldId="printAdjust"
                                                    label="Ajuda"
                                                    content="Econômico (M:0.2cm, E:0.2cm) | Padrão (M:0.5cm, E:0.4cm) | Folgado (M:1.0cm, E:0.6cm)"
                                                    hoveredField={hoveredField}
                                                    setHoveredField={setHoveredField}
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: 'Econômico', m: 0.2, s: 0.2 },
                                                    { label: 'Padrão', m: 0.5, s: 0.4 },
                                                    { label: 'Folgado', m: 1.0, s: 0.6 }
                                                ].map((config) => (
                                                    <button
                                                        key={config.label}
                                                        onClick={() => {
                                                            setMargin(config.m);
                                                            setSeparation(config.s);
                                                        }}
                                                        className={cn(
                                                            "py-2 px-1 rounded-xl text-[10px] font-black transition-all",
                                                            (margin === config.m && separation === config.s)
                                                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                                                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                                                        )}>
                                                        {config.label.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>
                                ) : (
                                    <Card className="border-primary/20 bg-white/40 dark:bg-primary/5 backdrop-blur-md shadow-sm">
                                        <CardContent className="p-3 space-y-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground flex items-center justify-between tracking-wider">
                                                    <div className="flex items-center gap-1">
                                                        <Settings2 className="h-3 w-3 text-primary" /> Configurações do Rolo
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        {[
                                                            { label: 'Eco', m: 0.2, s: 0.2 },
                                                            { label: 'Padrão', m: 0.5, s: 0.4 },
                                                            { label: 'Folgado', m: 1.0, s: 0.6 }
                                                        ].map((config) => (
                                                            <button
                                                                key={config.label}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setMargin(config.m);
                                                                    setSeparation(config.s);
                                                                }}
                                                                className={cn(
                                                                    "text-[9px] font-black transition-all hover:text-primary",
                                                                    (margin === config.m && separation === config.s)
                                                                        ? "text-primary underline underline-offset-4"
                                                                        : "text-slate-400"
                                                                )}>
                                                                {config.label.toUpperCase()}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </Label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1 p-0.5">
                                                        <div className="min-h-[28px] flex items-end pb-1">
                                                            <InfoTooltip
                                                                id="rollWidth"
                                                                fieldId="rollWidth"
                                                                label="Largura do Rolo (cm)"
                                                                content="A largura útil do rolo de DTF que você está usando (comum: 30cm ou 58cm)."
                                                                hoveredField={hoveredField}
                                                                setHoveredField={setHoveredField}
                                                            />
                                                        </div>
                                                        <NumberInput
                                                            id="rollWidth"
                                                            value={rollWidth}
                                                            onChange={setRollWidth}
                                                            min={20}
                                                            max={120}
                                                            step={1}
                                                            fieldId="rollWidth"
                                                            showButtons={true}
                                                            setHoveredField={setHoveredField}
                                                        />
                                                        <div className="flex gap-1 pt-1">
                                                            {[30, 58].map((w) => (
                                                                <Button
                                                                    key={w}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={`h-7 text-[10px] flex-1 touch-manipulation transition-all ${rollWidth === w ? 'bg-primary border-primary/50 text-primary-foreground font-bold shadow-md' : 'text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    onClick={() => setRollWidth(w)}>
                                                                    {w}cm
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {/* Configuração de Margens de Segurança */}
                                                    <div className="space-y-1 p-0.5">
                                                        <div className="min-h-[28px] flex items-end pb-1">
                                                            <InfoTooltip
                                                                id="margin"
                                                                fieldId="margin"
                                                                label="Margem de Segurança (cm)"
                                                                content="Espaço de segurança nas bordas (topo, fundo e laterais)."
                                                                hoveredField={hoveredField}
                                                                setHoveredField={setHoveredField}
                                                            />
                                                        </div>
                                                        <NumberInput
                                                            id="margin"
                                                            value={margin}
                                                            onChange={setMargin}
                                                            min={0}
                                                            max={10}
                                                            step={0.5}
                                                            fieldId="margin"
                                                            showButtons={true}
                                                            highlight={hoveredField === 'margin'}
                                                            setHoveredField={setHoveredField}
                                                        />
                                                        <div className="flex gap-1 pt-1">
                                                            {[0.2, 0.5, 1.0].map((m) => (
                                                                <Button
                                                                    key={m}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={`h-7 flex-1 text-[10px] uppercase font-bold transition-all ${margin === m ? 'bg-primary border-primary/50 text-primary-foreground font-bold shadow-md' : 'text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    onClick={() => setMargin(m)}>
                                                                    {m}cm
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator className="bg-primary/10" />

                                            <div id="calculator-main-input" className="space-y-4">
                                                <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground flex items-center gap-1 tracking-wider">
                                                    <Layers className="h-3 w-3 text-primary" /> Itens do Orçamento
                                                </Label>

                                                {/* Item List */}
                                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {multiResults.items.map((item, index) => (
                                                        <div
                                                            key={item.id}
                                                            className={cn(
                                                                "p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border space-y-2 shadow-sm transition-all duration-300",
                                                                item.isOverflowing ? "border-red-500/50 bg-red-500/5" : "border-slate-200 dark:border-slate-700",
                                                                item.shouldRotate ? "ring-2 ring-primary/30 border-primary/40" : ""
                                                            )}>
                                                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                                                                <div className="flex items-center gap-2 flex-1 mr-2">
                                                                    <span className="text-[10px] font-black text-slate-400 bg-slate-200 dark:bg-slate-700 w-5 h-5 rounded-md flex items-center justify-center shrink-0">
                                                                        {index + 1}
                                                                    </span>
                                                                    <Input
                                                                        value={item.name}
                                                                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                                        className="h-7 text-[10px] font-black uppercase bg-transparent border-none p-0 focus-visible:ring-0 text-slate-700 dark:text-slate-200 focus:text-primary transition-colors"
                                                                        placeholder="Nome do Item"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-1.5 ml-auto">
                                                                    {item.shouldRotate && (
                                                                        <Badge variant="outline" className="h-6 bg-primary/10 text-primary border-primary/20 text-[8px] font-black animate-pulse">
                                                                            <Sparkles className="h-2 w-2 mr-1" /> OTIMIZAR
                                                                        </Badge>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={cn(
                                                                            "h-8 w-8 transition-all duration-300 rounded-lg",
                                                                            item.width < item.height ? "text-primary bg-primary/10" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700",
                                                                            item.shouldRotate && "bg-primary/20 text-primary ring-2 ring-primary/50"
                                                                        )}
                                                                        onClick={() => rotateItem(item.id)}>
                                                                        <RotateCw className={cn("h-4 w-4 transition-transform duration-500", item.width < item.height && "rotate-180")} />
                                                                    </Button>
                                                                    <div className="w-px h-4 bg-slate-200 dark:border-slate-700 mx-0.5" />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                        onClick={() => removeItem(item.id)}
                                                                        disabled={items.length <= 1}>
                                                                        <Minus className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {item.isOverflowing && (
                                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md animate-pulse">
                                                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">Item não cabe no rolo com as margens!</span>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-2 gap-2">
                                                                {/* Tamanho */}
                                                                <div className="space-y-1">
                                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tamanho (cm)</Label>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <NumberInput
                                                                            id={`width-${item.id}`}
                                                                            value={item.width}
                                                                            onChange={(val) => updateItem(item.id, 'width', val)}
                                                                            min={0.5}
                                                                            max={50}
                                                                            step={0.5}
                                                                            fieldId="itemWidth"
                                                                            showButtons={true}
                                                                            placeholder="L"
                                                                            className="flex-1"
                                                                            setHoveredField={setHoveredField}
                                                                        />
                                                                        <div className="w-2 h-0.5 bg-slate-300 shrink-0" />
                                                                        <NumberInput
                                                                            id={`height-${item.id}`}
                                                                            value={item.height}
                                                                            onChange={(val) => updateItem(item.id, 'height', val)}
                                                                            min={0.5}
                                                                            max={50}
                                                                            step={0.5}
                                                                            fieldId="itemHeight"
                                                                            showButtons={true}
                                                                            placeholder="A"
                                                                            className="flex-1"
                                                                            setHoveredField={setHoveredField}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Qtd</Label>
                                                                        <button
                                                                            onClick={() => {
                                                                                setActiveFillingItemId(item.id);
                                                                                setIsFillDialogOpen(true);
                                                                            }}
                                                                            id="calculator-item-actions"
                                                                            className="text-[9px] font-black text-primary hover:underline flex items-center gap-0.5">
                                                                            <Maximize2 className="h-2 w-2" /> PREENCHER
                                                                        </button>
                                                                    </div>
                                                                    <NumberInput
                                                                        id={`quantity-${item.id}`}
                                                                        value={item.quantity}
                                                                        onChange={(val) => updateItem(item.id, 'quantity', val)}
                                                                        min={1}
                                                                        max={10000}
                                                                        step={1}
                                                                        fieldId="itemQuantity"
                                                                        showButtons={true}
                                                                        highlight={true}
                                                                        className="w-full"
                                                                        setHoveredField={setHoveredField}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                    <GlassTooltip content="Adicionar um novo tamanho de logo">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex-1 h-9 text-xs border-dashed border-primary/30 text-primary hover:bg-primary/5 font-bold rounded-xl"
                                                            onClick={addItem}>
                                                            <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                                                        </Button>
                                                    </GlassTooltip>
                                                </div>

                                                {/* Separation (shared across all items) */}
                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[10px] text-slate-500">Espaço entre logos:</Label>
                                                        <div className="flex gap-1">
                                                            {[0.2, 0.4, 0.6].map((s) => (
                                                                <Button
                                                                    key={s}
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={`h-6 px-2 text-[10px] ${separation === s ? 'bg-yellow-600 border-yellow-700 text-white font-bold' : 'text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    onClick={() => setSeparation(s)}>
                                                                    {s}cm
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>



                                        </CardContent>
                                    </Card>
                                )}

                                {/* Alerta de Erro se não couber */}
                                {imageWidth + (margin * 2) > rollWidth && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-500">
                                        <Info className="h-4 w-4" />
                                        <span className="text-xs font-bold">Erro: A logo não cabe na largura do rolo com essas margens!</span>
                                    </div>
                                )}

                                {/* Resultados Rápidos - Layout Grid Profissional */}
                                <div className="space-y-2.5 pt-1">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className={cn(
                                            "p-3 bg-primary text-primary-foreground rounded-2xl shadow-xl shadow-primary/20 ring-4 ring-primary/10 flex flex-col items-center justify-center text-center transition-all hover:scale-[1.02]",
                                        )}>
                                            <span className="text-[9px] uppercase font-bold opacity-90 tracking-wider">
                                                {mode === 'quick' && quickGoal === 'quantity' ? "Metragem Alvo" : "Metragem total"}
                                            </span>
                                            <span className={cn("font-black tracking-tight", isMobile ? "text-xl" : "text-xl")}>
                                                {(mode === 'quick' ? results.totalMeters : multiResults.totalMeters).toFixed(2)}m
                                            </span>
                                            <span className="text-[8px] font-black opacity-60 uppercase tracking-tighter mt-0.5">
                                                Custo Est: R${((mode === 'quick' ? results.totalMeters : multiResults.totalMeters) * 50).toFixed(2)}
                                            </span>
                                        </div>

                                        {mode === 'quick' && quickGoal === 'quantity' ? (
                                            <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-500/10 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                                                <span className="text-[9px] uppercase font-bold opacity-90 tracking-wider">Total de Itens</span>
                                                <span className={cn("font-black tracking-tight", isMobile ? "text-2xl" : "text-2xl")}>
                                                    {results.finalQuantity} <span className="text-sm font-bold opacity-70">un</span>
                                                </span>
                                            </div>
                                        ) : (
                                            <div id="calculator-efficiency-badge" className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center">
                                                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                                                    Eficiência
                                                </span>
                                                <span className={cn("font-black tracking-tight", isMobile ? "text-xl" : "text-xl")}>
                                                    {mode === 'quick' ? results.efficiency : multiResults.efficiency}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Resumo da Gabi - Estilo Oficial do Dashboard */}
                                    <div className="relative group rounded-xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-sm shadow-purple-500/10 animate-in slide-in-from-bottom-2 duration-500">
                                        <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-sm rounded-xl" />
                                        <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-[10px] p-2.5 flex gap-2.5 items-start">
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#ffd93d] flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
                                                <Bot className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                                                    Resumo da Gabi
                                                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-[8px] text-white/60">GABI AI</span>
                                                </div>
                                                <div className="text-[12px] text-zinc-300 leading-relaxed font-medium">
                                                    {mode === 'quick' ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            {quickGoal === 'meters' ? (
                                                                <span>Dentro de <strong className="text-white font-black">{quickMetersInput} metros</strong> couberam <strong className="text-white font-black">{results.finalQuantity} unidades</strong> de {imageWidth}x{imageHeight}cm.</span>
                                                            ) : (
                                                                <span>Para imprimir <strong className="text-white font-black">{results.finalQuantity} unidades</strong>, você vai precisar de <strong className="text-white font-black">{results.totalMeters.toFixed(2)}m</strong>.</span>
                                                            )}
                                                            <span className="opacity-80">Couberam <strong className="text-white font-black">{results.imagesPerRow} {results.imagesPerRow === 1 ? 'item' : 'itens'}</strong> por fileira com <strong className="text-white font-black">{results.efficiency}%</strong> de aproveitamento.</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1.5">
                                                            <span>Otimizei <strong className="text-white font-black">{multiResults.items.filter(i => i.quantity > 0).length} itens</strong> diferentes ({multiResults.totalQuantity} logos totais).</span>
                                                            <span>Produção total de <strong className="text-white font-black">{multiResults.totalMeters.toFixed(2)}m</strong> com <strong className="text-white font-black">{multiResults.efficiency}%</strong> de aproveitamento.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleShareWhatsApp}
                                        disabled={isSendingWhatsApp || (mode === 'quick' ? imageWidth + (margin * 2) > rollWidth : multiResults.totalItemsOverflowing > 0)}
                                        className={cn(
                                            "w-full h-12 text-[11px] rounded-xl font-black bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl shadow-purple-500/10 border-0 hover:brightness-110 hover:scale-[1.02] transition-all group relative overflow-hidden",
                                            isSendingWhatsApp && "opacity-50 grayscale cursor-not-allowed"
                                        )}
                                    >
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        <span className="relative z-10 tracking-widest uppercase">
                                            Compartilhar Orçamento
                                        </span>
                                    </Button>

                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5 rounded-xl gap-2"
                                            onClick={handleCopyToClipboard}>
                                            <Copy className="h-3.5 w-3.5" /> Copiar Resumo
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5 rounded-xl gap-2"
                                            onClick={handleDownloadImage}>
                                            <Download className="h-3.5 w-3.5" /> Baixar Imagem
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Área de Preview (Lado Direito) - 7 colunas */}
                            <div className={cn(
                                "md:col-span-7 flex flex-col h-full min-h-[500px] md:min-h-0",
                                !isMobile && "sticky top-0"
                            )}>
                                <div className={cn(
                                    "h-full flex flex-col bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-y-auto custom-scrollbar shadow-inner relative",
                                    isFullscreenPreview && "fixed inset-0 z-[100] m-0 rounded-none bg-slate-950"
                                )}>
                                    {isFullscreenPreview && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="absolute top-4 right-4 z-[110] rounded-full bg-slate-900 border-white/20 text-white"
                                            onClick={() => setIsFullscreenPreview(false)}>
                                            <Plus className="h-5 w-5 rotate-45" />
                                        </Button>
                                    )}

                                    {/* Header Minimalista (Ruler Externo Tipo Imagem 3) */}
                                    <div className="bg-slate-900 border-b border-slate-800 p-2.5 lg:p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                                        {!isFullscreenPreview && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 z-10 text-slate-500 hover:text-white"
                                                onClick={() => setIsFullscreenPreview(true)}>
                                                <Maximize2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800/50 to-slate-900 pointer-events-none" />

                                        {/* Régua Principal Superior */}
                                        <div className={cn(
                                            "w-full max-w-xl relative flex flex-col items-center transition-all duration-300",
                                            hoveredField === 'rollWidth' ? "scale-[1.02] drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]" : "opacity-80"
                                        )}>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 shadow-xl backdrop-blur-md">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Escala Real</span>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary-custom)]/60" />
                                                </div>
                                            </div>

                                            <div className="w-full h-10 flex flex-col items-center justify-end relative">
                                                <div className="text-[10px] font-mono font-bold text-slate-300 mb-2 flex items-center gap-3 tracking-widest">
                                                    <span className="text-slate-600">←</span>
                                                    <span className={cn(
                                                        "transition-colors duration-300",
                                                        hoveredField === 'rollWidth' ? "text-primary" : "text-slate-300"
                                                    )}>
                                                        {rollWidth} CM
                                                    </span>
                                                    <span className="text-slate-600">→</span>
                                                </div>

                                                {/* Linha da Régua */}
                                                <div className={cn(
                                                    "w-full h-px relative transition-all duration-500",
                                                    hoveredField === 'rollWidth' ? "bg-primary shadow-[0_0_10px_var(--primary-custom)]/50" : "bg-slate-700"
                                                )}>
                                                    <div className={cn("absolute -top-2 left-0 w-px h-4 transition-colors", hoveredField === 'rollWidth' ? "bg-primary" : "bg-slate-700")} />
                                                    <div className={cn("absolute -top-2 right-0 w-px h-4 transition-colors", hoveredField === 'rollWidth' ? "bg-primary" : "bg-slate-700")} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scrollable Canvas Area */}
                                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar relative flex flex-col">
                                        <div
                                            ref={previewRef}
                                            id="dtf-preview-paper"
                                            className="bg-white shadow-2xl relative transition-all duration-300 origin-top mx-auto my-auto overflow-hidden border border-slate-300"
                                            style={{
                                                width: '100%',
                                                maxWidth: '100%',
                                                aspectRatio: `${rollWidth} / ${visualTotalHeightCm}`,
                                                flexShrink: 0 // Prevent shrinking in flex container
                                            }}>
                                            {/* Alerta de Performance Único e Flutuante */}
                                            {!isExporting && (mode === 'quick' ? results.hasWarning : multiResults.hasWarning) && (
                                                <div className="absolute top-12 right-4 z-40">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-primary/20 shadow-xl rounded-full">
                                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest text-center">Preview Limitado</span>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Regua de Medida do Topo (Ruler) */}
                                            <div className="absolute top-0 inset-x-0 h-8 flex flex-col items-center pointer-events-none z-30 opacity-60">
                                                <div className="w-full h-px bg-slate-300 relative mt-4">
                                                    <div className="absolute -top-1 left-0 w-[1px] h-3 bg-slate-400" />
                                                    <div className="absolute -top-1 right-0 w-[1px] h-3 bg-slate-400" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <span className="bg-white px-1.5 py-0.5 text-[7px] font-mono font-bold text-slate-500 tracking-tighter">
                                                            ← {rollWidth} cm →
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Área Útil (Clipada e com labels de margem) */}
                                            <div
                                                className={cn(
                                                    "absolute border border-dashed transition-all duration-300",
                                                    hoveredField === 'quantity' ? "bg-yellow-400/5 border-yellow-400/30" : "border-slate-200"
                                                )}
                                                style={{
                                                    left: `${(margin / rollWidth) * 100}%`,
                                                    right: `${(margin / rollWidth) * 100}%`,
                                                    top: `${(margin / visualTotalHeightCm) * 100}%`,
                                                    bottom: `${(margin / visualTotalHeightCm) * 100}%`,
                                                }}>
                                                {/* Grid labels */}
                                                {margin > 0 && (
                                                    <>
                                                        <div className={cn(
                                                            "absolute -top-3 left-1/2 -translate-x-1/2 text-[6px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors",
                                                            hoveredField === 'margin' ? "text-emerald-500 scale-110" : "text-emerald-600/60"
                                                        )}>MARGEM TOPO {margin}CM</div>
                                                        <div className={cn(
                                                            "absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors",
                                                            hoveredField === 'margin' ? "text-emerald-500 scale-110" : "text-emerald-600/60"
                                                        )}>MARGEM FUNDO {margin}CM</div>
                                                    </>
                                                )}

                                                <div className="w-full h-full relative">
                                                    {mode === 'quick' ? (
                                                        <div
                                                            className="mx-auto h-full"
                                                            style={{ width: `${(results.contentWidth / results.usableWidth) * 100}%` }}>
                                                            <div
                                                                className={cn(
                                                                    "grid content-start w-full transition-all duration-300",
                                                                    hoveredField === 'separation' ? "bg-purple-500/5 ring-1 ring-purple-500/20" : ""
                                                                )}
                                                                style={{
                                                                    gridTemplateColumns: `repeat(${results.imagesPerRow}, 1fr)`,
                                                                    columnGap: `${(separation / results.contentWidth) * 100}%`,
                                                                    rowGap: `${(separation / (isExporting ? results.contentHeight : results.previewContentHeight)) * 100}%`,
                                                                    aspectRatio: `${results.contentWidth} / ${isExporting ? results.contentHeight : results.previewContentHeight}`
                                                                }}>
                                                                {Array.from({ length: isExporting ? results.finalQuantity : Math.min(200, results.finalQuantity) }).map((_, i) => (
                                                                    <div key={`logo-${i}`}
                                                                        className={cn(
                                                                            "bg-primary border border-primary/50 rounded-sm flex items-center justify-center overflow-hidden transition-all duration-300",
                                                                            hoveredField === 'imageSize' ? "scale-105 shadow-[0_0_12px_var(--primary-custom)] z-20 border-primary" : "hover:brightness-110"
                                                                        )}
                                                                        style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
                                                                        <span className="text-[5px] sm:text-[6px] font-black text-primary-foreground/40 select-none">
                                                                            {imageWidth}x{imageHeight}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="relative w-full h-full">
                                                            {(isExporting ? multiResults.placedItems : multiResults.previewPlacedItems).map((placedItem, idx) => {
                                                                const originalIndex = placedItem.originalIndex as number;
                                                                const color = itemColors[originalIndex % itemColors.length];

                                                                // Calcula área livre do container
                                                                const heightContext = isExporting
                                                                    ? (multiResults.totalHeightCm - (margin * 2))
                                                                    : (multiResults.previewTotalHeightCm - (margin * 2));

                                                                // Se rodou, visualmente inverte largura por altura no desenho
                                                                const drawWidth = placedItem.rotated ? placedItem.height : placedItem.width;
                                                                const drawHeight = placedItem.rotated ? placedItem.width : placedItem.height;

                                                                return (
                                                                    <div key={`packed-${idx}`}
                                                                        className={cn(
                                                                            "absolute border rounded-sm flex items-center justify-center transition-all duration-300",
                                                                            color.bg,
                                                                            color.border,
                                                                            (hoveredField === 'itemWidth' || hoveredField === 'itemHeight' || hoveredField === 'itemQuantity') ? "scale-[1.05] shadow-[0_0_12px_rgba(30,150,255,0.6)] z-20" : ""
                                                                        )}
                                                                        style={{
                                                                            left: `${(placedItem.x / multiResults.usableWidth) * 100}%`,
                                                                            top: `${(placedItem.y / heightContext) * 100}%`,
                                                                            width: `${(drawWidth / multiResults.usableWidth) * 100}%`,
                                                                            height: `${(drawHeight / heightContext) * 100}%`,
                                                                        }}>
                                                                        <span className={cn(
                                                                            "font-bold opacity-40 select-none",
                                                                            drawWidth < 5 || drawHeight < 5 ? "text-[5px]" : "text-[5px] sm:text-[6px]",
                                                                            color.text
                                                                        )}>
                                                                            {placedItem.rotated ? <RefreshCw className="w-2 h-2 mr-0.5 inline-block opacity-70" /> : ''}{originalIndex + 1}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Margens Overlay Dinâmicas (Inside Area Util) */}
                                                <div className={cn(
                                                    "absolute inset-y-0 left-0 pointer-events-none z-10 flex transition-all duration-300",
                                                    hoveredField === 'margin' ? "bg-emerald-500/20 shadow-[inset_-10px_0_15px_rgba(16,185,129,0.2)]" : ""
                                                )}
                                                    style={{ width: `${((mode === 'quick' ? results.realSideMargin : multiResults.realSideMargin) / rollWidth) * 100}%` }}>
                                                    <div className={cn(
                                                        "h-full border-r flex items-center justify-center transition-all",
                                                        hoveredField === 'margin' ? "bg-emerald-500/30 border-emerald-500" : "bg-emerald-500/5 border-emerald-500/10"
                                                    )} style={{ width: mode === 'quick' ? `${(margin / results.realSideMargin) * 100}%` : `${(margin / multiResults.realSideMargin) * 100}%` }}>
                                                        <div className="[writing-mode:vertical-lr] rotate-180 opacity-40">
                                                            <span className={cn("text-[5px] font-bold uppercase tracking-widest", hoveredField === 'margin' ? "text-emerald-900" : "text-emerald-800")}>M. SEG {margin}CM</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "absolute inset-y-0 right-0 pointer-events-none z-10 flex flex-row-reverse transition-all duration-300",
                                                    hoveredField === 'margin' ? "bg-emerald-500/20 shadow-[inset_10px_0_15px_rgba(16,185,129,0.2)]" : ""
                                                )}
                                                    style={{ width: `${((mode === 'quick' ? results.realSideMargin : multiResults.realSideMargin) / rollWidth) * 100}%` }}>
                                                    <div className={cn(
                                                        "h-full border-l flex items-center justify-center transition-all",
                                                        hoveredField === 'margin' ? "bg-emerald-500/30 border-emerald-500" : "bg-emerald-500/5 border-emerald-500/10"
                                                    )} style={{ width: mode === 'quick' ? `${(margin / results.realSideMargin) * 100}%` : `${(margin / multiResults.realSideMargin) * 100}%` }}>
                                                        <div className="[writing-mode:vertical-lr] opacity-40">
                                                            <span className={cn("text-[5px] font-bold uppercase tracking-widest", hoveredField === 'margin' ? "text-emerald-900" : "text-emerald-800")}>M. SEG {margin}CM</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Global Truncation Warning (Inside Scrollable Canvas Area) */}
                                    {
                                        !isExporting && (mode === 'quick' ? results.hasWarning : multiResults.hasWarning) && (
                                            <div className="sticky bottom-4 inset-x-0 w-full px-8 pb-4 pointer-events-none z-50 flex justify-center">
                                                <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Preview Parcial Ativado</span>
                                                        <span className="text-[7px] text-slate-400 font-bold uppercase italic">Mostrando apenas as primeiras 200 marcas</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }

                                    {/* Legenda e Status (Estilo Imagem 4) */}
                                    <div className="px-3 py-2.5 border-t border-slate-200 bg-slate-900 flex flex-wrap items-center justify-between rounded-b-xl gap-3">
                                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-primary rounded-sm shadow-[0_0_5px_var(--primary-custom)]" />
                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Logos</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-white border border-slate-700 rounded-sm" />
                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Área Útil</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Margem (M)</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 bg-purple-500 rounded-sm" />
                                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Espaço (S)</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800/50 rounded-full border border-slate-700/50 ml-auto">
                                            <Badge variant="outline" className="bg-transparent text-slate-300 font-bold text-[8.5px] border-slate-700 px-1.5 py-0">
                                                TOTAL: {(mode === 'quick' ? results.totalHeightCm : multiResults.totalHeightCm).toFixed(1)}cm
                                            </Badge>
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 font-black text-[8.5px] border-emerald-500/20 px-1.5 py-0">
                                                EST. R$ {((mode === 'quick' ? results.totalMeters : multiResults.totalMeters) * 50).toFixed(2)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <GabiActionDialog
                isOpen={actionDialogOpen}
                onOpenChange={setActionDialogOpen}
                customerName={""}
                phone={""}
                messagePreview={generateQuoteSummary()}
                onConfirm={async (msg, clienteId, manualPhone) => {
                    let finalPhone = "";
                    let customerDisplayName = "Cliente";

                    if (clienteId) {
                        const cliente = clientes.find(c => c.id === clienteId);
                        if (cliente?.telefone) {
                            const cleanPhone = cliente.telefone.replace(/\D/g, '');
                            finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                            customerDisplayName = cliente.nome;
                        }
                    } else if (manualPhone) {
                        const cleanPhone = manualPhone.replace(/\D/g, '');
                        if (cleanPhone.length >= 10) {
                            finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                            customerDisplayName = "Número Manual";
                        }
                    }

                    if (!finalPhone) {
                        showError("Por favor, selecione um cliente ou digite um número válido.");
                        return;
                    }

                    setIsSendingWhatsApp(true);
                    try {
                        const taskId = addTask({
                            title: 'Envio de Orçamento',
                            description: `Enviando para ${customerDisplayName}`,
                            status: 'processing',
                            progress: 0,
                            steps: [
                                { id: 'whatsapp', label: 'Enviando WhatsApp', status: 'pending' }
                            ]
                        });

                        showSuccess("Orçamento enviado para a fila de processamento! 🚀");
                        setActionDialogOpen(false);

                        // Função que roda em background
                        const processEnvio = async () => {
                            try {
                                updateStep(taskId, 'whatsapp', 'loading');
                                updateTask(taskId, { progress: 30 });

                                const currentSession = (await supabaseClient.auth.getSession()).data.session;
                                const controller = new AbortController();
                                const timeout = setTimeout(() => controller.abort(), 60000);

                                const resp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-proxy`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${currentSession?.access_token}`,
                                        'apikey': SUPABASE_ANON_KEY
                                    },
                                    body: JSON.stringify({
                                        action: 'send-text',
                                        phone: finalPhone,
                                        message: msg.trim()
                                    }),
                                    signal: controller.signal
                                });
                                clearTimeout(timeout);

                                const result = await resp.json();
                                if (!resp.ok || result?.error) {
                                    throw new Error(result?.message || 'Erro ao enviar WhatsApp');
                                }

                                updateStep(taskId, 'whatsapp', 'completed');
                                updateTask(taskId, { status: 'completed', progress: 100 });
                                showSuccess(`Orçamento enviado para ${customerDisplayName}!`);

                            } catch (err: any) {
                                console.error('Erro no envio de orçamento em background:', err);
                                updateTask(taskId, {
                                    status: 'error',
                                    error: err.message || 'Erro desconhecido',
                                    progress: 100
                                });
                                showError(`Falha ao enviar orçamento para ${customerDisplayName}`);
                            }
                        };

                        processEnvio();

                    } catch (error) {
                        showError("Erro ao agendar envio.");
                    } finally {
                        setIsSendingWhatsApp(false);
                    }
                }}
                isLoading={isSendingWhatsApp}
                actionType="generic"
                clientes={clientes}
            />

            {/* Custom Liquid Glass Fill Dialog */}
            <Dialog open={isFillDialogOpen} onOpenChange={setIsFillDialogOpen}>
                <DialogContent className="max-w-[320px] p-0 border-none bg-transparent shadow-none overflow-hidden">
                    <div className="relative p-6 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden group">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors duration-500" />
                        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl" />

                        <div className="relative space-y-6">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl shadow-inner">
                                    <Maximize2 className="h-6 w-6 text-primary animate-pulse" />
                                </div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Preencher Rolo</h3>
                                <p className="text-xs text-slate-400 font-medium">Quantos metros você deseja preencher com este item?</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={fillTargetMeters}
                                            onChange={(e) => setFillTargetMeters(parseFloat(e.target.value))}
                                            className="h-14 bg-white/5 border-white/10 focus:border-primary/50 text-white text-center text-xl font-black rounded-2xl transition-all shadow-inner focus:ring-0 focus:ring-offset-0"
                                            placeholder="Metros"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-white/20 uppercase">Metros</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="ghost"
                                        className="h-12 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl border border-white/5"
                                        onClick={() => setIsFillDialogOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        className="h-12 text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary/80 text-primary-foreground rounded-2xl shadow-lg shadow-primary/20 border-t border-white/20 active:scale-95 transition-all"
                                        onClick={() => {
                                            if (activeFillingItemId) {
                                                handleTargetMetersChange(fillTargetMeters, activeFillingItemId);
                                                setIsFillDialogOpen(false);
                                                showSuccess(`${fillTargetMeters} metros preenchidos com sucesso!`);
                                            }
                                        }}>
                                        Confirmar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <TutorialGuide
                steps={CALCULADORA_TOUR}
                isOpen={isTourOpen}
                currentStep={currentStep}
                onNext={nextStep}
                onPrev={prevStep}
                onClose={() => closeTour()}
            />
            {/* WhatsApp Plus Mode Dialog Removed - now handled by WhatsAppButton component */}
        </>
    );
};

export default DTFCalculatorModal;
