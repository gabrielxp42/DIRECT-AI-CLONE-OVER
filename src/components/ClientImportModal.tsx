import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, FileType, CheckCircle2, AlertCircle, BrainCircuit, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import { getOpenAIClient } from '@/integrations/openai/client';
import { toast } from 'sonner';
import { useSession } from '@/contexts/SessionProvider';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientes } from '@/hooks/useDataFetch';
import { removeAccents } from '@/utils/string';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';

interface ClientImportModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

interface MappingResult {
    nome: string;
    telefone?: string;
    email?: string;
    endereco?: string;
    valor_metro?: string;
}

export const ClientImportModal: React.FC<ClientImportModalProps> = ({ isOpen, onOpenChange }) => {
    const { session, profile } = useSession();
    const queryClient = useQueryClient();
    const { data: existingClients } = useClientes();
    const [file, setFile] = useState<File | null>(null);
    const [finalData, setFinalData] = useState<string[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<MappingResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Mapping, 3: Success
    const [skippedCount, setSkippedCount] = useState(0);
    const [insertedCount, setInsertedCount] = useState(0);

    const processCSV = (text: string) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        return lines.map(line => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else current += char;
            }
            result.push(current.trim());
            return result;
        });
    };

    const processExcel = (buffer: ArrayBuffer) => {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        return rows.filter(row => row.length > 0);
    };

    const processPDF = async (file: File) => {
        setLoadingMessage("Gabi está usando OCR para ler seu PDF...");
        try {
            // Tesseract can't read PDF directly, it needs image.
            const { data: { text } } = await Tesseract.recognize(file, 'por', {
                logger: m => console.log(m)
            });
            const lines = text.split('\n').filter(l => l.trim().length > 5);
            return lines.map(l => l.split(/\s{2,}|[;|]/).map(c => c.trim()));
        } catch (err) {
            console.error("OCR Error:", err);
            throw new Error("Não foi possível ler o arquivo PDF.");
        }
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const selectedFile = acceptedFiles[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsLoading(true);
        setLoadingMessage("Analisando arquivo...");

        try {
            let rows: string[][] = [];
            const extension = selectedFile.name.split('.').pop()?.toLowerCase();

            if (extension === 'csv') {
                const text = await selectedFile.text();
                rows = processCSV(text);
            } else if (['xlsx', 'xls'].includes(extension || '')) {
                const buffer = await selectedFile.arrayBuffer();
                rows = processExcel(buffer);
            } else if (extension === 'pdf') {
                rows = await processPDF(selectedFile);
            }

            if (rows.length > 0) {
                setHeaders(rows[0]);
                setFinalData(rows.slice(1));
                await handleAutoMap(rows[0], rows.slice(1, 4)); // Pass first 3 rows as example
            } else {
                toast.error("O arquivo parece estar vazio ou em formato inválido.");
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar o arquivo.");
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/pdf': ['.pdf']
        },
        multiple: false
    });

    const handleAutoMap = async (csvHeaders: string[], exampleRows: string[][]) => {
        setIsLoading(true);
        setLoadingMessage("Gabi está mapeando suas colunas...");
        try {
            const gabi = getOpenAIClient();
            const systemFields = ["nome", "telefone", "email", "endereco", "valor_metro"];

            const prompt = `
        Aja como Gabi, uma IA assistente técnica especializada em Gráficas DTF.
        Você recebeu cabeçalhos de uma planilha de clientes e precisa mapeá-los para os campos do nosso sistema.
        
        Campos do Sistema: ${systemFields.join(", ")}
        Cabeçalhos do Usuário: ${csvHeaders.join(", ")}
        Exemplos de dados: ${JSON.stringify(exampleRows)}

        Retorne APENAS um JSON no formato:
        {
          "nome": "NOME_DO_CABEÇALHO_MAPEADO",
          "telefone": "NOME_DO_CABEÇALHO_MAPEADO",
          ...
        }
        Se não encontrar um mapeamento óbvio para um campo (exceto nome), ignore-o no JSON.
        O campo "nome" é OBRIGATÓRIO.
      `;

            const response = await gabi.sendMessage([
                { role: 'system', content: 'Você é um assistente de mapeamento de dados JSON.' },
                { role: 'user', content: prompt }
            ]);

            if (response.content) {
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const mapped = JSON.parse(jsonMatch[0]);
                    setMapping(mapped);
                    setStep(2);
                }
            }
        } catch (error) {
            console.error("Erro no mapeamento:", error);
            toast.error("Gabi não conseguiu mapear automaticamente. Tente novamente.");
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    };

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!session || !mapping || finalData.length === 0) return;

            setIsImporting(true);
            const validToken = await getValidToken();

            // Normalização para de-duplicação
            const normalizePhone = (p: string | null | undefined) => p?.replace(/\D/g, '') || '';
            const normalizeName = (n: string | null | undefined) => removeAccents(n?.toLowerCase() || '').trim();

            const existingMap = new Set(
                (existingClients || []).map(c =>
                    `${normalizeName(c.nome)}|${normalizePhone(c.telefone)}`
                )
            );

            let skipped = 0;
            const clientsToInsert = finalData.map(row => {
                const client: any = {
                    user_id: session.user.id,
                    organization_id: profile?.organization_id,
                    status: 'ativo'
                };

                (Object.keys(mapping) as Array<keyof MappingResult>).forEach(field => {
                    const csvHeader = mapping[field];
                    const headerIndex = headers.indexOf(csvHeader!);
                    if (headerIndex !== -1) {
                        let value = row[headerIndex];
                        if (field === 'valor_metro') {
                            value = typeof value === 'string' ? value.replace(/[^\d.,]/g, '').replace(',', '.') : value;
                            client[field] = value ? parseFloat(value.toString()) : null;
                        } else {
                            client[field] = value?.toString() || null;
                        }
                    }
                });

                return client;
            }).filter(c => {
                if (!c.nome) return false;

                const key = `${normalizeName(c.nome)}|${normalizePhone(c.telefone)}`;
                if (existingMap.has(key)) {
                    skipped++;
                    return false;
                }
                return true;
            });

            setSkippedCount(skipped);
            if (clientsToInsert.length === 0) {
                setInsertedCount(0);
                return 0;
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${validToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(clientsToInsert)
            });

            if (!response.ok) throw new Error("Erro ao inserir clientes");

            const count = clientsToInsert.length;
            setInsertedCount(count);
            return count;
        },
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: ["clientes"] });
            if (count === 0 && skippedCount > 0) {
                toast.info(`Nenhum cliente novo. ${skippedCount} duplicatas foram ignoradas.`);
            } else {
                toast.success(`${count} clientes importados! (${skippedCount} duplicatas puladas)`);
            }
            setStep(3);
        },
        onError: (err) => {
            toast.error("Falha na importação em massa.");
            console.error(err);
        },
        onSettled: () => setIsImporting(false)
    });

    const reset = () => {
        setFile(null);
        setFinalData([]);
        setHeaders([]);
        setMapping(null);
        setStep(1);
        setIsLoading(false);
        setLoadingMessage("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) reset(); }}>
            <DialogContent className="sm:max-w-[650px] bg-sky-950/20 backdrop-blur-3xl border-white/20 text-white rounded-[40px] overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.5)] border-t-white/30 border-l-white/30">
                {/* Background Glass Ornaments */}
                <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-[#FFF200]/10 blur-[80px] rounded-full pointer-events-none" />

                <DialogHeader className="relative z-10 px-6 pt-6">
                    <DialogTitle className="flex items-center gap-4 text-3xl font-black italic uppercase tracking-tighter">
                        <div className="p-3 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg">
                            <BrainCircuit className="w-8 h-8 text-[#FFF200]" />
                        </div>
                        Gabi <span className="text-[#FFF200]">Import</span>
                    </DialogTitle>
                    <DialogDescription className="text-zinc-300 text-sm mt-3 font-medium">
                        Liquid Smart Engine: Suporta Excel, CSV e PDF com reconhecimento inteligente.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-2 relative z-10">
                    {step === 1 && (
                        <div
                            {...getRootProps()}
                            className={`mt-4 relative z-10 border border-white/10 rounded-[32px] p-12 transition-all duration-700 flex flex-col items-center justify-center gap-6 cursor-pointer
                ${isDragActive ? 'bg-white/10 scale-[0.98] border-white/30' : 'bg-white/5 hover:bg-white/[0.08] shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]'}
                `}
                        >
                            <input {...getInputProps()} />
                            {isLoading ? (
                                <div className="flex flex-col items-center gap-5 text-center">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-[#FFF200]/40 blur-2xl rounded-full animate-pulse" />
                                        <Loader2 className="w-14 h-14 text-[#FFF200] animate-spin relative" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFF200] animate-pulse">Injetando Inteligência...</p>
                                        <p className="text-xs text-zinc-400 mt-2 font-medium">{loadingMessage}</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-6">
                                        <div className="w-20 h-20 rounded-[28px] bg-zinc-900/40 backdrop-blur-xl flex items-center justify-center border border-white/10 shadow-2xl transition-all hover:-translate-y-2 hover:-rotate-6">
                                            <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                                        </div>
                                        <div className="w-20 h-20 rounded-[28px] bg-zinc-900/40 backdrop-blur-xl flex items-center justify-center border border-white/10 shadow-2xl transition-all hover:-translate-y-2 hover:rotate-6">
                                            <FileText className="w-10 h-10 text-orange-400" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-extrabold text-xl tracking-tight">Solte seus dados aqui</p>
                                        <p className="text-[10px] text-zinc-400 mt-3 uppercase tracking-[0.15em] font-black bg-white/5 px-4 py-2 rounded-full border border-white/5">Excel • CSV • PDF • Imagem</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 2 && mapping && (
                        <div className="mt-4 relative z-10 space-y-5 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] p-6 flex items-start gap-5 shadow-xl">
                                <div className="w-12 h-12 rounded-2xl bg-[#FFF200] flex items-center justify-center shadow-[0_0_20px_rgba(255,242,0,0.4)]">
                                    <BrainCircuit className="w-7 h-7 text-black" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-[#FFF200]">Mapeamento Líquido</h4>
                                    <p className="text-xs text-zinc-200 leading-relaxed mt-1 font-medium opacity-80">Gabi refinou sua planilha. Tudo pronto para a injeção de dados.</p>
                                </div>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto border border-white/10 rounded-[28px] bg-black/30 backdrop-blur-xl shadow-inner px-2">
                                <Table>
                                    <TableHeader className="bg-transparent sticky top-0 backdrop-blur-3xl z-20">
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] py-5 px-6 text-zinc-400">Sistema</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] py-5 px-6 text-zinc-400 text-right">Sua Coluna</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(mapping).map(([field, header]) => (
                                            <TableRow key={field} className="border-white/5 hover:bg-white/[0.05] transition-all group">
                                                <TableCell className="capitalize py-5 px-6 text-sm font-bold text-white/70 group-hover:text-white">{field.replace('_', ' ')}</TableCell>
                                                <TableCell className="py-5 px-6 text-sm font-black text-[#FFF200] text-right drop-shadow-[0_0_10px_rgba(255,242,0,0.2)]">{header}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex items-center justify-between px-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                                        Carga: <span className="text-white font-black">{finalData.length} registros</span>
                                    </p>
                                </div>
                                <Button variant="link" onClick={reset} className="text-[10px] text-[#FFF200] hover:text-white font-black uppercase tracking-widest h-auto p-0 opacity-70 hover:opacity-100">
                                    Novo Arquivo
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="py-16 relative z-10 flex flex-col items-center text-center animate-in zoom-in-90 duration-1000">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-emerald-400/30 blur-[60px] animate-pulse" />
                                <div className="w-32 h-32 rounded-[40px] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 relative shadow-2xl">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-black uppercase italic text-white tracking-tight">Sync Completo</h3>
                            <p className="text-sm text-zinc-400 mt-3 max-w-[300px] font-medium leading-relaxed">
                                {insertedCount > 0
                                    ? `Injetamos ${insertedCount} novos clientes no Direct AI.`
                                    : "Nenhum cliente novo foi detectado."
                                }
                                {skippedCount > 0 && ` ${skippedCount} duplicatas foram protegidas e ignoradas.`}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="relative z-10 px-8 pb-8 pt-4 gap-4 sm:flex-row-reverse">
                    {step === 1 && (
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-2xl h-14 w-full sm:w-auto font-bold"
                        >
                            Fechar
                        </Button>
                    )}
                    {step === 2 && (
                        <>
                            <Button
                                onClick={() => importMutation.mutate()}
                                disabled={isImporting}
                                className="bg-[#FFF200] text-black font-black uppercase tracking-widest hover:bg-white transition-all rounded-[24px] h-16 flex-1 shadow-[0_10px_40px_rgba(255,242,0,0.2)] hover:shadow-[0_15px_50px_rgba(255,242,0,0.4)] text-base group"
                            >
                                {isImporting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                    <div className="flex items-center gap-2">
                                        <span>Confirmar Injeção</span>
                                        <CheckCircle2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                                    </div>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={reset}
                                className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-[24px] h-16 px-6 shadow-xl"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </>
                    )}
                    {step === 3 && (
                        <Button
                            onClick={() => onOpenChange(false)}
                            className="w-full bg-white text-black font-black uppercase rounded-[24px] h-16 hover:bg-[#FFF200] transition-all text-base shadow-2xl"
                        >
                            Acessar Dashboard
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
