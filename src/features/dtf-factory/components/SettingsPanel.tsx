

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Edit2, Save, FolderOpen, Palette, Settings as SettingsIcon } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

interface PromptStyle {
    id: string;
    name: string;
    suffix: string;
    isDefault?: boolean;
}

// Estilos padrão
const DEFAULT_STYLES: PromptStyle[] = [
    { id: 'none', name: 'Nenhum', suffix: '', isDefault: true },
    { id: 'streetwear', name: 'Streetwear', suffix: ', urban streetwear style, bold graphic design, graffiti influence', isDefault: true },
    { id: 'vintage', name: 'Vintage', suffix: ', vintage retro style, distressed texture, classic americana', isDefault: true },
    { id: 'neon', name: 'Neon', suffix: ', neon glow effect, cyberpunk aesthetic, vibrant colors', isDefault: true },
    { id: 'minimal', name: 'Minimalista', suffix: ', minimalist design, clean lines, simple shapes', isDefault: true },
    { id: 'grunge', name: 'Grunge', suffix: ', grunge style, rough textures, distressed look', isDefault: true },
    { id: 'tribal', name: 'Tribal', suffix: ', tribal art style, bold patterns, ethnic motifs', isDefault: true },
    { id: 'cartoon', name: 'Cartoon', suffix: ', cartoon illustration style, bold outlines, vibrant colors', isDefault: true },
];

const STORAGE_KEY = 'dtf-prompt-styles';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    styles: PromptStyle[];
    onStylesChange: (styles: PromptStyle[]) => void;
    isWidgetMode: boolean;
    isProMode?: boolean;
    hasLicense?: boolean;
    onToggleMode?: () => void;
}


type Tab = 'general' | 'styles';

