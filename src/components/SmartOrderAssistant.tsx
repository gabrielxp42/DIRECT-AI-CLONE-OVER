"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Camera, 
  FileText, 
  Sparkles, 
  Plus, 
  X, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { useToast } from '@/hooks/use-toast';
import { calculatePriceByMeters } from '@/utils/pricing'; // Importar o novo utilitário

interface SmartOrderItem {
  id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao?: string;
  suggestedPrice?: number;
  priceExplanation?: string;
}

interface SmartOrderAssistantProps {
  onItemsGenerated: (items: any[]) => void;
  clienteId?: string;
  clientes: any[];
  produtos: any[];
}

export const SmartOrderAssistant: React.FC<SmartOrderAssistantProps> = ({ 
  onItemsGenerated, 
  clienteId, 
  clientes,
  produtos
}) => {
  const { supabase } = useSession();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedItems, setParsedItems] = useState<SmartOrderItem[]>([]);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showAssistant, setShowAssistant] = useState(false);

  // Get client's custom meter value if available
  const getClientMeterValue = (clientId?: string) => {
    if (!clientId) return null;
    const client = clientes.find(c => c.id === clientId);
    return client?.valor_metro || null;
  };

  // Parse text to extract items
  const parseTextToItems = (inputText: string) => {
    const lines = inputText.split('\n').filter(line => line.trim() !== '');
    const items: SmartOrderItem[] = [];
    const customMeterValue = getClientMeterValue(clienteId);
    
    for (const line of lines) {
      // Match patterns like "1m- numero fla 25" or "2M - numero vasco"
      // Regex aprimorada para capturar a quantidade (com ou sem decimal) e a descrição
      const regex = /^(\d+(?:[.,]\d+)?)\s*m\s*[-–]?\s*(.+)$/i;
      const match = line.match(regex);
      
      if (match) {
        // Substituir vírgula por ponto para parseFloat
        const meters = parseFloat(match[1].replace(',', '.'));
        const description = match[2].trim();
        
        if (meters > 0) {
          // Usar o utilitário de precificação
          const priceInfo = calculatePriceByMeters(meters, customMeterValue);
          
          items.push({
            id: Math.random().toString(36).substr(2, 9),
            produto_nome: description,
            quantidade: meters,
            preco_unitario: priceInfo.unitPrice,
            suggestedPrice: priceInfo.totalPrice,
            priceExplanation: priceInfo.explanation
          });
        }
      }
    }
    
    return items;
  };

  const handleTextParse = () => {
    if (!text.trim()) {
      toast({
        title: "Texto vazio",
        description: "Por favor, insira algum texto para processar.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const items = parseTextToItems(text);
      setParsedItems(items);
      
      if (items.length === 0) {
        toast({
          title: "Nenhum item encontrado",
          description: "Não conseguimos identificar itens no formato esperado (Ex: '1.5m - nome do arquivo').",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Itens identificados",
          description: `Encontramos ${items.length} item(s) no texto.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao processar",
        description: "Ocorreu um erro ao analisar o texto.",
        variant: "destructive"
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setOcrProgress(0);
    
    try {
      // Carregamento dinâmico do Tesseract
      const { createWorker } = await import('tesseract.js');
      
      const worker = await createWorker({
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });
      
      await worker.load();
      await worker.loadLanguage('por');
      await worker.initialize('por');
      
      const { data: { text: ocrText } } = await worker.recognize(file);
      await worker.terminate();
      
      setText(ocrText);
      setIsProcessing(false);
      setOcrProgress(0);
      
      toast({
        title: "Imagem processada",
        description: "Texto extraído da imagem. Revise e clique em 'Processar Texto'.",
      });
    } catch (error) {
      setIsProcessing(false);
      setOcrProgress(0);
      toast({
        title: "Erro no processamento",
        description: "Não foi possível extrair texto da imagem. Verifique se a imagem está clara.",
        variant: "destructive"
      });
    }
  };

  const handleAddItems = () => {
    if (parsedItems.length === 0) {
      toast({
        title: "Nenhum item para adicionar",
        description: "Processar texto ou imagem primeiro.",
        variant: "destructive"
      });
      return;
    }
    
    const itemsToAdd = parsedItems.map(item => ({
      produto_id: null,
      produto_nome: item.produto_nome,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      observacao: item.observacao || ''
    }));
    
    onItemsGenerated(itemsToAdd);
    setParsedItems([]);
    setText('');
    setShowAssistant(false);
    
    toast({
      title: "Itens adicionados",
      description: `${itemsToAdd.length} item(s) foram adicionados ao pedido.`,
    });
  };

  const updateItem = (id: string, field: keyof SmartOrderItem, value: any) => {
    setParsedItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  if (!showAssistant) {
    return (
      <div className="flex justify-center">
        <Button 
          onClick={() => setShowAssistant(true)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Assistente Inteligente
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente Inteligente de Pedidos
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAssistant(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Processar Imagem</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isProcessing}
                className="hidden"
                id="image-upload"
              />
              <Label htmlFor="image-upload" className="w-full">
                <Button 
                  asChild
                  variant="outline" 
                  className="w-full"
                  disabled={isProcessing}
                >
                  <div className="flex items-center gap-2 cursor-pointer">
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {isProcessing ? `Processando... ${ocrProgress}%` : "Upload de Imagem"}
                  </div>
                </Button>
              </Label>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Colar Lista de Texto</Label>
            <Button 
              onClick={handleTextParse}
              variant="outline" 
              className="w-full"
              disabled={!text.trim() || isProcessing}
            >
              <FileText className="h-4 w-4 mr-2" />
              Processar Texto
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Texto Identificado</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o texto da lista de arquivos ou texto extraído da imagem (Ex: 1.5m - nome do arquivo)..."
            rows={4}
            disabled={isProcessing}
          />
        </div>
        
        {parsedItems.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">Itens Identificados ({parsedItems.length})</h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parsedItems.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={item.produto_nome}
                        onChange={(e) => updateItem(item.id, 'produto_nome', e.target.value)}
                        placeholder="Descrição do produto"
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Quantidade (metros)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade}
                            onChange={(e) => updateItem(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        
                        <div>
                          <Label className="text-xs">Preço Unitário</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.preco_unitario}
                            onChange={(e) => updateItem(item.id, 'preco_unitario', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      
                      {item.priceExplanation && (
                        <Badge variant="secondary" className="text-xs">
                          {item.priceExplanation}
                        </Badge>
                      )}
                      
                      <div>
                        <Label className="text-xs">Observação (opcional)</Label>
                        <Input
                          value={item.observacao || ''}
                          onChange={(e) => updateItem(item.id, 'observacao', e.target.value)}
                          placeholder="Detalhes específicos deste item..."
                        />
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setParsedItems([])}
              >
                Limpar
              </Button>
              <Button onClick={handleAddItems}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ao Pedido
              </Button>
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          <h4 className="font-medium mb-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Como usar:
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Envie uma foto da pasta do cliente ou cole a lista de arquivos</li>
            <li>O sistema identificará itens no formato "1m- descrição" ou "2M - descrição"</li>
            <li>Revise os itens identificados antes de adicionar ao pedido</li>
            <li>Valores são sugeridos automaticamente com base na tabela de preços</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};