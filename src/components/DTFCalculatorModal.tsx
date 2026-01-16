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
import { Calculator, LayoutGrid, Ruler, Layers, ChevronRight, Info, HelpCircle, AlertTriangle, Plus, Minus, Maximize2, RotateCcw, MessageSquare, Share2, Copy, Download, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/utils/toast";
import { toPng, toBlob } from 'html-to-image';
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
    };
}

// --- Componentes Auxiliares (Definidos fora para evitar re-montagem e perda de foco) ---

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
                    onMouseLeave={() => setHoveredField(null)}
                >
                    <Label
                        htmlFor={id}
                        className={cn(
                            "text-[11px] leading-tight decoration-dotted underline-offset-4 group-hover:underline transition-all cursor-help",
                            hoveredField === fieldId ? "text-primary underline" : "text-muted-foreground"
                        )}
                    >
                        {label}
                    </Label>
                    <HelpCircle className={cn(
                        "h-3 w-3 mt-0.5 shrink-0 transition-colors",
                        hoveredField === fieldId ? "text-primary" : "text-muted-foreground/50"
                    )} />
                </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px] bg-slate-900 dark:bg-slate-950 text-white border-primary/20 shadow-xl">
                {content}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

// Componente de Input numérico robusto
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
    showButtons?: boolean
}) => {
    // Estado local para digitação fluida
    const [displayValue, setDisplayValue] = useState<string>(value?.toString() || "");

    // Sincronizar com valor externo (ex: botões ou mudança no pai)
    useEffect(() => {
        if (value !== undefined && value !== null) {
            // Só atualiza o display se o valor numérico for diferente e não estiver "no meio" de uma digitação decimal importante
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

        // Tenta atualizar em tempo real apenas se for um número válido e completo
        const num = parseFloat(val);
        if (!isNaN(num) && !val.endsWith('.') && !val.endsWith('0')) {
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

    return (
        <div
            className={cn(
                "relative flex items-center w-full transition-all duration-200",
                highlight && "ring-2 ring-yellow-500/60 rounded-lg shadow-[0_0_12px_rgba(202,138,4,0.25)]",
                className
            )}
            onMouseEnter={() => setHoveredField(fieldId)}
            onMouseLeave={() => setHoveredField(null)}
        >
            {showButtons && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-r-none border-r-0 bg-slate-50 dark:bg-muted hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary active:scale-95 transition-all touch-manipulation flex-shrink-0"
                    onClick={decrement}
                    disabled={value !== undefined && value !== null && value <= min}
                >
                    <Minus className="h-4 w-4" />
                </Button>
            )}
            <div className="relative flex-1">
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
                        "h-12 text-center font-black",
                        showButtons ? "rounded-none border-x-0 px-1" : "rounded-md px-2",
                        suffix ? "pr-7" : "",
                        className.replace("w-full", "")
                    )}
                />
                {suffix && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">
                        {suffix}
                    </span>
                )}
            </div>
            {showButtons && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-l-none border-l-0 bg-slate-50 dark:bg-muted hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary active:scale-95 transition-all touch-manipulation flex-shrink-0"
                    onClick={increment}
                    disabled={value !== undefined && value !== null && value >= max}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
};

export const DTFCalculatorModal = ({ isOpen, onClose, initialData }: DTFCalculatorModalProps) => {
    // Inputs (Modo Simples)
    const [rollWidth, setRollWidth] = useState(initialData?.rollWidth || 58);
    const [imageWidth, setImageWidth] = useState(initialData?.imageWidth || 5);
    const [imageHeight, setImageHeight] = useState(initialData?.imageHeight || 5);
    const [separation, setSeparation] = useState(0.5);
    const [margin, setMargin] = useState(1);
    const [quantity, setQuantity] = useState(initialData?.quantity || 100);

    // --- MULTI-ITEM MODE ---
    type CalculatorMode = 'simple' | 'multi';
    interface MultiItem {
        id: string;
        width: number;
        height: number;
        quantity: number;
    }

    const [mode, setMode] = useState<CalculatorMode>('simple');
    const [items, setItems] = useState<MultiItem[]>([
        { id: crypto.randomUUID(), width: 5, height: 5, quantity: 100 }
    ]);

    const addItem = () => {
        setItems([...items, {
            id: crypto.randomUUID(),
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

    const updateItem = (id: string, field: keyof Omit<MultiItem, 'id'>, value: number) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };
    // --- END MULTI-ITEM MODE ---

    // UX State
    const [hoveredField, setHoveredField] = useState<string | null>(null);
    const [targetMeters, setTargetMeters] = useState<number>(0);
    const [isExporting, setIsExporting] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
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
        const totalRows = Math.ceil(quantity / imagesPerRow);

        // Altura total = (linhas * altura_logo) + (espaçamentos entre elas) + Margens Topo/Fundo
        const contentHeight = (totalRows * imageHeight) + ((totalRows - 1) * separation);
        const totalHeightCm = contentHeight + (margin * 2);
        const totalMeters = totalHeightCm / 100;

        const imagesPerMeter = (100 / totalImageHeight) * imagesPerRow;
        const currentContentWidth = (imagesPerRow * imageWidth) + ((imagesPerRow - 1) * separation);
        const efficiency = (currentContentWidth / rollWidth) * 100;

        // Sobra lateral real (Margem configurada + espaço vazio que sobrou por não caber mais uma logo)
        const realSideMargin = (rollWidth - currentContentWidth) / 2;

        // Preview rendering values
        const previewLimit = 500;
        const previewQuantity = Math.min(previewLimit, quantity);
        const previewRows = Math.ceil(previewQuantity / imagesPerRow);
        const hasWarning = quantity > previewLimit;

        const previewContentHeight = (previewRows * imageHeight) + (Math.max(0, previewRows - 1) * separation);
        const previewTotalHeightCm = previewContentHeight + (margin * 2);

        return {
            imagesPerRow,
            totalRows,
            totalMeters,
            imagesPerMeter: Math.floor(imagesPerMeter),
            efficiency: Math.round(efficiency),
            usableWidth,
            contentHeight,
            contentWidth: currentContentWidth,
            realSideMargin,
            totalHeightCm,
            previewContentHeight,
            previewTotalHeightCm,
            hasWarning
        };
    }, [rollWidth, imageWidth, imageHeight, separation, margin, quantity]);

    // Multi-Item Results calculation
    const multiResults = useMemo(() => {
        const usableWidth = rollWidth - (margin * 2);
        const previewLimit = 500;
        let renderedCount = 0;

        const itemsCalculated = items.map(item => {
            const totalImageWidth = item.width + separation;
            const imagesPerRow = Math.max(1, Math.floor((usableWidth + separation) / totalImageWidth));
            const totalRows = Math.ceil(item.quantity / imagesPerRow);
            const contentHeight = (totalRows * item.height) + (Math.max(0, totalRows - 1) * separation);
            const heightCm = contentHeight + separation; // block height including gap to next
            const meters = (contentHeight + separation) / 100;

            // Preview calc - we limit based on TOTAL items rendered in preview
            const remainingPreviewSpace = Math.max(0, previewLimit - renderedCount);
            const previewQuantity = Math.min(item.quantity, remainingPreviewSpace);
            renderedCount += previewQuantity;

            const previewRows = Math.ceil(previewQuantity / imagesPerRow);
            const previewContentHeight = previewQuantity > 0
                ? (previewRows * item.height) + (Math.max(0, previewRows - 1) * separation)
                : 0;
            const previewHeightCm = previewQuantity > 0 ? previewContentHeight + separation : 0;

            return {
                ...item,
                imagesPerRow,
                totalRows,
                meters,
                heightCm,
                contentHeight,
                previewContentHeight,
                previewHeightCm,
                previewQuantity,
                label: `${item.width}x${item.height}cm`
            };
        });

        const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
        const hasWarning = totalQuantity > previewLimit;

        // Total heights
        const totalContentHeight = itemsCalculated.reduce((acc, item) => acc + item.heightCm, 0) - separation;
        const totalHeightCm = totalContentHeight + (margin * 2);
        const totalMeters = totalHeightCm / 100;

        // Preview Total
        const previewContentHeight = itemsCalculated.reduce((acc, item) => acc + item.previewHeightCm, 0) - (renderedCount > 0 ? separation : 0);
        const previewTotalHeightCm = previewContentHeight + (margin * 2);

        return {
            items: itemsCalculated,
            totalMeters: Math.max(0, totalMeters),
            totalQuantity,
            totalHeightCm,
            previewTotalHeightCm,
            usableWidth,
            hasWarning
        };
    }, [rollWidth, margin, separation, items]);

    const visualTotalHeightCm = useMemo(() => {
        if (isExporting) return mode === 'simple' ? results.totalHeightCm : multiResults.totalHeightCm;
        return mode === 'simple' ? results.previewTotalHeightCm : multiResults.previewTotalHeightCm;
    }, [isExporting, mode, results, multiResults]);

    const handleTargetMetersChange = (meters: number) => {
        setTargetMeters(meters);
        if (meters <= 0) return;

        const usableHeight = (meters * 100) - (margin * 2);
        if (usableHeight <= 0) return;

        const rowHeightWithGap = imageHeight + separation;
        const totalRows = Math.floor((usableHeight + separation) / rowHeightWithGap);

        if (totalRows > 0) {
            const newQuantity = totalRows * results.imagesPerRow;
            setQuantity(newQuantity);
        }
    };

    const generateQuoteSummary = () => {
        return `📝 *Orçamento DTF - Direct AI*\n\n` +
            `📐 *Logo:* ${imageWidth}x${imageHeight}cm\n` +
            `🔢 *Qtde:* ${quantity} un\n` +
            `📏 *Rolo:* ${rollWidth}cm\n` +
            `↔️ *Espaço:* ${separation}cm | *Margem:* ${margin}cm\n\n` +
            `✅ *TOTAL:* ${results.totalMeters.toFixed(2)}m\n` +
            `📈 *Aproveit.:* ${results.efficiency}% (Real)\n` +
            `📦 *Rendimento:* ${results.imagesPerMeter} un/m`;
    };

    const handleCopyToClipboard = () => {
        const text = generateQuoteSummary();
        navigator.clipboard.writeText(text);
        showSuccess("Orçamento copiado para a área de transferência!");
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(generateQuoteSummary());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const handleDownloadImage = async () => {
        if (!previewRef.current) return;
        setIsExporting(true);
        try {
            // Pequeno delay para garantir que o DOM está pronto e estilos aplicados
            await new Promise(resolve => setTimeout(resolve, 100));
            const dataUrl = await toPng(previewRef.current, {
                backgroundColor: '#ffffff',
                quality: 1,
                pixelRatio: 2 // Melhor qualidade
            });
            const link = document.createElement('a');
            link.download = `orcamento-dtf-${quantity}un-${imageWidth}x${imageHeight}cm.png`;
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-primary/20 shadow-2xl p-4 sm:p-6 custom-scrollbar">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Calculator className="h-6 w-6 text-amber-500 dark:text-primary" />
                        <DialogTitle className="text-2xl font-bold tracking-tight text-slate-950 dark:text-primary">Calculadora de Orçamento DTF</DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-600 dark:text-slate-400">
                        Simule o aproveitamento das suas imagens no rolo e calcule a metragem necessária.
                    </DialogDescription>
                    <div className="flex items-center gap-2 mt-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-full w-fit border border-slate-200 dark:border-slate-700/50 shadow-sm animate-in slide-in-from-bottom-2 duration-500">
                        <Sparkles className="h-4 w-4 text-amber-500 dark:text-primary flex-shrink-0 animate-pulse" />
                        <span className="text-xs text-slate-700 dark:text-slate-200 font-semibold" key={currentTipIndex}>
                            {aiTips[currentTipIndex]}
                        </span>
                    </div>
                </DialogHeader>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit mt-2">
                    <button
                        onClick={() => setMode('simple')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            mode === 'simple'
                                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        <Ruler className="h-4 w-4" /> Simples
                    </button>
                    <button
                        onClick={() => setMode('multi')}
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                            mode === 'multi'
                                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        <Layers className="h-4 w-4" /> Multi-Itens
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mt-4 items-start">
                    {/* Formulário - 5 colunas */}
                    <div className="md:col-span-5 space-y-4 md:sticky md:top-0">
                        <Card className="border-primary/10 bg-slate-50/50 dark:bg-primary/5">
                            <CardContent className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground flex items-center justify-between tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <Ruler className="h-3 w-3 text-amber-500 dark:text-primary" /> Configurações do Material (Rolo)
                                        </div>
                                    </Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 p-0.5">
                                            <div className="min-h-[32px] flex items-end pb-1">
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
                                                setHoveredField={setHoveredField}
                                            />
                                            <div className="flex gap-1 pt-1">
                                                {[30, 58].map((w) => (
                                                    <Button
                                                        key={w}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`h-7 text-[10px] flex-1 touch-manipulation transition-all ${rollWidth === w ? 'bg-yellow-600 border-yellow-700 text-white font-bold shadow-md' : 'text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        onClick={() => setRollWidth(w)}
                                                    >
                                                        {w}cm
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Configuração de Margens de Segurança */}
                                        <div className="space-y-1.5 p-0.5">
                                            <div className="min-h-[32px] flex items-end pb-1">
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
                                                highlight={hoveredField === 'margin'}
                                                setHoveredField={setHoveredField}
                                            />
                                            <div className="flex gap-1 pt-1">
                                                {[0.5, 1, 1.5].map((m) => (
                                                    <Button
                                                        key={m}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`h-7 flex-1 text-[10px] uppercase font-bold transition-all ${margin === m ? 'bg-yellow-600 border-yellow-700 text-white font-bold shadow-md' : 'text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        onClick={() => setMargin(m)}
                                                    >
                                                        {m}cm
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-primary/10" />

                                {/* SIMPLE MODE: Single Item Inputs */}
                                {mode === 'simple' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground flex items-center gap-1 tracking-wider">
                                                <Layers className="h-3 w-3 text-amber-500 dark:text-primary" /> Tamanho da sua Logo
                                            </Label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <div className="h-4 flex items-center justify-between px-0.5">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">Largura (cm)</Label>
                                                </div>
                                                <NumberInput
                                                    id="imageWidth"
                                                    value={imageWidth}
                                                    onChange={setImageWidth}
                                                    min={0.5}
                                                    max={50}
                                                    step={0.5}
                                                    fieldId="imageSize"
                                                    showButtons={false}
                                                    placeholder="L"
                                                    className="h-11 text-xl font-bold bg-white dark:bg-slate-900 border-slate-200"
                                                    setHoveredField={setHoveredField}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="h-4 flex items-center justify-between px-0.5">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">Altura (cm)</Label>
                                                </div>
                                                <NumberInput
                                                    id="imageHeight"
                                                    value={imageHeight}
                                                    onChange={setImageHeight}
                                                    min={0.5}
                                                    max={50}
                                                    step={0.5}
                                                    fieldId="imageSize"
                                                    showButtons={false}
                                                    placeholder="A"
                                                    className="h-11 text-xl font-bold bg-white dark:bg-slate-900 border-slate-200"
                                                    setHoveredField={setHoveredField}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1">
                                                <div className="h-4 flex items-center justify-between px-0.5">
                                                    <Label className="text-[9px] uppercase font-bold text-slate-500">Espaço (cm)</Label>
                                                </div>
                                                <NumberInput
                                                    id="separation"
                                                    value={separation}
                                                    onChange={setSeparation}
                                                    min={0}
                                                    max={3}
                                                    step={0.1}
                                                    fieldId="separation"
                                                    showButtons={false}
                                                    className="h-11 text-lg font-bold bg-white dark:bg-slate-900 border-slate-200"
                                                    setHoveredField={setHoveredField}
                                                />
                                                <div className="flex gap-1 pt-1">
                                                    {[0.3, 0.5, 1].map((s) => (
                                                        <Button
                                                            key={s}
                                                            variant="outline"
                                                            size="sm"
                                                            className={`h-6 text-[10px] flex-1 ${separation === s ? 'bg-yellow-600 border-yellow-700 text-white font-bold' : 'text-slate-500'}`}
                                                            onClick={() => setSeparation(s)}
                                                        >
                                                            {s}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="h-4 flex items-center justify-between px-0.5">
                                                    <Label className="text-[9px] uppercase font-black text-primary">Quantidade</Label>
                                                </div>
                                                <NumberInput
                                                    id="quantity"
                                                    value={quantity}
                                                    onChange={setQuantity}
                                                    min={1}
                                                    max={10000}
                                                    step={1}
                                                    fieldId="quantity"
                                                    highlight={true}
                                                    className="h-11 text-xl font-black"
                                                    setHoveredField={setHoveredField}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* MULTI MODE: Item List */}
                                {mode === 'multi' && (
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-muted-foreground flex items-center gap-1 tracking-wider">
                                            <Layers className="h-3 w-3 text-amber-500 dark:text-primary" /> Itens do Orçamento
                                        </Label>

                                        {/* Item List */}
                                        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                                            {items.map((item, index) => (
                                                <div
                                                    key={item.id}
                                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm"
                                                >
                                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                                                        <span className="text-xs font-black text-slate-400">ITEM {index + 1}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            onClick={() => removeItem(item.id)}
                                                            disabled={items.length <= 1}
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Tamanho */}
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tamanho (cm)</Label>
                                                            <div className="flex items-center gap-2">
                                                                <NumberInput
                                                                    id={`width-${item.id}`}
                                                                    value={item.width}
                                                                    onChange={(val) => updateItem(item.id, 'width', val)}
                                                                    min={0.5}
                                                                    max={50}
                                                                    step={0.5}
                                                                    fieldId="itemWidth"
                                                                    showButtons={false}
                                                                    placeholder="L"
                                                                    className="h-10 text-base font-bold bg-white dark:bg-slate-900 border-slate-200"
                                                                    setHoveredField={setHoveredField}
                                                                />
                                                                <span className="text-slate-300 font-bold mb-1">×</span>
                                                                <NumberInput
                                                                    id={`height-${item.id}`}
                                                                    value={item.height}
                                                                    onChange={(val) => updateItem(item.id, 'height', val)}
                                                                    min={0.5}
                                                                    max={50}
                                                                    step={0.5}
                                                                    fieldId="itemHeight"
                                                                    showButtons={false}
                                                                    placeholder="A"
                                                                    className="h-10 text-base font-bold bg-white dark:bg-slate-900 border-slate-200"
                                                                    setHoveredField={setHoveredField}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Quantidade */}
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Qtd</Label>
                                                            <NumberInput
                                                                id={`quantity-${item.id}`}
                                                                value={item.quantity}
                                                                onChange={(val) => updateItem(item.id, 'quantity', val)}
                                                                min={1}
                                                                max={10000}
                                                                step={1}
                                                                fieldId="itemQuantity"
                                                                showButtons={false}
                                                                highlight={true}
                                                                className="h-10 text-base"
                                                                setHoveredField={setHoveredField}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Item Button */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-10 text-xs border-dashed border-primary/30 text-primary hover:bg-primary/5 font-bold"
                                            onClick={addItem}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                                        </Button>

                                        {/* Separation (shared across all items) */}
                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] text-slate-500">Espaço entre logos:</Label>
                                                <div className="flex gap-1">
                                                    {[0.3, 0.5, 1].map((s) => (
                                                        <Button
                                                            key={s}
                                                            variant="outline"
                                                            size="sm"
                                                            className={`h-6 px-2 text-[10px] ${separation === s ? 'bg-yellow-600 border-yellow-700 text-white' : ''}`}
                                                            onClick={() => setSeparation(s)}
                                                        >
                                                            {s}cm
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Calcular por Metragem - Only in Simple Mode */}
                                {mode === 'simple' && (
                                    <div className="pt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ou preencher por metragem</span>
                                            <div className="h-px w-full bg-slate-200 dark:bg-slate-800" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <NumberInput
                                                id="targetMeters"
                                                value={targetMeters}
                                                onChange={handleTargetMetersChange}
                                                min={0}
                                                max={100}
                                                step={1}
                                                fieldId="targetMeters"
                                                placeholder="Ex: 4 metros"
                                                suffix="m"
                                                showButtons={false}
                                                className="h-9 text-xs bg-primary/5 border-dashed border-primary/20 focus:border-primary/50 transition-all"
                                                setHoveredField={setHoveredField}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-3 text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
                                                onClick={() => {
                                                    setTargetMeters(0);
                                                }}
                                            >
                                                LIMPAR
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Alerta de Erro se não couber */}
                        {imageWidth + (margin * 2) > rollWidth && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-500">
                                <Info className="h-4 w-4" />
                                <span className="text-xs font-bold">Erro: A logo não cabe na largura do rolo com essas margens!</span>
                            </div>
                        )}

                        {/* Resultados Rápidos */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 ring-4 ring-primary/10 flex flex-col items-center justify-center text-center scale-105 transition-transform">
                                <span className="text-[10px] uppercase font-bold opacity-90 tracking-wider">Metragem Necessária</span>
                                <span className="text-3xl font-black tracking-tight">
                                    {mode === 'simple' ? results.totalMeters.toFixed(2) : multiResults.totalMeters.toFixed(2)}m
                                </span>
                            </div>
                            <div className="p-3 bg-sky-50 dark:bg-secondary text-sky-950 dark:text-secondary-foreground rounded-xl shadow-sm border border-sky-100 dark:border-primary/20 flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] uppercase font-bold text-sky-800 dark:opacity-70 tracking-wider">
                                    {mode === 'simple' ? 'Logos por Metro' : 'Total de Itens'}
                                </span>
                                <span className="text-2xl font-black tracking-tight">
                                    {mode === 'simple' ? `${results.imagesPerMeter} un` : `${multiResults.totalQuantity} un`}
                                </span>
                            </div>
                        </div>

                        {/* Resumo - mode specific */}
                        {mode === 'simple' ? (
                            <div className="bg-slate-50 dark:bg-muted p-3 rounded-lg flex items-start gap-2 border border-slate-200 dark:border-slate-800">
                                <Info className="h-4 w-4 text-amber-500 dark:text-primary mt-0.5 shrink-0" />
                                <div className="text-[11px] leading-tight text-slate-600 dark:text-muted-foreground font-medium">
                                    <strong className="text-slate-900 dark:text-slate-200">Resumo:</strong> Cabem <strong>{results.imagesPerRow} logos</strong> por linha.
                                    Sua produção terá <strong>{results.totalRows} linhas</strong> de imagens.
                                    Aproveitamento de <strong>{results.efficiency}%</strong> da largura útil.
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-muted p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Info className="h-4 w-4 text-amber-500 dark:text-primary shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-200">Detalhamento por Item:</span>
                                </div>
                                <div className="space-y-1">
                                    {multiResults.items.map((item, idx) => {
                                        const color = itemColors[idx % itemColors.length];
                                        return (
                                            <div key={item.id} className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 py-1.5 border-b border-slate-200 dark:border-slate-700 last:border-0 group">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-1 h-3 rounded-full", color.dot)} />
                                                    <span><strong className="text-slate-800 dark:text-slate-200">{idx + 1}. {item.label}</strong> × {item.quantity}un</span>
                                                </div>
                                                <span className="font-mono text-amber-600 dark:text-primary font-bold">{item.meters.toFixed(2)}m</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Área de Preview (Lado Direito) */}
                    <div className="md:col-span-7 lg:col-span-7 h-[500px] lg:h-auto sticky top-4">
                        <div className="h-full flex flex-col bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-inner relative">

                            {/* Header Minimalista (Ruler Externo Tipo Imagem 3) */}
                            <div className="bg-slate-900 border-b border-slate-800 p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800/50 to-slate-900 pointer-events-none" />

                                {/* Régua Principal Superior */}
                                <div className={cn(
                                    "w-full max-w-xl relative flex flex-col items-center transition-all duration-300",
                                    hoveredField === 'rollWidth' ? "scale-[1.02] drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]" : "opacity-80"
                                )}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 shadow-xl backdrop-blur-md">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Escala Real</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                                        </div>
                                    </div>

                                    <div className="w-full h-12 flex flex-col items-center justify-end relative">
                                        <div className="text-[11px] font-mono font-bold text-slate-300 mb-3 flex items-center gap-3 tracking-widest">
                                            <span className="text-slate-600">←</span>
                                            <span className={cn(
                                                "transition-colors duration-300",
                                                hoveredField === 'rollWidth' ? "text-yellow-400" : "text-slate-300"
                                            )}>
                                                {rollWidth} CM
                                            </span>
                                            <span className="text-slate-600">→</span>
                                        </div>

                                        {/* Linha da Régua */}
                                        <div className={cn(
                                            "w-full h-px relative transition-all duration-500",
                                            hoveredField === 'rollWidth' ? "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]" : "bg-slate-700"
                                        )}>
                                            <div className={cn("absolute -top-2 left-0 w-px h-4 transition-colors", hoveredField === 'rollWidth' ? "bg-yellow-400" : "bg-slate-700")} />
                                            <div className={cn("absolute -top-2 right-0 w-px h-4 transition-colors", hoveredField === 'rollWidth' ? "bg-yellow-400" : "bg-slate-700")} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Canvas Area */}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 custom-scrollbar">
                                <div
                                    ref={previewRef}
                                    id="dtf-preview-paper"
                                    className="bg-white shadow-2xl relative transition-all duration-300 origin-top mx-auto overflow-hidden border border-slate-300"
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        aspectRatio: `${rollWidth} / ${visualTotalHeightCm}`,
                                    }}
                                >
                                    {/* Alerta de Performance Único e Flutuante */}
                                    {!isExporting && (mode === 'simple' ? results.hasWarning : multiResults.hasWarning) && (
                                        <div className="absolute top-12 right-4 z-40">
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-amber-200 shadow-xl rounded-full">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest text-center">Preview Limitado</span>
                                            </div>
                                        </div>
                                    )}
                                    {/* Regua de Medida do Topo (Ruler) */}
                                    <div className="absolute top-0 inset-x-0 h-10 flex flex-col items-center pointer-events-none z-30 opacity-60">
                                        <div className="w-full h-px bg-slate-300 relative mt-4">
                                            <div className="absolute -top-1 left-0 w-[1px] h-3 bg-slate-400" />
                                            <div className="absolute -top-1 right-0 w-[1px] h-3 bg-slate-400" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="bg-white px-2 py-0.5 text-[8px] font-mono font-bold text-slate-500 tracking-tighter">
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
                                        }}
                                    >
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
                                            {mode === 'simple' ? (
                                                <div
                                                    className="mx-auto h-full"
                                                    style={{ width: `${(results.contentWidth / results.usableWidth) * 100}%` }}
                                                >
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
                                                        }}
                                                    >
                                                        {Array.from({ length: isExporting ? quantity : Math.min(500, quantity) }).map((_, i) => (
                                                            <div key={`logo-${i}`}
                                                                className={cn(
                                                                    "bg-yellow-400 border border-yellow-600/50 rounded-sm flex items-center justify-center overflow-hidden transition-all duration-300",
                                                                    hoveredField === 'imageSize' ? "scale-105 shadow-[0_0_12px_rgba(250,204,21,0.8)] z-20 border-yellow-400" : "hover:bg-yellow-500"
                                                                )}
                                                                style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
                                                            >
                                                                <span className="text-[5px] sm:text-[6px] font-black text-yellow-900/40 select-none">
                                                                    {imageWidth}x{imageHeight}
                                                                </span>
                                                            </div>
                                                        ))}

                                                        {/* Sobra Técnica Visual */}
                                                        {quantity < results.totalRows * results.imagesPerRow &&
                                                            Array.from({ length: Math.min(results.imagesPerRow, results.totalRows * results.imagesPerRow - quantity) }).map((_, i) => (
                                                                <div key={`waste-${i}`}
                                                                    className="border border-dotted border-slate-200 bg-slate-50/30 flex items-center justify-center transition-opacity"
                                                                    style={{ aspectRatio: `${imageWidth} / ${imageHeight}`, opacity: hoveredField === 'imageSize' ? 0.2 : 1 }}
                                                                >
                                                                    <Layers className="h-2 w-2 text-slate-200" />
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center">
                                                    {multiResults.items.map((item, itemIdx) => {
                                                        const groupContentWidthCm = (item.width * item.imagesPerRow) + (separation * (item.imagesPerRow - 1));
                                                        const isLast = itemIdx === multiResults.items.length - 1;
                                                        return (
                                                            <div key={item.id}
                                                                className="flex flex-col items-center"
                                                                style={{
                                                                    width: `${(groupContentWidthCm / multiResults.usableWidth) * 100}%`,
                                                                    marginBottom: isLast ? 0 : `${(separation / (visualTotalHeightCm - (margin * 2))) * 100}%`
                                                                }}
                                                            >
                                                                <div className={cn(
                                                                    "grid content-start w-full transition-all duration-300",
                                                                    hoveredField === 'separation' ? "bg-purple-500/5 ring-1 ring-purple-500/20" : ""
                                                                )}
                                                                    style={{
                                                                        gridTemplateColumns: `repeat(${item.imagesPerRow}, 1fr)`,
                                                                        columnGap: `${(separation / groupContentWidthCm) * 100}%`,
                                                                        rowGap: `${(separation / (isExporting ? item.contentHeight : item.previewContentHeight)) * 100}%`,
                                                                        aspectRatio: `${groupContentWidthCm} / ${isExporting ? item.contentHeight : item.previewContentHeight}`
                                                                    }}
                                                                >
                                                                    {Array.from({ length: isExporting ? item.quantity : item.previewQuantity }).map((_, i) => {
                                                                        const color = itemColors[itemIdx % itemColors.length];
                                                                        return (
                                                                            <div key={`item-${item.id}-${i}`}
                                                                                className={cn(
                                                                                    "border rounded-sm flex items-center justify-center transition-all duration-300",
                                                                                    color.bg,
                                                                                    color.border,
                                                                                    (hoveredField === 'itemWidth' || hoveredField === 'itemHeight' || hoveredField === 'itemQuantity') ? "scale-[1.05] shadow-[0_0_12px_rgba(30,150,255,0.6)] z-20" : ""
                                                                                )}
                                                                                style={{ aspectRatio: `${item.width} / ${item.height}` }}
                                                                            >
                                                                                <span className={cn("text-[5px] font-bold opacity-40", color.text)}>{itemIdx + 1}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Margens Overlay Dinâmicas */}
                                    <div className={cn(
                                        "absolute inset-y-0 left-0 pointer-events-none z-10 flex transition-all duration-300",
                                        hoveredField === 'margin' ? "bg-emerald-500/20 shadow-[inset_-10px_0_15px_rgba(16,185,129,0.2)]" : ""
                                    )}
                                        style={{ width: `${((mode === 'simple' ? results.realSideMargin : margin) / rollWidth) * 100}%` }}>
                                        <div className={cn(
                                            "h-full border-r flex items-center justify-center transition-all",
                                            hoveredField === 'margin' ? "bg-emerald-500/30 border-emerald-500" : "bg-emerald-500/5 border-emerald-500/10"
                                        )} style={{ width: mode === 'simple' ? `${(margin / results.realSideMargin) * 100}%` : '100% ' }}>
                                            <div className="[writing-mode:vertical-lr] rotate-180 opacity-40">
                                                <span className={cn("text-[5px] font-bold uppercase tracking-widest", hoveredField === 'margin' ? "text-emerald-900" : "text-emerald-800")}>M. SEG {margin}CM</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "absolute inset-y-0 right-0 pointer-events-none z-10 flex flex-row-reverse transition-all duration-300",
                                        hoveredField === 'margin' ? "bg-emerald-500/20 shadow-[inset_10px_0_15px_rgba(16,185,129,0.2)]" : ""
                                    )}
                                        style={{ width: `${((mode === 'simple' ? results.realSideMargin : margin) / rollWidth) * 100}%` }}>
                                        <div className={cn(
                                            "h-full border-l flex items-center justify-center transition-all",
                                            hoveredField === 'margin' ? "bg-emerald-500/30 border-emerald-500" : "bg-emerald-500/5 border-emerald-500/10"
                                        )} style={{ width: mode === 'simple' ? `${(margin / results.realSideMargin) * 100}%` : '100%' }}>
                                            <div className="[writing-mode:vertical-lr] opacity-40">
                                                <span className={cn("text-[5px] font-bold uppercase tracking-widest", hoveredField === 'margin' ? "text-emerald-900" : "text-emerald-800")}>M. SEG {margin}CM</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Legenda e Status (Estilo Imagem 4) */}
                            <div className="px-4 py-3 border-t border-slate-200 bg-slate-900 flex flex-wrap items-center justify-between rounded-b-xl gap-4">
                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-yellow-400 rounded-sm shadow-[0_0_5px_rgba(250,204,21,0.5)]" />
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Logos</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-white border border-slate-700 rounded-sm" />
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Área Útil</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Margem (M)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-purple-500 rounded-sm" />
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Espaço (S)</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50 ml-auto">
                                    <Badge variant="outline" className="bg-transparent text-slate-300 font-bold text-[9px] border-slate-700 px-2 py-0">
                                        TOTAL: {(mode === 'simple' ? results.totalHeightCm : multiResults.totalHeightCm).toFixed(1)}cm
                                    </Badge>
                                    <div className="h-3 w-px bg-slate-700" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">ESCALA: 1:{Math.round(100 / visualTotalHeightCm * 10)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer profissional */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur-sm z-50 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                            <Calculator className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none">Cálculo Preciso</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">DIRECT-AI ENGINE v2.8</div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" size="sm" onClick={onClose} className="font-bold text-slate-500">Voltar</Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-bold px-4">
                                    <Share2 className="h-4 w-4" /> Finalizar Orçamento
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Enviar Dados</div>
                                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer text-green-600 font-bold py-2">
                                    <MessageSquare className="h-4 w-4" /> WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopyToClipboard} className="gap-2 cursor-pointer py-2">
                                    <Copy className="h-4 w-4" /> Copiar Resumo
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Exportar</div>
                                <DropdownMenuItem onClick={handleDownloadImage} className="gap-2 cursor-pointer py-2">
                                    <Download className="h-4 w-4" /> Baixar PNG
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
