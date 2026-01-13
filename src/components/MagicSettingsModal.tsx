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
import { CompanyProfileUpdate } from '@/hooks/useCompanyProfile';
import { getValidToken } from '@/utils/tokenGuard';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

interface MagicSettingsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onImportSettings: (settings: CompanyProfileUpdate) => void;
}

export const MagicSettingsModal: React.FC<MagicSettingsModalProps> = ({
    isOpen,
    onOpenChange,
    onImportSettings,
}) => {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
    const { canUseAI } = useSubscription();
    const { supabase } = useSession();

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('A imagem deve ter no máximo 5 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setSelectedImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    const processContent = async (isImage: boolean) => {
        if (isImage && !selectedImage) return;
        if (!isImage && !text.trim()) return;

        if (!canUseAI) {
            toast.error('Limite diário de IA atingido. Faça upgrade para continuar!');
            return;
        }

        setIsProcessing(true);
        try {
            const client = getOpenAIClient();

            const prompt = `Analise o ${isImage ? 'cartão de visita / imagem' : 'texto'} e extraia as informações da empresa.
            
            Retorne APENAS um objeto JSON válido com os seguintes campos (se encontrados):
            {
              "company_name": "Nome da Empresa",
              "company_slogan": "Slogan ou descrição curta",
              "company_phone": "Telefone fixo",
              "company_whatsapp": "Número de WhatsApp",
              "company_email": "E-mail comercial",
              "company_website": "URL do site ou Instagram",
              "company_address_street": "Nome da rua/avenida",
              "company_address_number": "Número do endereço",
              "company_address_neighborhood": "Bairro",
              "company_address_city": "Cidade",
              "company_address_state": "UF (Sigla do estado)",
              "company_address_zip": "CEP",
              "company_pix_key": "Chave PIX (se houver)",
              "company_pix_key_type": "Tipo da chave: 'cpf', 'cnpj', 'email', 'phone' ou 'random'"
            }
            
            Importante: 
            1. Se não encontrar um campo, não inclua no JSON.
            2. Se encontrar CPF/CNPJ como chave PIX, formate corretamente.
            3. No campo 'company_address_state', retorne apenas a sigla com 2 letras (ex: 'RJ', 'SP').`;

            const messages: any[] = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        ...(isImage ? [{ type: 'image_url', image_url: { url: selectedImage } }] : [{ type: 'text', text: `Texto para analisar: ${text}` }])
                    ],
                },
            ];

            const response = await client.sendMessage(messages);

            if (response.content) {
                // Tenta extrair o JSON do conteúdo (caso a IA coloque blocos de código markdown)
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : response.content;

                try {
                    const parsedData = JSON.parse(jsonStr);
                    onImportSettings(parsedData);
                    toast.success('Configurações extraídas com sucesso!');
                    onOpenChange(false);
                    setText('');
                    setSelectedImage(null);

                    // Incrementa uso de IA usando fetch direto para estabilidade
                    getValidToken().then(token => {
                        if (token) {
                            fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_ai_usage`, {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_ANON_KEY,
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                }
                            }).catch(err => console.error('Erro ao incrementar uso de IA:', err));
                        }
                    });
                } catch (parseErr) {
                    console.error('Erro ao processar JSON da IA:', parseErr, jsonStr);
                    toast.error('A IA não retornou um formato válido. Tente novamente.');
                }
            } else {
                toast.error('Nenhum dado retornado pela IA.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Erro ao processar com IA. Verifique sua conexão.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        Importação Mágica de Dados
                    </DialogTitle>
                    <DialogDescription>
                        Envie uma foto do seu cartão de visita ou cole os dados da sua empresa.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'image')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="image">
                            <ImageIcon className="h-4 w-4 mr-2" /> Imagem / Cartão
                        </TabsTrigger>
                        <TabsTrigger value="text">
                            <FileText className="h-4 w-4 mr-2" /> Colar Texto
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="image" className="mt-4">
                        {!selectedImage ? (
                            <div
                                className="flex flex-col items-center justify-center h-[200px] border-2 border-dashed rounded-lg bg-muted/50 hover:bg-muted/80 cursor-pointer transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">Clique para enviar foto ou cartão</p>
                                <p className="text-xs text-muted-foreground mt-1">JPG ou PNG até 5 MB</p>
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

                    <TabsContent value="text" className="space-y-4 mt-4">
                        <Textarea
                            placeholder={`Exemplo:\nMinha Gráfica LTDA\nAv. Brasil, 1000 - Rio de Janeiro - RJ\nWhatsApp: (21) 99999-9999\nPIX (CNPJ): 00.000.000/0001-00`}
                            className="min-h-[200px] font-mono text-sm"
                            value={text}
                            onChange={e => setText(e.target.value)}
                        />
                    </TabsContent>
                </Tabs>

                <DialogFooter className="flex sm:justify-between items-center gap-4">
                    <p className="text-[10px] text-muted-foreground leading-tight max-w-[150px]">
                        A IA irá preencher o máximo de campos possível automaticamente.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => processContent(activeTab === 'image')}
                            disabled={isProcessing || (activeTab === 'image' ? !selectedImage : !text.trim())}
                            className="bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Extraindo...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Fazer Mágica
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
