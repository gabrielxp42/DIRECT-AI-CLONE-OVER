

import { motion } from 'framer-motion';
import { getHalftonePresets } from '@dtf/services/halftoneService';

interface StyleSelectorProps {
    selected: string;
    onSelect: (key: string) => void;
}

export default function StyleSelector({ selected, onSelect }: StyleSelectorProps) {
    const presets = getHalftonePresets();
    const presetKeys = Object.keys(presets);

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-white/60 mb-3">
                Estilo de Halftone
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {presetKeys.map((key) => {
                    const preset = presets[key];
                    const isSelected = selected === key;

                    return (
                        <motion.button
                            key={key}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onSelect(key)}
                            className={`
                relative p-3 rounded-xl border transition-all text-left
                ${isSelected
                                    ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                                }
              `}
                        >
                            {/* Preview visual do estilo */}
                            <div className="h-8 mb-2 rounded-lg overflow-hidden bg-black/50 flex items-center justify-center">
                                <div
                                    className="w-full h-full"
                                    style={{
                                        background: `repeating-conic-gradient(
                      from ${preset.settings.angle || 45}deg,
                      ${isSelected ? '#06b6d4' : '#ffffff'} 0deg,
                      transparent ${preset.settings.dotMaxPercent || 100}%
                    )`,
                                        opacity: 0.3,
                                    }}
                                />
                            </div>

                            <span className={`text-xs font-medium ${isSelected ? 'text-cyan-300' : 'text-white/70'
                                }`}>
                                {preset.name}
                            </span>

                            {isSelected && (
                                <motion.div
                                    layoutId="selected-style"
                                    className="absolute inset-0 rounded-xl border-2 border-cyan-400 pointer-events-none"
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
