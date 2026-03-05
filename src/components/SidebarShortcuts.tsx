import * as React from 'react';
import {
    Plus,
    Settings2,
    Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ShortcutSelectionModal } from "./ShortcutSelectionModal";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useAuth } from "@/hooks/useAuth";
import { VetorizadorModal } from "./VetorizadorModal";

interface SidebarShortcutsProps {
    isExpanded: boolean;
    onOpenCalculator: () => void;
    onOpenVetorizador: () => void;
}

export const SidebarShortcuts = ({ isExpanded, onOpenCalculator, onOpenVetorizador }: SidebarShortcutsProps) => {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const { profile } = useAuth();
    const { activeShortcuts, handleShortcutAction, definitions } = useShortcuts(onOpenCalculator);

    const isGifted = (profile as any)?.is_vetoriza_ai_gifted === true;

    return (
        <div className="mt-8 mb-4">
            <div className={cn(
                "px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/30 transition-opacity duration-300 flex items-center justify-between",
                isExpanded ? "opacity-100" : "opacity-0"
            )}>
                {isExpanded ? "Ferramentas" : ""}
                {isExpanded && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="hover:text-primary transition-colors p-1 rounded-md hover:bg-primary/10"
                        title="Personalizar atalhos"
                    >
                        <Settings2 className="h-3 w-3" />
                    </button>
                )}
            </div>

            <div className="px-0 mb-3 flex justify-center">
                <button
                    onClick={() => isGifted ? onOpenVetorizador() : null}
                    disabled={!isGifted}
                    className={cn(
                        "flex items-center transition-all duration-500 group relative overflow-hidden",
                        isExpanded
                            ? "w-[calc(100%-1.5rem)] gap-3 rounded-xl p-3 mx-3"
                            : "justify-center rounded-[12px] h-10 w-10",
                        isGifted
                            ? "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.05] active:scale-95 cursor-pointer ring-1 ring-white/20"
                            : "bg-primary/40 text-primary-foreground/50 shadow-none cursor-not-allowed grayscale-[0.5]"
                    )}
                    title={!isExpanded ? (isGifted ? "Vetoriza AI" : "Vetoriza AI (Em breve)") : undefined}
                >
                    {/* Liquid Background Effect */}
                    <div className={cn(
                        "absolute inset-0 bg-gradient-to-r from-white/20 to-transparent transition-opacity duration-500",
                        isGifted ? "opacity-100 animate-pulse" : "opacity-0"
                    )} />

                    <div className={cn(
                        "rounded-lg transition-transform duration-500 flex items-center justify-center flex-shrink-0",
                        isExpanded ? "bg-white/10 p-2" : "bg-transparent p-0"
                    )}>
                        <Sparkles className={cn("fill-current", isExpanded ? "h-4 w-4" : "h-5 w-5")} />
                    </div>

                    {isExpanded && (
                        <div className="flex flex-col items-start transition-all duration-300 opacity-100 translate-x-0 overflow-hidden text-left">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider leading-tight">Vetoriza AI</span>
                                {!isGifted && (
                                    <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded-md font-bold text-white/60">EM BREVE</span>
                                )}
                            </div>
                            <span className={cn(
                                "text-[7.5px] font-medium leading-tight whitespace-nowrap",
                                isGifted ? "text-black/60" : "opacity-40"
                            )}>
                                MELHORAR QUALIDADE E EFEITOS NA IMAGEM
                            </span>
                        </div>
                    )}
                </button>
            </div>

            <div className="grid gap-1">
                {activeShortcuts.map((id) => {
                    const config = definitions[id];
                    if (!config) return null;

                    const Icon = config.icon;

                    return (
                        <button
                            key={id}
                            onClick={() => handleShortcutAction(id)}
                            className={cn(
                                "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group w-full text-left",
                                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-[1.02]"
                            )}
                        >
                            <div className="relative">
                                <Icon className="h-5 w-5 flex-shrink-0" />
                                {config.pulse && (
                                    <div className="absolute -top-1 -right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </div>
                                )}
                            </div>

                            <span className={cn(
                                "whitespace-nowrap transition-opacity duration-300 delay-100",
                                isExpanded ? "opacity-100" : "opacity-0"
                            )}>
                                {config.label}
                            </span>
                        </button>
                    );
                })}

                {/* Placeholder to add more when expanded */}
                {isExpanded && activeShortcuts.length < 6 && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className={cn(
                            "flex items-center gap-4 rounded-lg px-3 py-2 transition-all duration-300 ease-in-out relative group w-full text-left",
                            "text-sidebar-foreground/40 hover:text-primary hover:bg-primary/5 border border-dashed border-sidebar-border/50 mt-1"
                        )}
                    >
                        <Plus className="h-5 w-5 flex-shrink-0" />
                        <span className="text-xs font-medium">Personalizar</span>
                    </button>
                )}
            </div>

            <ShortcutSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div >
    );
};
