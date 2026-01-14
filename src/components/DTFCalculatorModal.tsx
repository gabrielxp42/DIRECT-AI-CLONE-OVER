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

export const DTFCalculatorModal = ({ isOpen, onClose, initialData }: DTFCalculatorModalProps) => {
    // Inputs
    const [rollWidth, setRollWidth] = useState(initialData?.rollWidth || 58);
    const [imageWidth, setImageWidth] = useState(initialData?.imageWidth || 5);
    const [imageHeight, setImageHeight] = useState(initialData?.imageHeight || 5);
    const [separation, setSeparation] = useState(0.5);
    const [margin, setMargin] = useState(1);
    const [quantity, setQuantity] = useState(initialData?.quantity || 100);

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
            totalHeightCm
        };
    }, [rollWidth, imageWidth, imageHeight, separation, margin, quantity]);

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

    const InfoTooltip = ({ label, content, id, className, fieldId }: { label: string, content: string, id?: string, className?: string, fieldId: string }) => (
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
                <TooltipContent side="top" className="max-w-[200px] text-[11px] bg-slate-900 text-white border-primary/20">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    // Componente de Input numérico com botões +/- customizados (Touch-friendly)
    const NumberInput = ({
        id,
        value,
        onChange,
        min = 0,
        max = 9999,
        step = 1,
        fieldId,
        className = "",
        highlight = false
    }: {
        id: string,
        value: number,
        onChange: (val: number) => void,
        min?: number,
        max?: number,
        step?: number,
        fieldId: string,
        className?: string,
        highlight?: boolean
    }) => {
        const [inputValue, setInputValue] = useState<string>(value.toString());

        // Sincroniza o estado local quando o valor externo muda (ex: botões +/- ou presets)
        useEffect(() => {
            setInputValue(value.toString());
        }, [value]);

        const increment = () => onChange(Math.min(max, Math.round((value + step) * 100) / 100));
        const decrement = () => onChange(Math.max(min, Math.round((value - step) * 100) / 100));

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value;
            setInputValue(val); // Permite digitar livremente (inclusive vazio)

            const num = parseFloat(val);
            if (!isNaN(num)) {
                onChange(num);
            }
        };

        const handleBlur = () => {
            setHoveredField(null);
            // Ao sair do campo, garante que o valor seja um número válido dentro dos limites
            let num = parseFloat(inputValue);
            if (isNaN(num)) num = min;
            const clamped = Math.max(min, Math.min(max, num));
            onChange(clamped);
            setInputValue(clamped.toString());
        };

        return (
            <div
                className={cn(
                    "relative flex items-center",
                    highlight && "ring-2 ring-primary/50 rounded-lg"
                )}
                onMouseEnter={() => setHoveredField(fieldId)}
                onMouseLeave={() => setHoveredField(null)}
            >
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-r-none border-r-0 bg-muted hover:bg-primary/20 hover:text-primary active:scale-95 transition-all touch-manipulation"
                    onClick={decrement}
                    disabled={value <= min}
                >
                    <Minus className="h-4 w-4" />
                </Button>
                <Input
                    id={id}
                    type="text" // Mudado para text para melhor controle de digitação, mas com inputMode decimal
                    inputMode="decimal"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={(e) => { e.target.select(); setHoveredField(fieldId); }}
                    onBlur={handleBlur}
                    className={cn(
                        "h-10 rounded-none text-center font-semibold text-base border-x-0",
                        className
                    )}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-l-none border-l-0 bg-muted hover:bg-primary/20 hover:text-primary active:scale-95 transition-all touch-manipulation"
                    onClick={increment}
                    disabled={value >= max}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-primary/20 shadow-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-primary">
                        <Calculator className="h-6 w-6" />
                        <DialogTitle className="text-2xl font-bold">Calculadora de Orçamento DTF</DialogTitle>
                    </div>
                    <DialogDescription>
                        Simule o aproveitamento das suas imagens no rolo e calcule a metragem necessária.
                    </DialogDescription>
                    <div className="flex items-center gap-2 mt-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-full w-fit border border-slate-200 dark:border-slate-700/50 shadow-lg animate-in slide-in-from-bottom-2 duration-500">
                        <Sparkles className="h-4 w-4 text-primary flex-shrink-0 animate-pulse" />
                        <span className="text-xs text-slate-700 dark:text-slate-200 font-medium" key={currentTipIndex}>
                            {aiTips[currentTipIndex]}
                        </span>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-4">
                    {/* Formulário - 5 colunas */}
                    <div className="md:col-span-5 space-y-4">
                        <Card className="border-primary/10 bg-primary/5">
                            <CardContent className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <Ruler className="h-3 w-3" /> Configurações do Material (Rolo)
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
                                            />
                                            <div className="flex gap-1 pt-1">
                                                {[30, 58].map((w) => (
                                                    <Button
                                                        key={w}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`h-7 text-[10px] flex-1 touch-manipulation transition-all ${rollWidth === w ? 'bg-primary/20 border-primary text-primary font-bold' : 'text-muted-foreground'}`}
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
                                            />
                                            <div className="flex gap-1 pt-1">
                                                {[0.5, 1, 1.5, 2].map((m) => (
                                                    <Button
                                                        key={m}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`h-7 flex-1 text-[10px] uppercase font-bold transition-all ${margin === m ? 'bg-primary/20 border-primary text-primary' : 'text-muted-foreground hover:bg-primary/5'}`}
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

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                                        <Layers className="h-3 w-3" /> Tamanho da sua Logo
                                    </Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5 p-0.5">
                                            <div className="min-h-[32px] flex items-end pb-1">
                                                <InfoTooltip
                                                    id="imageWidth"
                                                    fieldId="imageSize"
                                                    label="Largura da Logo (cm)"
                                                    content="A largura final da logo que você desenhou."
                                                />
                                            </div>
                                            <NumberInput
                                                id="imageWidth"
                                                value={imageWidth}
                                                onChange={setImageWidth}
                                                min={0.5}
                                                max={50}
                                                step={0.5}
                                                fieldId="imageSize"
                                            />
                                        </div>
                                        <div className="space-y-1.5 p-0.5">
                                            <div className="min-h-[32px] flex items-end pb-1">
                                                <InfoTooltip
                                                    id="imageHeight"
                                                    fieldId="imageSize"
                                                    label="Altura da Logo (cm)"
                                                    content="A altura final da logo que você desenhou."
                                                />
                                            </div>
                                            <NumberInput
                                                id="imageHeight"
                                                value={imageHeight}
                                                onChange={setImageHeight}
                                                min={0.5}
                                                max={50}
                                                step={0.5}
                                                fieldId="imageSize"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                        <div className="space-y-1.5 p-0.5">
                                            <div className="min-h-[32px] flex items-end pb-1">
                                                <InfoTooltip
                                                    id="separation"
                                                    fieldId="separation"
                                                    label="Espaço entre Logos (cm)"
                                                    content="Distância mínima entre um adesivo e outro para facilitar o corte manual (recomendado: 0.5cm)."
                                                />
                                            </div>
                                            <NumberInput
                                                id="separation"
                                                value={separation}
                                                onChange={setSeparation}
                                                min={0}
                                                max={3}
                                                step={0.1}
                                                fieldId="separation"
                                            />
                                            <div className="flex gap-1 pt-1">
                                                {[0.3, 0.5, 1].map((s) => (
                                                    <Button
                                                        key={s}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`h-7 text-[10px] flex-1 touch-manipulation transition-all ${separation === s ? 'bg-primary/20 border-primary text-primary font-bold' : 'text-muted-foreground'}`}
                                                        onClick={() => setSeparation(s)}
                                                    >
                                                        {s}cm
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 p-0.5">
                                            <div className="min-h-[32px] flex items-end pb-1">
                                                <InfoTooltip
                                                    id="quantity"
                                                    fieldId="quantity"
                                                    label="Quantas Logos Precisa?"
                                                    content="O total de adesivos que você deseja produzir nesse pedido."
                                                    className="font-bold text-primary"
                                                />
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
                                                className="font-bold text-primary"
                                            />
                                        </div>
                                    </div>

                                    {/* Novo: Calcular por Metragem */}
                                    <div className="pt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ou preencher por metragem</span>
                                            <div className="h-px w-full bg-slate-200 dark:bg-slate-800" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="Ex: 4 metros"
                                                    value={targetMeters || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(',', '.');
                                                        handleTargetMetersChange(Number(val));
                                                    }}
                                                    className="h-9 text-xs pr-7 bg-primary/5 border-dashed border-primary/20 focus:border-primary/50 transition-all"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">m</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-3 text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
                                                onClick={() => setTargetMeters(0)}
                                            >
                                                LIMPAR
                                            </Button>
                                        </div>
                                    </div>
                                </div>
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
                            <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-lg ring-4 ring-primary/20 flex flex-col items-center justify-center text-center scale-105 transition-transform">
                                <span className="text-[10px] uppercase font-bold opacity-80">Metragem Necessária</span>
                                <span className="text-3xl font-black">{results.totalMeters.toFixed(2)}m</span>
                            </div>
                            <div className="p-3 bg-secondary text-secondary-foreground rounded-xl shadow-md border flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] uppercase font-bold opacity-70">Logos por Metro</span>
                                <span className="text-2xl font-black">{results.imagesPerMeter} un</span>
                            </div>
                        </div>

                        <div className="bg-muted p-3 rounded-lg flex items-start gap-2 border">
                            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="text-[11px] leading-tight text-muted-foreground">
                                <strong>Resumo:</strong> Cabem <strong>{results.imagesPerRow} logos</strong> por linha.
                                Sua produção terá <strong>{results.totalRows} linhas</strong> de imagens.
                                Aproveitamento de <strong>{results.efficiency}%</strong> da largura total.
                            </div>
                        </div>
                    </div>

                    {/* Preview Visual - 7 colunas */}
                    <div className="md:col-span-7 flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                                <LayoutGrid className="h-3 w-3" /> Preview de Impressão
                            </Label>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                Mesa de Impressão: {rollWidth}cm
                            </span>
                        </div>

                        <div className="flex-1 bg-slate-950 dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-800 p-2 overflow-hidden relative flex flex-col shadow-inner">
                            {/* Régua de largura em cima */}
                            <div className={cn(
                                "relative h-6 border-b border-slate-200 dark:border-slate-700 mx-2 flex items-end transition-colors",
                                hoveredField === 'rollWidth' ? "bg-primary/20 border-primary" : ""
                            )}>
                                <div className={cn("absolute left-0 bottom-0 w-px h-2 bg-slate-300 dark:bg-slate-500", hoveredField === 'rollWidth' ? "bg-primary" : "")} />
                                <div className={cn("absolute right-0 bottom-0 w-px h-2 bg-slate-300 dark:bg-slate-500", hoveredField === 'rollWidth' ? "bg-primary" : "")} />
                                <div className={cn(
                                    "w-full text-center text-[9px] font-mono mb-1",
                                    hoveredField === 'rollWidth' ? "text-primary font-bold animate-pulse" : "text-slate-400"
                                )}>
                                    &larr; {rollWidth} cm &rarr;
                                </div>
                            </div>

                            {/* Rolo de Impressão */}
                            <div className="flex-1 relative overflow-y-auto scrollbar-hide p-2 bg-slate-100/10 dark:bg-slate-800/50 rounded-lg m-2">
                                <div
                                    ref={previewRef}
                                    className="mx-auto bg-white shadow-inner relative transition-all duration-300"
                                    style={{
                                        width: '100%',
                                        aspectRatio: `${rollWidth} / ${results.totalHeightCm}`,
                                    }}
                                >
                                    {/* Área útil central (entre as margens laterais) */}
                                    <div
                                        className="absolute transition-all duration-300"
                                        style={{
                                            left: `${(results.realSideMargin / rollWidth) * 100}%`,
                                            right: `${(results.realSideMargin / rollWidth) * 100}%`,
                                            top: `${(margin / (results.totalHeightCm)) * 100}%`,
                                            bottom: `${(margin / (results.totalHeightCm)) * 100}%`,
                                        }}
                                    >
                                        {/* Grid de Logos */}
                                        <div
                                            className="w-full h-full grid content-start justify-center"
                                            style={{
                                                gridTemplateColumns: `repeat(${results.imagesPerRow}, ${(imageWidth / results.contentWidth) * 100}%)`,
                                                columnGap: `${(separation / results.contentWidth) * 100}%`,
                                                rowGap: `${(separation / results.contentHeight) * 100}%`,
                                                backgroundColor: hoveredField === 'separation' ? 'rgba(244, 114, 182, 0.3)' : 'transparent',
                                                transition: 'background-color 0.3s'
                                            }}
                                        >
                                            {Array.from({ length: Math.min(1000, quantity) }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "border rounded-sm flex items-center justify-center overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-300",
                                                        (hoveredField === 'imageSize' || hoveredField === 'quantity')
                                                            ? "bg-yellow-500 border-yellow-700 scale-95 shadow-lg z-20"
                                                            : "bg-yellow-400 border-yellow-600/50"
                                                    )}
                                                    style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
                                                >
                                                    <span className={cn(
                                                        "text-[6px] font-black pointer-events-none",
                                                        (hoveredField === 'imageSize' || hoveredField === 'quantity') ? "text-yellow-950 scale-125" : "text-yellow-900/60"
                                                    )}>
                                                        {imageWidth}x{imageHeight}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Margens Laterais - Container que ocupa toda a sobra real */}
                                    <div className="absolute inset-y-0 left-0 pointer-events-none z-10 flex" style={{ width: `${(results.realSideMargin / rollWidth) * 100}%` }}>
                                        {/* Segmento 1: Margem de Segurança Definida (Verde) */}
                                        {margin > 0 && (
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-300 border-r border-emerald-500/20 flex items-center justify-center",
                                                    hoveredField === 'margin' ? "bg-emerald-500/40" : "bg-emerald-500/20"
                                                )}
                                                style={{ width: `${(margin / results.realSideMargin) * 100}%` }}
                                            >
                                                <div className="[writing-mode:vertical-lr] rotate-180">
                                                    <span className="text-[7px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-none">
                                                        {margin}cm
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {/* Segmento 2: Sobra Técnica (Cinza) */}
                                        {results.realSideMargin > margin && (
                                            <div
                                                className="h-full flex-1 bg-slate-500/5 dark:bg-slate-400/5 transition-all duration-300 flex items-center justify-center border-r border-slate-500/10"
                                            >
                                                {results.realSideMargin - margin > 0.1 && (
                                                    <div className="[writing-mode:vertical-lr] rotate-180 opacity-40">
                                                        <span className="text-[6px] font-medium text-slate-500 uppercase tracking-tighter leading-none">
                                                            +{(results.realSideMargin - margin).toFixed(1)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="absolute inset-y-0 right-0 pointer-events-none z-10 flex flex-row-reverse" style={{ width: `${(results.realSideMargin / rollWidth) * 100}%` }}>
                                        {/* Segmento 1: Margem de Segurança Definida (Verde) */}
                                        {margin > 0 && (
                                            <div
                                                className={cn(
                                                    "h-full transition-all duration-300 border-l border-emerald-500/20 flex items-center justify-center",
                                                    hoveredField === 'margin' ? "bg-emerald-500/40" : "bg-emerald-500/20"
                                                )}
                                                style={{ width: `${(margin / results.realSideMargin) * 100}%` }}
                                            >
                                                <div className="[writing-mode:vertical-lr]">
                                                    <span className="text-[7px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-none">
                                                        {margin}cm
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {/* Segmento 2: Sobra Técnica (Cinza) */}
                                        {results.realSideMargin > margin && (
                                            <div
                                                className="h-full flex-1 bg-slate-500/5 dark:bg-slate-400/5 transition-all duration-300 flex items-center justify-center border-l border-slate-500/10"
                                            >
                                                {results.realSideMargin - margin > 0.1 && (
                                                    <div className="[writing-mode:vertical-lr] opacity-40">
                                                        <span className="text-[6px] font-medium text-slate-500 uppercase tracking-tighter leading-none">
                                                            +{(results.realSideMargin - margin).toFixed(1)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Overlays de MARGEM - Topo (Só aparece se configurado > 0) */}
                                    {margin > 0 && (
                                        <div
                                            className={cn(
                                                "absolute top-0 inset-x-0 transition-all duration-300 pointer-events-none z-30 border-b border-emerald-500/20 bg-emerald-500/20"
                                            )}
                                            style={{ height: `${(margin / results.totalHeightCm) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[7px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-none">{margin}cm</span>
                                            </div>
                                        </div>
                                    )}
                                    {/* Fundo (Só aparece se configurado > 0) */}
                                    {margin > 0 && (
                                        <div
                                            className={cn(
                                                "absolute bottom-0 inset-x-0 transition-all duration-300 pointer-events-none z-30 border-t border-emerald-500/20 bg-emerald-500/20"
                                            )}
                                            style={{ height: `${(margin / results.totalHeightCm) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[7px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-none">{margin}cm</span>
                                            </div>
                                        </div>
                                    )}

                                    {quantity > results.imagesPerRow * 20 && (
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent flex items-end justify-center pb-4 z-30">
                                            <span className="text-[10px] text-muted-foreground font-medium bg-white/80 px-2 py-1 rounded shadow-sm border">
                                                + {quantity - results.imagesPerRow * 20} logos simplificadas no preview
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Legenda (Ajustada para modo claro/escuro) */}
                            <div className="p-2 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 rounded-b-xl">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 bg-yellow-400 border border-yellow-600/50" />
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Logos</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 bg-white border border-slate-200 shadow-sm" />
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Área Útil</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 bg-emerald-400/50 border border-emerald-500" />
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Margem (M)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 bg-fuchsia-400/50 border border-fuchsia-500" />
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Espaço (S)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calculator className="h-4 w-4" />
                        <span className="text-xs font-semibold">DIRECT-AI CALC v2.0</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    disabled={isExporting}
                                    className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                                >
                                    {isExporting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Share2 className="h-4 w-4" />
                                    )}
                                    Enviar Orçamento <ChevronRight className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Formato Texto</div>
                                <DropdownMenuItem onClick={handleCopyToClipboard} className="gap-2 cursor-pointer py-2">
                                    <Copy className="h-4 w-4" /> Copiar Resumo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer text-green-600 focus:text-green-600 focus:bg-green-50 py-2">
                                    <MessageSquare className="h-4 w-4" /> Enviar p/ WhatsApp
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Exportar Preview</div>
                                <DropdownMenuItem onClick={handleDownloadImage} className="gap-2 cursor-pointer py-2">
                                    <Download className="h-4 w-4" /> Baixar Imagem (PNG)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopyImageToClipboard} className="gap-2 cursor-pointer py-2">
                                    <ImageIcon className="h-4 w-4" /> Copiar Imagem Layout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
