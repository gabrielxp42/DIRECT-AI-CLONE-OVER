import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface GabiActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    onConfirm: () => void;
    isLoading?: boolean;
}

export const GabiActionDialog = ({
    isOpen,
    onOpenChange,
    title,
    description,
    onConfirm,
    isLoading = false
}: GabiActionDialogProps) => {
    const isMobile = useIsMobile();

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "p-0 bg-zinc-950 text-white border-zinc-900 shadow-2xl flex flex-col overflow-hidden",
                isMobile
                    ? "w-full rounded-t-[2rem] rounded-b-none h-fit fixed bottom-0 left-0 right-0 top-auto translate-y-0 max-w-full"
                    : "max-w-md rounded-2xl"
            )}>
                {isMobile && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-800 rounded-full" />
                )}
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold">{title}</h3>
                        <p className="text-zinc-400">{description}</p>
                    </div>
                    <div className="flex gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 text-zinc-500 hover:text-white"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 bg-primary text-primary-foreground font-bold"
                        >
                            {isLoading ? "Processando..." : "Confirmar"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
