import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { 
  Eye, 
  Printer, 
  MessageSquare, 
  MessageCircle,
  ArrowRight, 
  CheckCircle, 
  Archive,
  ExternalLink,
  User,
  Package,
  ScrollText,
  Send
} from "lucide-react";
import { ProductionStatus } from "@/types/pedido";

import { cn } from "@/lib/utils";

interface CardContextMenuProps {
  children: React.ReactNode;
  onViewDetails: () => void;
  onMoveTo: (status: ProductionStatus) => void;
  onPrintA4: () => void;
  onPrintThermal: () => void;
  onWhatsApp: () => void;
  onChat?: () => void;
  onArchive: () => void;
  currentStatus: ProductionStatus;
}

const COLUMNS: { id: ProductionStatus; title: string; icon: any }[] = [
  { id: 'design', title: 'Design', icon: Eye },
  { id: 'queued', title: 'Fila', icon: Package },
  { id: 'printing', title: 'Impressão', icon: Printer },
  { id: 'finishing', title: 'Acabamento', icon: CheckCircle },
  { id: 'ready', title: 'Pronto', icon: ExternalLink },
];

export const CardContextMenu: React.FC<CardContextMenuProps> = ({
  children,
  onViewDetails,
  onMoveTo,
  onPrintA4,
  onPrintThermal,
  onWhatsApp,
  onChat,
  onArchive,
  currentStatus
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64 bg-background/80 backdrop-blur-xl border-white/20 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <ContextMenuLabel className="flex items-center gap-2 text-[10px] uppercase font-black italic tracking-widest text-primary/70">
          Ações Rápidas
        </ContextMenuLabel>
        
        <ContextMenuItem onClick={onViewDetails} className="gap-2 focus:bg-primary/10 transition-colors">
          <Eye className="h-4 w-4 text-blue-500" />
          <span>Ver Detalhes</span>
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="bg-white/10" />

        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <ArrowRight className="h-4 w-4 text-amber-500" />
            <span>Mover para...</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 bg-background/90 backdrop-blur-xl border-white/20">
            {COLUMNS.map((col) => (
              <ContextMenuItem 
                key={col.id} 
                className={cn(
                  "gap-2",
                  currentStatus === col.id && "bg-primary/5 text-primary font-bold"
                )}
                disabled={currentStatus === col.id}
                onClick={() => onMoveTo(col.id)}
              >
                <col.icon className="h-4 w-4" />
                {col.title}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator className="bg-white/10" />

        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Printer className="h-4 w-4 text-purple-500" />
            <span>Imprimir</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56 bg-background/90 backdrop-blur-xl border-white/20">
            <ContextMenuItem onClick={onPrintA4} className="gap-2">
              <Printer className="h-4 w-4" />
              Documento A4 (Nota)
            </ContextMenuItem>
            <ContextMenuItem onClick={onPrintThermal} className="gap-2">
              <ScrollText className="h-4 w-4" />
              Etiqueta/Cupom (80mm)
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onClick={onChat || onWhatsApp} className="gap-2 text-green-600 focus:text-green-600 focus:bg-green-500/10 transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span>Conversar com Cliente</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={onWhatsApp} className="gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10 transition-colors">
          <Send className="h-4 w-4" />
          <span>Enviar Pedido (WhatsApp)</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="bg-white/10" />

        <ContextMenuItem onClick={onArchive} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 transition-colors">
          <Archive className="h-4 w-4" />
          <span>Arquivar Pedido</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
