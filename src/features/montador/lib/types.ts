// Tipos do sistema de packing
export interface ImageDimensions {
    widthCm: number;
    heightCm: number;
    widthPx: number;
    heightPx: number;
    dpi: number;
    mask?: Uint8Array; // Máscara de colisão linearizada (0 ou 1)
    maskWidth?: number; // Largura da máscara em células
    maskHeight?: number; // Altura da máscara em células
}

export interface PackingResult {
    success: boolean;
    copies: number;
    rotation: 0 | 90 | 180 | 270;
    canvasWidthCm: number;
    canvasHeightCm: number;
    wastedSpaceCm: number;
    stampWidthCm: number;
    stampHeightCm: number;
    nestingMode: 'standard' | 'alternating'; // Modo de encaixe
    itemPositions?: number[]; // Posições X exatas de cada cópia (opcional)
    suggestion?: OptimizationSuggestion;
    error?: string;
}

export interface OptimizationSuggestion {
    type: 'resize' | 'rotate' | 'warning';
    message: string;
    currentSize: { width: number; height: number };
    suggestedSize?: { width: number; height: number };
    improvement?: {
        additionalCopies: number;
        sizeReduction: number;
    };
}

export interface LayoutItem {
    x: number; // posição em cm
    y: number;
    width: number; // dimensões em cm
    height: number;
    rotation: number;
}

export interface FinalLayout {
    canvasWidth: number; // cm
    canvasHeight: number; // cm
    items: LayoutItem[];
    totalCopies: number;
}

// Multi-linha: cada linha tem sua própria imagem e configuração
export interface LineConfig {
    id: string;
    imageUrl: string;
    dimensions: ImageDimensions;
    result: PackingResult;
    yOffset: number; // Posição Y em cm
    spacingPx?: number;
    quantity?: number; // Para o Modo Livre: quantas cópias devem ser geradas
}

export interface SidebarProps {
    lines: LineConfig[];
    onAddLine: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveLine: (id: string) => void;
    onDuplicateLine: (id: string) => void;
    onRotateLine: (id: string) => void;
    onFillMeter: () => void;
    onUpdateLineWidth: (id: string, width: number) => void;
    onUpdateLineSpacing: (id: string, spacing: number) => void;
    spacingPx: number;
    setSpacingPx: (val: number) => void;
    spacingYPx: number;
    setSpacingYPx: (val: number) => void;
    onExport: () => void;
    canExport: boolean;
    isExporting?: boolean;
    maxLines: number;
    smoothing: boolean;
    setSmoothing: (val: boolean) => void;
    themeColor: string;
    setThemeColor: (color: string) => void;
    canvasWidthCm: number;
    setCanvasWidthCm: (val: number) => void;
    totalHeightCm: number;
    isFreeMode: boolean;
    setIsFreeMode: (val: boolean) => void;
    onUpdateLineQuantity: (id: string, quantity: number) => void;
}
