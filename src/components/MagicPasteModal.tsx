import React, { useState, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, FileText, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getOpenAIClient } from '@/integrations/openai/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useSession } from '@/contexts/SessionProvider';

interface MagicPasteModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onImportItems: (items: any[]) => void;
}

export const MagicPasteModal: React.FC<MagicPasteModalProps> = ({
    isOpen,
    onOpenChange,
    onImportItems,
}) => {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
    const { canUseAI } = useSubscription();
    const { supabase } = useSession();

    // ---------- Image handling ----------
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('A imagem deve ter no máximo 5 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setSelectedImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    const processImage = async () => {
        if (!selectedImage) return;
        if (!canUseAI) {
            toast.error('Limite diário de IA atingido. Faça upgrade para continuar!');
            return;
        }
        setIsProcessing(true);
        try {
            const client = getOpenAIClient();
            const response = await client.sendMessage([
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: "Analise a imagem do pedido. Extraia os itens linha por linha.\n\nRegras de Formatação:\n1. Converta quantidades por extenso para números (ex: 'MEIO METRO' -> '0.5M', 'UM METRO' -> '1M').\n2. Formato de saída: 'QUANTIDADE - PRODUTO | OBSERVAÇÕES'.\n3. Use ' | ' (barra vertical) para separar o Produto das Observações.\n4. Se a linha começar com um número que parece ser quantidade, use-o.\n5. Se houver 'MEIO METRO', a quantidade é 0.5M.\n6. Exemplo: '0.5M - NUMERO FLA 25 - BRANCO | 0 - ANA FLAVIA'.\n\nResponda APENAS com a lista formatada.",
                        },
                        { type: 'image_url', image_url: { url: selectedImage } },
                    ],
                },
            ]);

            if (response.content) {
                setText(response.content);
                setActiveTab('text');
                toast.success('Imagem lida! Revise o texto e clique em Mágica.');
                setSelectedImage(null);

                // Increment AI usage in DB
                await supabase?.rpc('increment_ai_usage');
            } else {
                toast.error('Nenhum texto retornado pela IA.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao processar a imagem. Verifique a chave da API.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ---------- Text parsing ----------
    const processText = () => {
        if (!text.trim()) {
            toast.error('Cole algum texto primeiro!');
            return;
        }
        if (!canUseAI) {
            toast.error('Limite diário de IA atingido. Faça upgrade para continuar!');
            return;
        }
        setIsProcessing(true);
        try {
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            const parsedItems: any[] = [];

            lines.forEach(line => {
                let cleanLine = line.trim();
                let produtoNome = '';
                let observacao = '';
                let quantidade = 1;

                // 1. Tentar extrair quantidade do INÍCIO da linha
                // Suporta: "1M", "1.5M", "0.5M", "34CM", "2x", "1 - "
                const startQtyMatch = cleanLine.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|CM|X|UN|PC|MT|METROS|mts)?\s*[-–]?\s*/i);

                if (startQtyMatch) {
                    const rawQty = startQtyMatch[1].replace(',', '.');
                    const parsed = parseFloat(rawQty);

                    if (!isNaN(parsed) && parsed > 0) {
                        quantidade = parsed;
                        // Remove a quantidade da linha para não duplicar no nome
                        cleanLine = cleanLine.substring(startQtyMatch[0].length).trim();
                        // Remove hífen inicial se sobrou
                        cleanLine = cleanLine.replace(/^[-–]\s*/, '');
                    }
                }

                // 2. Separar por "|" para definir Nome vs Observação (Novo padrão LLM)
                if (cleanLine.includes('|')) {
                    const parts = cleanLine.split('|');
                    produtoNome = parts[0].trim();
                    observacao = parts.slice(1).join('|').trim();
                } else {
                    // Fallback para o padrão antigo com hífens
                    const parts = cleanLine.split(/\s+[-–]\s+/);

                    if (parts.length >= 3) {
                        // Ex: "NIKE - BRANCO - 25CM" -> Nome: "NIKE - BRANCO", Obs: "25CM"
                        produtoNome = parts.slice(0, parts.length - 1).join(' - ');
                        observacao = parts[parts.length - 1];
                    } else if (parts.length === 2) {
                        // Ex: "NIKE - BRANCO" -> Nome: "NIKE", Obs: "BRANCO"
                        produtoNome = parts[0];
                        observacao = parts[1];
                    } else {
                        produtoNome = cleanLine;
                    }
                }

                parsedItems.push({
                    tempId: Math.random().toString(36).substr(2, 9),
                    produto_id: '',
                    quantidade,
                    preco_unitario: 0,
                    observacao,
                    customName: produtoNome,
                });
            });

            if (parsedItems.length > 0) {
                onImportItems(parsedItems);
                toast.success(`${parsedItems.length} itens importados!`);
                onOpenChange(false);
                setText('');
            } else {
                toast.warning('Não consegui identificar itens no texto.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao processar o texto.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ---------- UI ----------
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        Importação Mágica
                    </DialogTitle>
                    <DialogDescription>
                        Cole a lista do WhatsApp ou envie uma foto do pedido.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'image')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="text">
                            <FileText className="h-4 w-4 mr-2" /> Texto
                        </TabsTrigger>
                        <TabsTrigger value="image">
                            <ImageIcon className="h-4 w-4 mr-2" /> Imagem (Beta)
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="text" className="space-y-4 mt-4">
                        <Textarea
                            placeholder={`Exemplo:\n1M - NUMERO FLA 25 - DOURADO\n1M - NUMERO FLA 25 - PRETO 03`}
                            className="min-h-[200px] font-mono text-sm"
                            value={text}
                            onChange={e => setText(e.target.value)}
                        />
                    </TabsContent>

                    <TabsContent value="image" className="mt-4">
                        {!selectedImage ? (
                            <div
                                className="flex flex-col items-center justify-center h-[200px] border-2 border-dashed rounded-lg bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">Clique para enviar foto</p>
                                <p className="text-xs text-muted-foreground mt-1">JPG ou PNG até 5 MB</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                            </div>
                        ) : (
                            <div className="relative rounded-lg overflow-hidden border h-[200px] bg-black/5">
                                <img src={selectedImage} alt="Preview" className="w-full h-full object-contain" />
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-8 w-8"
                                    onClick={() => setSelectedImage(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    {activeTab === 'image' ? (
                        <Button
                            onClick={processImage}
                            disabled={isProcessing || !selectedImage}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Lendo Imagem...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Ler Pedido
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={processText}
                            disabled={isProcessing || !text.trim()}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-none"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Mágica!
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
