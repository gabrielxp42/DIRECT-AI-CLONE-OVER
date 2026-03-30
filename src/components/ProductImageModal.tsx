import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PedidoItem } from '@/types/pedido';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ImageIcon, UploadCloud, X, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ProductImageModalProps {
  item: PedidoItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductImageModal({ item, isOpen, onOpenChange }: ProductImageModalProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  if (!item) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imagem_principal_url' | 'imagem_secundaria_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${item.id}-${field}-${Math.random()}.${fileExt}`;
      const filePath = `pedidos-loja/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pedidos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('pedidos')
        .getPublicUrl(filePath);

      const url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('pedido_items')
        .update({ [field]: url })
        .eq('id', item.id);

      if (updateError) throw updateError;
      
      showSuccess('Imagem atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) {
      showError('Erro ao fazer upload da imagem: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = async (field: 'imagem_principal_url' | 'imagem_secundaria_url') => {
    try {
      setIsUploading(true);
      const { error: updateError } = await supabase
        .from('pedido_items')
        .update({ [field]: null })
        .eq('id', item.id);

      if (updateError) throw updateError;
      
      showSuccess('Imagem removida com sucesso!');
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (err: any) {
      showError('Erro ao remover imagem: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-[#12141A] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Imagens do Produto - {item.produto_nome}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 py-4">
          
          {/* Imagem 1 */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-white/40">IMAGEM 1 (PRINCIPAL)</span>
            {item.imagem_principal_url ? (
              <div className="relative group w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/50">
                <img src={item.imagem_principal_url} alt="Imagem 1" className="w-full h-full object-contain" />
                <button 
                  onClick={() => removeImage('imagem_principal_url')}
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="w-full aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors flex flex-col items-center justify-center cursor-pointer bg-black/20 text-white/40">
                {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <UploadCloud className="w-8 h-8 mb-2" />}
                <span className="text-xs">Fazer Upload</span>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'imagem_principal_url')} disabled={isUploading} />
              </label>
            )}
          </div>

          {/* Imagem 2 */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-white/40">IMAGEM 2 (SECUNDÁRIA)</span>
            {item.imagem_secundaria_url ? (
               <div className="relative group w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/50">
               <img src={item.imagem_secundaria_url} alt="Imagem 2" className="w-full h-full object-contain" />
               <button 
                 onClick={() => removeImage('imagem_secundaria_url')}
                 className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                 disabled={isUploading}
               >
                 <X className="w-4 h-4" />
               </button>
             </div>
            ) : (
              <label className="w-full aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors flex flex-col items-center justify-center cursor-pointer bg-black/20 text-white/40">
                {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <UploadCloud className="w-8 h-8 mb-2" />}
                <span className="text-xs">Fazer Upload</span>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'imagem_secundaria_url')} disabled={isUploading} />
              </label>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