export default function SettingsPanel({ isOpen, onClose, styles, onStylesChange, isWidgetMode, isProMode, hasLicense, onToggleMode }: SettingsPanelProps) {

    const [activeTab, setActiveTab] = useState<Tab>('styles');
    const [savePath, setSavePath] = useState<string>('Carregando...');
    const [editingStyle, setEditingStyle] = useState<PromptStyle | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newStyle, setNewStyle] = useState<PromptStyle>({ id: '', name: '', suffix: '' });

    useEffect(() => {
        electronBridge.getSavePath().then(setSavePath);
    }, []);

    const handleSelectSavePath = async () => {
        const newPath = await electronBridge.selectSavePath();
        if (newPath) setSavePath(newPath);
    };

    const handleOpenFolder = () => {
        electronBridge.openFolder();
    };

    // Criar novo estilo
    const handleCreateStyle = () => {
        if (!newStyle.name.trim()) return;

        const id = `custom-${Date.now()}`;
        const style: PromptStyle = {
            id,
            name: newStyle.name.trim(),
            suffix: newStyle.suffix.trim() ? `, ${newStyle.suffix.trim()}` : '',
        };

        onStylesChange([...styles, style]);
        setNewStyle({ id: '', name: '', suffix: '' });
        setIsCreating(false);
    };

    // Salvar edição
    const handleSaveEdit = () => {
        if (!editingStyle) return;

        const updated = styles.map(s =>
            s.id === editingStyle.id ? editingStyle : s
        );
        onStylesChange(updated);
        setEditingStyle(null);
    };

    // Deletar estilo
    const handleDeleteStyle = (id: string) => {
        const style = styles.find(s => s.id === id);
        if (style?.isDefault) return; // Não pode deletar estilos padrão

        onStylesChange(styles.filter(s => s.id !== id));
    };

    // Resetar para padrão
    const handleResetStyles = () => {
        onStylesChange(DEFAULT_STYLES);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-2xl max-h-[80vh] bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                        <h2 className="text-xl font-bold">Configurações</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'general'
                                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            <SettingsIcon size={16} />
                            Geral
                        </button>
                        <button
                            onClick={() => setActiveTab('styles')}
                            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'styles'
                                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                        >
                            <Palette size={16} />
                            Estilos de Prompt
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">

                        {/* Tab: Geral */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-white/60 mb-2">
                                        Pasta de Salvamento
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-sm text-white/70 truncate border border-white/10">
                                            {savePath}
                                        </div>
                                        <button
                                            onClick={handleSelectSavePath}
                                            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                                        >
                                            <FolderOpen size={18} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleOpenFolder}
                                    className="w-full py-3 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-colors font-medium"
                                >
                                    Abrir Pasta de Imagens
                                </button>

                                <div className="pt-4 border-t border-white/10">
                                    {hasLicense && onToggleMode && (
                                        <button
                                            onClick={() => { onToggleMode(); onClose(); }}
                                            className={`w-full py-3 px-4 rounded-xl transition-colors font-medium flex items-center justify-center gap-2 ${isProMode
                                                    ? 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                                                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300'
                                                }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${isProMode ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
                                            {isProMode ? 'Mudar para Modo Free' : 'Voltar para Modo Pro'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab: Estilos de Prompt */}
                        {activeTab === 'styles' && (
                            <div className="space-y-4">
                                {/* Header com botões */}
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm text-white/50">
                                        Estilos são adicionados como sufixo ao seu prompt
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleResetStyles}
                                            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white/50"
                                        >
                                            Resetar
                                        </button>
                                        <button
                                            onClick={() => setIsCreating(true)}
                                            className="px-3 py-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={14} />
                                            Novo Estilo
                                        </button>
                                    </div>
                                </div>

                                {/* Formulário de criação */}
                                {isCreating && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-3"
                                    >
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                placeholder="Nome do estilo"
                                                value={newStyle.name}
                                                onChange={(e) => setNewStyle({ ...newStyle, name: e.target.value })}
                                                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                                            />
                                        </div>
                                        <textarea
                                            placeholder="Sufixo do prompt (ex: urban streetwear style, bold graphic design)"
                                            value={newStyle.suffix}
                                            onChange={(e) => setNewStyle({ ...newStyle, suffix: e.target.value })}
                                            rows={2}
                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => { setIsCreating(false); setNewStyle({ id: '', name: '', suffix: '' }); }}
                                                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleCreateStyle}
                                                disabled={!newStyle.name.trim()}
                                                className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
                                            >
                                                Criar Estilo
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Lista de estilos */}
                                <div className="space-y-2">
                                    {styles.map((style) => (
                                        <motion.div
                                            key={style.id}
                                            layout
                                            className="p-4 bg-white/5 border border-white/10 rounded-xl"
                                        >
                                            {editingStyle?.id === style.id ? (
                                                // Modo de edição
                                                <div className="space-y-3">
                                                    <input
                                                        type="text"
                                                        value={editingStyle.name}
                                                        onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                                                    />
                                                    <textarea
                                                        value={editingStyle.suffix.replace(/^, /, '')}
                                                        onChange={(e) => setEditingStyle({
                                                            ...editingStyle,
                                                            suffix: e.target.value ? `, ${e.target.value}` : ''
                                                        })}
                                                        rows={2}
                                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingStyle(null)}
                                                            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="px-3 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 rounded-lg transition-colors flex items-center gap-1"
                                                        >
                                                            <Save size={12} />
                                                            Salvar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Modo de visualização
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{style.name}</span>
                                                            {style.isDefault && (
                                                                <span className="px-2 py-0.5 text-[10px] bg-white/10 rounded-full text-white/40">
                                                                    Padrão
                                                                </span>
                                                            )}
                                                        </div>
                                                        {style.suffix && (
                                                            <p className="text-sm text-white/40 mt-1 truncate">
                                                                {style.suffix.replace(/^, /, '')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setEditingStyle({ ...style })}
                                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        {!style.isDefault && (
                                                            <button
                                                                onClick={() => handleDeleteStyle(style.id)}
                                                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white/40 hover:text-red-400"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// Hook para gerenciar estilos persistentes
export function usePromptStyles() {
    const [styles, setStyles] = useState<PromptStyle[]>(DEFAULT_STYLES);

    // Carregar estilos do localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setStyles(parsed);
                } catch {
                    setStyles(DEFAULT_STYLES);
                }
            }
        }
    }, []);

    // Salvar estilos no localStorage
    const updateStyles = (newStyles: PromptStyle[]) => {
        setStyles(newStyles);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newStyles));
        }
    };

    return { styles, updateStyles };
}

export { DEFAULT_STYLES };
export type { PromptStyle };
