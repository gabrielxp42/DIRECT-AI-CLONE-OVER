import React, { useState } from 'react';
import { LineConfig, SidebarProps } from '@/features/montador/lib/types';
import '@/features/montador/styles/Sidebar.css';

// ============================================
// SUB-COMPONENTS
// ============================================

const AnimatedBackground = () => (
    <div className="mr-animated-bg">
        <div className="mr-orb mr-orb-top" />
        <div className="mr-orb mr-orb-bottom" />
        <div className="mr-scanlines" />
        <div className="mr-grid" />
    </div>
);

const PremiumSlider = ({
    label,
    value,
    onChange,
    min = 0,
    max = 50,
    unit = "px"
}: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    unit?: string;
}) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="mr-slider-group">
            <div className="mr-slider-header">
                <label className="mr-slider-label">{label}</label>
                <div className="mr-slider-value">
                    <span className="mr-slider-number">{value}</span>
                    <span className="mr-slider-unit">{unit}</span>
                </div>
            </div>
            <div className="mr-slider-track-container">
                <div
                    className="mr-slider-track-fill"
                    style={{ width: `${percentage}%` }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="mr-slider-input"
                />
                <div
                    className="mr-slider-thumb"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />
            </div>
        </div>
    );
};

const HoloNumberInput = ({
    value,
    onChange,
    label,
    step = 0.1,
    min = -Infinity,
    max = Infinity
}: {
    value: number;
    onChange: (val: number) => void;
    label: string;
    step?: number;
    min?: number;
    max?: number;
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const fractionDigits = step >= 1 ? 0 : 1;

    const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const internalValueRef = React.useRef(value);

    React.useEffect(() => {
        internalValueRef.current = value;
    }, [value]);

    const stopChange = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const startChange = (direction: 1 | -1) => {
        stopChange();
        const updateVal = () => {
            let nextVal = internalValueRef.current + direction * step;
            if (nextVal < min) nextVal = min;
            if (nextVal > max) nextVal = max;
            const finalVal = Number(nextVal.toFixed(fractionDigits));
            internalValueRef.current = finalVal;
            onChange(finalVal);
        };
        updateVal();
        timeoutRef.current = setTimeout(() => {
            intervalRef.current = setInterval(updateVal, 50);
        }, 400);
    };

    return (
        <div className="mr-holo-input-container">
            <span className="mr-holo-label">{label}</span>
            <div className={`mr-holo-input-wrapper ${isFocused ? 'focused' : ''}`}>
                <div className="mr-holo-border" />
                <div className="mr-holo-inner">
                    <input
                        type="number"
                        step={step}
                        min={min}
                        max={max}
                        value={value.toFixed(fractionDigits)}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) onChange(val);
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className="mr-holo-input"
                    />
                    <div className="mr-holo-steppers">
                        <button
                            type="button"
                            onMouseDown={() => startChange(1)}
                            onMouseUp={stopChange}
                            onMouseLeave={stopChange}
                            onTouchStart={() => startChange(1)}
                            onTouchEnd={stopChange}
                            className="mr-holo-stepper"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 14l5-5 5 5H7z" />
                            </svg>
                        </button>
                        <div className="mr-holo-stepper-divider" />
                        <button
                            type="button"
                            onMouseDown={() => startChange(-1)}
                            onMouseUp={stopChange}
                            onMouseLeave={stopChange}
                            onTouchStart={() => startChange(-1)}
                            onTouchEnd={stopChange}
                            className="mr-holo-stepper"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 10l5 5 5-5H7z" />
                            </svg>
                        </button>
                    </div>
                </div>
                {isFocused && <div className="mr-holo-glow" />}
            </div>
        </div>
    );
};

