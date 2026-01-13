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

            const prompt = "Analise a imagem do pedido. Extraia os itens linha por linha.\n\nRetorne APENAS um JSON no seguinte formato (sem markdown):\n[\n  { \"quantidade\": 0.5, \"produto_nome\": \"Nome do Produto\", \"tipo\": \"dtf\", \"observacao\": \"Obs\" }\n]\n\nRegras:\n1. Converta quantidades por extenso para números (ex: 'MEIO METRO' -> 0.5).\n2. O campo 'quantidade' deve ser um número.\n3. 'tipo' deve ser 'dtf' ou 'vinil'.\n4. Se não souber o tipo, use 'dtf'.";

            const result = await client.sendMessage([
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: selectedImage } }
                    ]
                }
            ]);

            const responseText = result.content || "";
            // Tentar encontrar JSON no texto se houver markdown
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            const jsonStr = jsonMatch ? jsonMatch[0] : responseText;

            try {
                const parsedItems = JSON.parse(jsonStr);
                const itemsWithIds = parsedItems.map((item: any) => ({
                    ...item,
                    tempId: Math.random().toString(36).substr(2, 9),
                    produto_id: '',
                    preco_unitario: 0,
                }));

                onImportItems(itemsWithIds);
                toast.success('Imagem lida com sucesso!');
                onOpenChange(false);
                setSelectedImage(null);
            } catch (e) {
                console.error('Erro ao fazer parse do JSON da IA:', responseText);
                setText(responseText);
                setActiveTab('text');
                toast.warning('Ocorreu um erro ao formatar os itens automaticamente. O texto foi colado para revisão manual.');
            }

            // Increment AI usage in DB (non-blocking)
            supabase?.rpc('increment_ai_usage').then(({ error }) => {
                if (error) console.error('Erro ao incrementar uso de IA:', error);
            });
        } catch (err) {
            console.error(err);
            toast.error('Erro ao processar a imagem com OpenAI.');
        } finally {
            setIsProcessing(false);
        }
    };

    // ---------- Text parsing ----------
    const processText = async () => {
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
            const client = getOpenAIClient();
            const prompt = `Analise o seguinte pedido e extraia os itens.
            
            Retorne APENAS um JSON no seguinte formato (sem markdown):
            [
              { "quantidade": 1, "produto_nome": "Nome do Produto", "tipo": "dtf", "observacao": "Obs" }
            ]
            
            Pedido:
            ${text}
            
            Regras:
            1. 'quantidade' deve ser um número (extraia de "1M", "0.5M", "2x", etc).
            2. 'tipo' deve ser 'dtf' ou 'vinil' com base no contexto (se não souber, use 'dtf').
            3. 'produto_nome' deve ser o nome principal do produto.
            4. 'observacao' deve conter detalhes como cores, nomes personalizados, etc.`;

            const result = await client.sendMessage([{ role: 'user', content: prompt }]);
            const responseText = result.content || "";

            // Tentar encontrar JSON no texto se houver markdown
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            const jsonStr = jsonMatch ? jsonMatch[0] : responseText;

            const parsedItems = JSON.parse(jsonStr);
            const itemsWithIds = parsedItems.map((item: any) => ({
                ...item,
                tempId: Math.random().toString(36).substr(2, 9),
                produto_id: null,
                preco_unitario: 0,
            }));

            if (itemsWithIds.length > 0) {
                onImportItems(itemsWithIds);
                toast.success(`${itemsWithIds.length} itens importados com sucesso!`);
                onOpenChange(false);
                setText('');

                // Increment AI usage
                supabase?.rpc('increment_ai_usage').then(({ error }) => {
                    if (error) console.error('Erro ao incrementar uso de IA:', error);
                });
            } else {
                toast.warning('Não consegui identificar itens no texto.');
            }
        } catch (err) {
            console.error('Erro no processamento LLM:', err);
            toast.error('Erro ao processar o texto com OpenAI.');
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
