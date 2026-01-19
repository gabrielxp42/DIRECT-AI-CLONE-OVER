import * as React from 'react';
import {
    Plus,
    Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ShortcutSelectionModal } from "./ShortcutSelectionModal";
import { useShortcuts } from "@/hooks/useShortcuts";

interface SidebarShortcutsProps {
    isExpanded: boolean;
    onOpenCalculator: () => void;
}

export const SidebarShortcuts = ({ isExpanded, onOpenCalculator }: SidebarShortcutsProps) => {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const { activeShortcuts, handleShortcutAction, definitions } = useShortcuts(onOpenCalculator);

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
        </div>
    );
};
