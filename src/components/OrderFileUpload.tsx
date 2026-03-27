import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, File as FileIcon, X, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseQuantidadeFromNome, estimarDimensoesPorTamanho, lerDimensoesTIF, criarNomeComQuantidade } from '@/utils/file-utils';
import { uploadFileToWasabi } from '@/integrations/wasabi/upload';
import { toast } from 'sonner';

export interface UploadedFile {
    id: string;
    file: File;
    name: string;
    originalName: string;
    size: number;
    widthCm: number;
    heightCm: number;
    copies: number;
    previewUrl?: string;
    wasabiUrl?: string; // Armazena a URL retornada após o upload para o Wasabi
    isUploading?: boolean; // Estado de upload do arquivo
    uploadError?: string; // Erro caso ocorra falha
}

interface OrderFileUploadProps {
    files: UploadedFile[];
    onChange: (files: UploadedFile[]) => void;
}

export function OrderFileUpload({ files, onChange }: OrderFileUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const processFiles = async (newFiles: File[]) => {
        const processed: UploadedFile[] = [];
        for (const file of newFiles) {
            let widthCm = 57;
            let heightCm = 84;
            let previewUrl = undefined;
            
            const { quantidade, nomeLimpo } = parseQuantidadeFromNome(file.name);
            const nomeExibicao = criarNomeComQuantidade(nomeLimpo, quantidade);

            if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff')) {
                if (file.type !== 'image/tiff' && !file.name.toLowerCase().endsWith('.tif') && !file.name.toLowerCase().endsWith('.tiff')) {
                    previewUrl = URL.createObjectURL(file);
                    try {
                        const img = new Image();
                        img.src = previewUrl;
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                        });
                        widthCm = Number(((img.width * 2.54) / 300).toFixed(2));
                        heightCm = Number(((img.height * 2.54) / 300).toFixed(2));
                    } catch (e) {
                        console.error("Erro ao ler dimensões", e);
                        const estimated = estimarDimensoesPorTamanho(file.size);
                        widthCm = estimated.larguraCm;
                        heightCm = estimated.alturaCm;
                    }
                } else {
                    try {
                        const dimensoes = await lerDimensoesTIF(file);
                        widthCm = dimensoes.larguraCm;
                        heightCm = dimensoes.alturaCm;
                    } catch (e) {
                        const estimated = estimarDimensoesPorTamanho(file.size);
                        widthCm = estimated.larguraCm;
                        heightCm = estimated.alturaCm;
                    }
                }
            } else if (file.type === 'application/pdf') {
                const estimated = estimarDimensoesPorTamanho(file.size);
                widthCm = estimated.larguraCm;
                heightCm = estimated.alturaCm;
            } else {
                const estimated = estimarDimensoesPorTamanho(file.size);
                widthCm = estimated.larguraCm;
                heightCm = estimated.alturaCm;
            }

            const fileId = Math.random().toString(36).substr(2, 9);
            const newUploadedFile: UploadedFile = {
                id: fileId,
                file,
                name: nomeExibicao,
                originalName: nomeLimpo,
                size: file.size,
                widthCm,
                heightCm,
                copies: quantidade,
                previewUrl,
                isUploading: true
            };
            processed.push(newUploadedFile);
            
            // Inicia o upload para o Wasabi em background
            uploadFileToWasabi(file, 'print-files')
                .then(({ url }) => {
                    onChange(prevFiles => prevFiles.map(f => 
                        f.id === fileId ? { ...f, wasabiUrl: url, isUploading: false } : f
                    ));
                    toast.success(`Arquivo ${file.name} enviado com sucesso!`);
                })
                .catch(error => {
                    console.error("Erro no upload do wasabi:", error);
                    onChange(prevFiles => prevFiles.map(f => 
                        f.id === fileId ? { ...f, isUploading: false, uploadError: 'Falha no upload' } : f
                    ));
                    toast.error(`Falha ao enviar o arquivo ${file.name}`);
                });
        }
        // Adiciona os arquivos à lista imediatamente (mostrando o estado de "carregando")
        onChange([...files, ...processed]);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    }, [files, onChange]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(Array.from(e.target.files));
        }
    };

    const removeFile = (id: string) => {
        const fileToRemove = files.find(f => f.id === id);
        if (fileToRemove?.previewUrl) {
            URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        onChange(files.filter(f => f.id !== id));
    };

    const updateFile = (id: string, updates: Partial<UploadedFile>) => {
        onChange(files.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4">
            <div 
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
                <h4 className="text-sm font-bold mb-1">UPLOAD SEGURO</h4>
                <p className="text-xs text-muted-foreground text-center mb-4 max-w-xs">
                    Arraste seus arquivos até 50MB ou clique para selecionar. (PDF, JPG, PNG, TIF)
                </p>
                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept="image/*,application/pdf,.tif,.tiff"
                />
            </div>

            {files.length > 0 && (
                <div className="space-y-3">
                    {files.map(f => (
                        <div key={f.id} className="border-2 border-zinc-800 rounded-lg p-3 sm:p-4 bg-background relative overflow-hidden">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                onClick={() => removeFile(f.id)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                            
                            <div className="flex items-start gap-3 mb-4 pr-6">
                                <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                                    {f.previewUrl ? (
                                        <img src={f.previewUrl} alt={f.name} className={`w-full h-full object-cover ${f.isUploading ? 'opacity-50' : ''}`} />
                                    ) : (
                                        <FileIcon className="w-5 h-5 text-muted-foreground" />
                                    )}
                                    {f.isUploading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold truncate pr-2">{f.name}</p>
                                        {f.uploadError && (
                                            <span className="text-[9px] text-destructive font-bold px-1.5 py-0.5 bg-destructive/10 rounded-sm">ERRO UPLOAD</span>
                                        )}
                                        {!f.isUploading && f.wasabiUrl && (
                                            <span className="text-[9px] text-primary font-bold px-1.5 py-0.5 bg-primary/10 rounded-sm">NA NUVEM</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
                                    <div className="mt-1">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-500">
                                            {f.copies} CÓPIAS
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Altura (cm)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        value={f.heightCm || ''} 
                                        onChange={e => updateFile(f.id, { heightCm: Number(e.target.value) })}
                                        className="h-8 text-xs font-semibold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Largura (cm)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        value={f.widthCm || ''} 
                                        onChange={e => updateFile(f.id, { widthCm: Number(e.target.value) })}
                                        className="h-8 text-xs font-semibold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cópias</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        step="1" 
                                        value={f.copies} 
                                        onChange={e => {
                                            const newCopies = Number(e.target.value);
                                            const newName = criarNomeComQuantidade(f.originalName, newCopies);
                                            updateFile(f.id, { copies: newCopies, name: newName });
                                        }}
                                        className="h-8 text-xs font-semibold"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