const LineCard = ({
    line,
    index,
    isFreeMode,
    canvasWidthCm,
    onRemove,
    onDuplicate,
    onRotate,
    onUpdateWidth,
    onUpdateQuantity,
    onUpdateSpacing
}: {
    line: LineConfig;
    index: number;
    isFreeMode: boolean;
    canvasWidthCm: number;
    onRemove: () => void;
    onDuplicate: () => void;
    onRotate: () => void;
    onUpdateWidth: (width: number) => void;
    onUpdateQuantity: (quantity: number) => void;
    onUpdateSpacing: (spacing: number) => void;
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // No modo livre (isFreeMode), o erro ocorre apenas se um item individual for MAIOR que o canvas
    // No modo normal, usamos o result.success que valida se pelo menos uma cópia cabe com a margem
    const hasError = isFreeMode
        ? line.dimensions.widthCm > canvasWidthCm
        : !line.result.success;

    return (
        <div
            className={`mr-line-card ${isHovered ? 'hovered' : ''} ${hasError ? 'mr-error-state' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={hasError ? { borderColor: 'var(--mr-red)', boxShadow: '0 0 15px var(--mr-red-30)' } : {}}
        >
            <div className="mr-line-card-glow" />
            <div className="mr-line-card-border" />

            <div className="mr-line-card-content">
                {/* Header */}
                <div className="mr-line-card-header">
                    <div className="mr-line-card-info">
                        <div className="mr-line-card-badge" style={hasError ? { background: 'var(--mr-red)', color: 'white' } : {}}>
                            <span>{index + 1}</span>
                        </div>
                        <div className="mr-line-card-meta">
                            <span className="mr-line-card-label" style={hasError ? { color: 'var(--mr-red)' } : {}}>
                                {hasError ? 'ERRO' : 'Linha'}
                            </span>
                            <span className="mr-line-card-copies">
                                {hasError ? 'Não cabe!' : (isFreeMode ? `${line.quantity || 1}x selecionado(s)` : `${line.result.copies}x cópias na linha`)}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onDuplicate}
                            className="mr-action-btn mr-duplicate-btn"
                            title="Duplicar Linha"
                            style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s',
                                color: 'rgba(255,255,255,0.7)'
                            }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>

                        {isFreeMode && (
                            <button
                                type="button"
                                onClick={onRotate}
                                className="mr-action-btn mr-rotate-btn"
                                title="Rotacionar 90º"
                                style={{
                                    width: '28px', height: '28px', borderRadius: '6px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s',
                                    color: 'rgba(255,255,255,0.7)'
                                }}
                            >
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ transform: line.result.rotation === 90 ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onRemove}
                            className="mr-action-btn mr-delete-btn"
                            title="Remover"
                            style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(244, 63, 94, 0.1)', cursor: 'pointer',
                                border: '1px solid rgba(244, 63, 94, 0.2)', transition: 'all 0.2s',
                                color: '#f43f5e'
                            }}
                        >
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="mr-line-card-body">
                    {/* Thumbnail */}
                    <div className="mr-thumbnail-container" style={hasError ? { borderColor: 'var(--mr-red-50)' } : {}}>
                        <div className="mr-thumbnail-border" />
                        <div className="mr-thumbnail-inner">
                            <img
                                src={line.imageUrl}
                                alt="Preview"
                                className="mr-thumbnail-img"
                                style={hasError ? { opacity: 0.5, filter: 'grayscale(100%)' } : {}}
                            />
                        </div>
                        {hasError && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-8 h-8 text-[var(--mr-red)] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        )}
                        {!hasError && (
                            <div className="mr-thumbnail-overlay">
                                <span>Preview</span>
                            </div>
                        )}
                    </div>

                    {/* Stats & Input */}
                    <div className="mr-line-card-stats">
                        {/* Dimensions Display */}
                        <div className="mr-dimensions-box">
                            <span className="mr-dimension-value">{line.dimensions.widthCm.toFixed(1)}</span>
                            <span className="mr-dimension-separator">×</span>
                            <span className="mr-dimension-value">{line.dimensions.heightCm.toFixed(1)}</span>
                            <span className="mr-dimension-unit">cm</span>
                        </div>

                        {/* Largura Oculta (Slider + Input Numérico) */}
                        <div className="mr-individual-spacing" style={{ marginBottom: '8px' }}>
                            <HoloNumberInput
                                value={line.dimensions.widthCm}
                                onChange={onUpdateWidth}
                                label="Largura (cm)"
                            />

                            <input
                                type="range"
                                min="1"
                                max={canvasWidthCm || 100}
                                step="0.5"
                                value={line.dimensions.widthCm}
                                onChange={(e) => onUpdateWidth(Number(e.target.value))}
                                className="w-full h-1 mt-2 bg-[#ffffff20] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--mr-orange)]"
                                style={{ marginTop: '12px' }}
                            />
                        </div>

                        {/* Quantity Input (Somente Free Mode) */}
                        {isFreeMode && (
                            <div className="mr-individual-spacing" style={{ marginBottom: '8px' }}>
                                <HoloNumberInput
                                    value={line.quantity || 1}
                                    onChange={(val) => onUpdateQuantity(Math.max(1, Math.round(val)))}
                                    label="Quantidade"
                                    step={1}
                                    min={1}
                                />
                                <input
                                    type="range"
                                    min="1"
                                    max="500"
                                    step={1}
                                    value={line.quantity || 1}
                                    onChange={(e) => onUpdateQuantity(Number(e.target.value))}
                                    className="w-full h-1 mt-2 bg-[#ffffff20] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--mr-orange)]"
                                    style={{ marginTop: '12px' }}
                                />
                            </div>
                        )}

                        {/* Individual Spacing Control */}
                        <div className="mr-individual-spacing">
                            <label className="text-[10px] text-[#ffffff50] uppercase tracking-wider mb-1 block flex justify-between">
                                <span>Espaçamento Individual: {line.spacingPx ?? 20}px</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={line.spacingPx ?? 20}
                                onChange={(e) => onUpdateSpacing(Number(e.target.value))}
                                className="w-full h-1 bg-[#ffffff20] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--mr-orange)]"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmptyState = ({ onAddLine }: { onAddLine: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <label className="mr-empty-state">
        <input
            type="file"
            accept="image/*"
            multiple
            onChange={onAddLine}
            className="mr-hidden-input"
        />

        <div className="mr-empty-border" />
        <div className="mr-empty-bg" />

        <div className="mr-empty-icon-container">
            <div className="mr-empty-icon-box">
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
            <div className="mr-empty-plus">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
            </div>
        </div>

        <span className="mr-empty-title">Adicionar Imagens</span>
        <span className="mr-empty-subtitle">Arraste arquivos ou clique aqui</span>
    </label>
);

const ExportButton = ({ onClick, disabled, loading }: { onClick: () => void; disabled: boolean; loading?: boolean }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`mr-export-btn ${(disabled || loading) ? 'disabled' : ''}`}
        style={loading ? { cursor: 'wait', opacity: 0.8 } : {}}
    >
        <div className="mr-export-gradient" />
        <div className="mr-export-inner" />
        <div className="mr-export-glow" />

        <div className="mr-export-content">
            <span className="mr-export-text">{loading ? 'AGUARDE...' : 'Exportar Layout'}</span>
            <div className="mr-export-icon-box">
                {loading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" strokeWidth="4" />
                        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" opacity="0.75" />
                    </svg>
                ) : (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                )}
            </div>
        </div>

        {!loading && <div className="mr-export-shine" />}
    </button>
);

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================



// ... (AnimatedBackground, PremiumSlider, HoloNumberInput, LineCard, EmptyState, ExportButton)
// Re-using exiting components.

// New Settings Component
const SettingsPanel = ({
    smoothing,
    setSmoothing,
    themeColor,
    setThemeColor,
    canvasWidthCm,
    setCanvasWidthCm,
    onBack
}: {
    smoothing?: boolean;
    setSmoothing?: (val: boolean) => void;
    themeColor: string;
    setThemeColor: (color: string) => void;
    canvasWidthCm: number;
    setCanvasWidthCm: (val: number) => void;
    onBack: () => void;
}) => (
    <div className="mr-settings-panel">
        <div className="mr-settings-header">
            <h2 className="mr-settings-title">CONFIGURAÇÕES</h2>
            <button onClick={onBack} className="mr-back-btn">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div className="mr-settings-content">
            {/* Smooth Edges Toggle */}
            <div className="mr-setting-item">
                <div className="mr-setting-info">
                    <span className="mr-setting-label">SUAVIZAR BORDAS</span>
                    <span className="mr-setting-desc">Melhora a qualidade na exportação</span>
                </div>
                <label className="mr-toggle">
                    <input
                        type="checkbox"
                        checked={smoothing || false}
                        onChange={(e) => setSmoothing && setSmoothing(e.target.checked)}
                    />
                    <div className="mr-toggle-track">
                        <div className="mr-toggle-thumb" />
                    </div>
                </label>
            </div>

            {/* Theme Color */}
            <div className="mr-setting-item" style={{ flexWrap: 'wrap' }}>
                <div className="mr-setting-info" style={{ width: '100%', marginBottom: '12px' }}>
                    <span className="mr-setting-label">COR DO TEMA</span>
                    <span className="mr-setting-desc">Personalize a cor principal</span>
                </div>

                <div className="flex items-center gap-3 w-full">
                    <div className="mr-color-picker-wrapper" title="Cor Personalizada">
                        <input
                            type="color"
                            value={themeColor}
                            onChange={(e) => setThemeColor(e.target.value)}
                            className="mr-color-input"
                        />
                        <div className="mr-color-preview" style={{ backgroundColor: themeColor }} />
                    </div>

                    {/* Preset Colors */}
                    {['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#ef4444'].map(color => (
                        <button
                            key={color}
                            onClick={() => setThemeColor(color)}
                            title={color}
                            style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: color,
                                border: themeColor === color ? '2px solid white' : '2px solid transparent',
                                outline: themeColor === color ? `2px solid ${color}` : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: themeColor === color ? `0 0 10px ${color}80` : 'none',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Canvas Width Setting */}
            <div className="mr-setting-item">
                <div className="mr-setting-info">
                    <span className="mr-setting-label">LARGURA DA FOLHA</span>
                    <span className="mr-setting-desc">Largura do canvas em cm</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Botão Diminuir */}
                    <button
                        onMouseDown={() => {
                            // Diminuir uma vez imediatamente
                            (setCanvasWidthCm as any)((prev: number) => Math.max(20, prev - 1));
                            // Iniciar repetição ao segurar
                            const interval = setInterval(() => {
                                (setCanvasWidthCm as any)((prev: number) => Math.max(20, prev - 1));
                            }, 80);
                            const cleanup = () => {
                                clearInterval(interval);
                                window.removeEventListener('mouseup', cleanup);
                            };
                            window.addEventListener('mouseup', cleanup);
                        }}
                        style={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        −
                    </button>
                    <input
                        type="number"
                        min={20}
                        max={200}
                        step={1}
                        value={Number.isNaN(canvasWidthCm) ? '' : canvasWidthCm}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 20 && val <= 200) {
                                setCanvasWidthCm(val);
                            }
                        }}
                        className="w-16 px-2 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-center focus:outline-none focus:border-opacity-50"
                        style={{ borderColor: themeColor + '50' }}
                    />
                    {/* Botão Aumentar */}
                    <button
                        onMouseDown={() => {
                            // Aumentar uma vez imediatamente
                            (setCanvasWidthCm as any)((prev: number) => Math.min(200, prev + 1));
                            // Iniciar repetição ao segurar
                            const interval = setInterval(() => {
                                (setCanvasWidthCm as any)((prev: number) => Math.min(200, prev + 1));
                            }, 80);
                            const cleanup = () => {
                                clearInterval(interval);
                                window.removeEventListener('mouseup', cleanup);
                            };
                            window.addEventListener('mouseup', cleanup);
                        }}
                        style={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        +
                    </button>
                    <span className="text-white/50 text-sm ml-1">cm</span>
                </div>
            </div>

            <div className="p-4 bg-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.1)] mt-4">
                <p className="text-[10px] text-[var(--mr-white-40)] uppercase tracking-widest text-center">
                    Montador Rápido V3.1
                </p>
            </div>
        </div>
    </div>
);


export default function Sidebar({
    lines,
    onAddLine,
    onRemoveLine,
    onDuplicateLine,
    onRotateLine,
    onFillMeter,
    onUpdateLineWidth,
    onUpdateLineSpacing,
    spacingPx,
    setSpacingPx,
    spacingYPx,
    setSpacingYPx,
    onExport,
    canExport,
    isExporting,
    maxLines,
    smoothing,
    setSmoothing,
    themeColor,
    setThemeColor,
    canvasWidthCm,
    setCanvasWidthCm,
    totalHeightCm,
    isFreeMode,
    setIsFreeMode,
    onUpdateLineQuantity,
    orderNumber,
    itemName
}: SidebarProps) {

    const [showSettings, setShowSettings] = useState(false);


    return (
        <aside className="mr-sidebar" style={{ border: `2px solid ${themeColor}`, boxShadow: `0 0 30px ${themeColor}40`, borderRadius: '20px' }}>
            {/* Outer Glow - usando themeColor */}
            <div className="mr-sidebar-outer-glow" style={{ background: `linear-gradient(to right, ${themeColor}50, ${themeColor}80, ${themeColor}50)` }} />

            {/* Border Gradient - usando themeColor */}
            <div className="mr-sidebar-border" style={{ background: `linear-gradient(to bottom, ${themeColor}, ${themeColor}80, ${themeColor}50)` }} />

            {/* Main Container */}
            <div className="mr-sidebar-container">
                <AnimatedBackground />

                {/* === HEADER === */}
                <div className="mr-header">
                    <div className="mr-header-content">
                        {/* Logo */}
                        <div 
                            className="mr-logo-container cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => {
                                if (window.innerWidth >= 768) {
                                    window.dispatchEvent(new CustomEvent('OVERPIXEL_NAVIGATE', { detail: '/' }));
                                } else {
                                    window.dispatchEvent(new CustomEvent('toggle-launcher'));
                                }
                            }}
                        >
                            <div className="mr-logo-row">
                                <img src="/montador/logo-montador-fast.png" alt="Logo" className="mr-logo-icon" style={{ width: '42px', height: '42px', marginRight: '10px' }} />
                                <div className="flex flex-col">
                                    <h1 className="mr-logo-text">MONTADOR RÁPIDO</h1>
                                    {orderNumber && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 animate-pulse w-fit">
                                            <div className="w-1 h-1 rounded-full bg-orange-500" />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">
                                                {itemName ? `${itemName} (#${orderNumber})` : `Pedido #${orderNumber}`}
                                            </span>
                                        </div>
                                    )}

                                </div>
                            </div>
                            <span className="mr-subtitle">DTF Factory • Pro Edition</span>

                        </div>

                        <div className="flex items-center gap-3">

                            {/* Settings Button - mesmo estilo do Add Button */}
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`mr-add-btn settings-variant ${showSettings ? 'active' : ''}`}
                                title="Configurações"
                            >
                                <div className="mr-add-btn-glow" />
                                <div className="mr-add-btn-inner">
                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </button>

                            {/* Add Button */}
                            <label className={`mr-add-btn ${lines.length >= maxLines ? 'disabled' : ''}`}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={onAddLine}
                                    className="mr-hidden-input"
                                    disabled={lines.length >= maxLines}
                                />

                                <div className="mr-add-btn-glow" />
                                <div className="mr-add-btn-inner">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <div className="mr-add-btn-counter">{lines.length}/{maxLines}</div>
                            </label>

                            {/* Fill 1m Button */}
                            {lines.length > 0 && (
                                <button
                                    onClick={onFillMeter}
                                    className="mr-add-btn"
                                    title="Preencher 1 Metro"
                                    disabled={lines.length >= maxLines}
                                    style={{ background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(202, 138, 4, 0) 100%)', borderColor: 'rgba(234, 179, 8, 0.5)' }}
                                >
                                    <div className="mr-add-btn-glow" style={{ background: 'rgba(234, 179, 8, 0.3)' }} />
                                    <div className="mr-add-btn-inner" style={{ color: '#facc15' }}>
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        </svg>
                                    </div>
                                    <div className="mr-add-btn-counter" style={{ background: 'rgba(234, 179, 8, 0.2)' }}>1m</div>
                                </button>
                            )}
                        </div>

                    </div>

                    {/* Mode Toggle Banner */}
                    <div className="px-4 pb-3" style={{ marginTop: '24px' }}>
                        <div
                            className={`mr-mode-toggle ${isFreeMode ? 'active' : ''}`}
                            onClick={() => setIsFreeMode(!isFreeMode)}
                            style={isFreeMode ? { '--active-color': themeColor, borderColor: `${themeColor}60` } as React.CSSProperties : undefined}
                        >
                            <div className="mr-mode-toggle-bg" style={isFreeMode ? { background: themeColor } : undefined} />
                            <div className="mr-mode-toggle-info">
                                <span className="mr-mode-toggle-title">
                                    {isFreeMode ? 'Modo Misto / Adição Livre' : 'Modo Padrão'}
                                </span>
                                <span className="mr-mode-toggle-desc">
                                    {isFreeMode
                                        ? 'As imagens não preenchem a linha toda sozinhas.'
                                        : 'A linha inteira é feita da mesma estampa.'}
                                </span>
                            </div>
                            <div className="mr-mode-switch">
                                <div className="mr-mode-switch-track" style={isFreeMode ? { background: themeColor } : undefined}>
                                    <div className="mr-mode-switch-thumb" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="mr-separator" />
                </div>

                {/* === CONTENT === */}
                <div className="mr-content">
                    {showSettings ? (
                        <SettingsPanel
                            smoothing={smoothing}
                            setSmoothing={setSmoothing}
                            themeColor={themeColor}
                            setThemeColor={setThemeColor}
                            canvasWidthCm={canvasWidthCm}
                            setCanvasWidthCm={setCanvasWidthCm}
                            onBack={() => setShowSettings(false)}
                        />
                    ) : (
                        lines.length === 0 ? (
                            <EmptyState onAddLine={onAddLine} />
                        ) : (
                            <>
                                {/* Line Cards */}
                                {lines.map((line, index) => (
                                    <LineCard
                                        key={line.id}
                                        line={line}
                                        index={index}
                                        isFreeMode={isFreeMode}
                                        canvasWidthCm={canvasWidthCm}
                                        onRemove={() => onRemoveLine(line.id)}
                                        onDuplicate={() => onDuplicateLine(line.id)}
                                        onRotate={() => onRotateLine(line.id)}
                                        onUpdateWidth={(width) => onUpdateLineWidth(line.id, width)}
                                        onUpdateQuantity={(quantity) => onUpdateLineQuantity(line.id, quantity)}
                                        onUpdateSpacing={(spacing) => onUpdateLineSpacing(line.id, spacing)}
                                    />
                                ))}

                                {/* Spacing Controls */}
                                <div className="mr-spacing-card">
                                    <div className="mr-spacing-card-border" />

                                    <div className="mr-spacing-card-content">
                                        {/* Header */}
                                        <div className="mr-spacing-header">
                                            <div className="mr-spacing-icon">
                                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                                </svg>
                                            </div>
                                            <span className="mr-spacing-title">Espaçamento</span>
                                        </div>

                                        {/* Sliders */}
                                        <div className="mr-spacing-sliders">
                                            <PremiumSlider
                                                label="Horizontal (X)"
                                                value={spacingPx}
                                                onChange={setSpacingPx}
                                            />
                                            <PremiumSlider
                                                label="Vertical (Y)"
                                                value={spacingYPx}
                                                onChange={setSpacingYPx}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )
                    )}
                </div>

                {/* === FOOTER === */}
                {!showSettings && lines.length > 0 && (
                    <div className="mr-footer">
                        <div className="mr-footer-line" />

                        <ExportButton onClick={onExport} disabled={!canExport} loading={isExporting} />

                        {/* Status Bar */}
                        <div className="mr-status-bar">
                            <div className="mr-status-indicator">
                                <div className="mr-status-dot" />
                                <span style={{ textShadow: `0 0 10px ${themeColor}` }}>Sistema Pronto</span>
                            </div>
                            <div className="mr-status-divider" />
                            <span className="mr-status-count">
                                {lines.length}/{maxLines} imagens • <span style={{ color: themeColor, fontWeight: 'bold' }}>{totalHeightCm.toFixed(1)} cm</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
