
// Configuração do Supabase para o projeto desktop
// Reutiliza as Edge Functions existentes do projeto Overpixel

// Fallback para credenciais do Overpixel Hub
import { SUPABASE_URL as ENV_SUPABASE_URL, SUPABASE_ANON_KEY as ENV_SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

const SUPABASE_URL = ENV_SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV_SUPABASE_ANON_KEY;

export interface KIECreateTaskInput {
    model: string;
    callBackUrl?: string | null;
    userId?: string;
    input: {
        mode?: 'generate' | 'edit';
        prompt?: string;
        image_urls?: string[];
        image_input?: string[];
        mask_image?: string; // Adicionado suporte para máscara
        output_format?: 'png' | 'jpeg';
        image_size?: '1:1' | '9:16' | '16:9' | '3:4' | '4:3' | '3:2' | '2:3' | '5:4' | '4:5' | '21:9' | 'auto';
        aspect_ratio?: string;
        resolution?: '1K' | '2K' | '4K';
        google_search?: boolean;
    };
}

export interface KIERecordInfoData {
    taskId: string;
    state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
}

function getFunctionsUrl() {
    if (!SUPABASE_URL) return '';
    return SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co');
}

/**
 * Upload temporário de imagem para URL pública via tmpfiles.org
 * Necessário porque KIE não aceita base64, apenas URLs públicas
 */
export async function uploadToTmpFiles(base64Data: string): Promise<string> {
    console.log('📤 Fazendo upload temporário da imagem...');

    // Extrair dados do base64
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        throw new Error('Formato base64 inválido');
    }

    const mimeType = matches[1];
    const base64Content = matches[2];
    const binary = atob(base64Content);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([array], { type: mimeType });

    // Criar FormData
    const formData = new FormData();
    const extension = mimeType.split('/')[1] || 'png';
    formData.append('file', blob, `image.${extension}`);

    // Upload para tmpfiles.org
    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Upload falhou: ${response.status}`);
    }

    const result = await response.json();

    // tmpfiles retorna { data: { url: "https://tmpfiles.org/xxxxx/image.png" } }
    // Precisamos converter para URL direta: https://tmpfiles.org/dl/xxxxx/image.png
    const tmpUrl = result?.data?.url;
    if (!tmpUrl) {
        throw new Error('tmpfiles.org não retornou URL');
    }

    // Converter URL para link direto
    const directUrl = tmpUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

    console.log('✅ Upload temporário concluído:', directUrl);
    return directUrl;
}

export async function createKieTask(payload: KIECreateTaskInput): Promise<string> {
    const fnBase = getFunctionsUrl();
    if (!fnBase) throw new Error('Supabase URL não configurada');

    const url = `${fnBase}/kie-create-task`;

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-client-info': '@supabase/supabase-js',
            ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        },
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
    }

    const json = await resp.json();
    const taskId = json?.taskId || json?.data?.taskId;
    if (!taskId) throw new Error('Edge Function não retornou taskId');

    return taskId;
}

export async function recordKieInfo(taskId: string): Promise<KIERecordInfoData> {
    const fnBase = getFunctionsUrl();
    if (!fnBase) throw new Error('Supabase URL não configurada');

    const url = `${fnBase}/kie-record-info`;

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-client-info': '@supabase/supabase-js',
            ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
        },
        body: JSON.stringify({ taskId }),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `HTTP ${resp.status}`);
    }

    return resp.json();
}

// Geração via modelo KIE (resolução configurável: 1K, 2K ou 4K)
export async function generateWithKieModel(
    prompt: string,
    aspectRatio: string = '1:1',
    imageUrls?: string[], // Array de até 5 imagens. Se tiver mask, deve ser [original, mask]
    backgroundSuffix: string = 'Solid Black Background',
    resolution: '1K' | '2K' | '4K' = '1K',
    modelId: string = 'nano-banana-2',
    maskImage?: string // Opcional: Máscara explícita base64
): Promise<string> {
    const model = modelId;
    const hasImages = (imageUrls && imageUrls.length > 0);
    const mode = hasImages ? 'edit' : 'generate';

    const input: KIECreateTaskInput['input'] = {
        mode: mode,
        prompt: `${prompt} - ${backgroundSuffix}`,
        output_format: 'png',
        image_size: aspectRatio as any,
        aspect_ratio: aspectRatio,
        resolution: resolution,
        google_search: modelId === 'nano-banana-2', // Habilita google_search para o nano-banana-2
    };

    // Se tem imagens de referência, fazer upload de TODAS
    if (hasImages) {
        console.log(`📤 Fazendo upload de ${imageUrls!.length} imagem(ns)...`);

        const publicUrls: string[] = [];

        for (let i = 0; i < imageUrls!.length; i++) {
            let publicUrl = imageUrls![i];

            // Se é base64, fazer upload para URL pública
            if (imageUrls![i].startsWith('data:')) {
                console.log(`📤 Upload imagem ${i + 1}/${imageUrls!.length}...`);
                publicUrl = await uploadToTmpFiles(imageUrls![i]);
            }

            publicUrls.push(publicUrl);
        }

        // SE TEM MÁSCARA EXPLÍCITA
        if (maskImage) {
            console.log('📤 Fazendo upload da máscara explícita...');
            let maskPublicUrl = maskImage;
            if (maskImage.startsWith('data:')) {
                maskPublicUrl = await uploadToTmpFiles(maskImage);
            }
            // KIE API Convention for Inpainting:
            // image_input: [original_url]
            // mask_image: mask_url
            // mode: 'edit'
            input.image_urls = publicUrls; // Original
            input.image_input = publicUrls;
            input.mask_image = maskPublicUrl;
            console.log('✅ Máscara configurada para inpainting');
        } else {
            // Comportamento padrão (img2img ou ipadapter)
            console.log(`✅ ${publicUrls.length} imagens prontas para enviar`);
            input.image_urls = publicUrls;
            input.image_input = publicUrls;
        }
    }

    // LOG: Debug do que está sendo enviado
    console.log('🎨 GERANDO IMAGEM COM:', {
        model,
        aspectRatio,
        image_size: input.image_size,
        numImages: input.image_urls?.length || 0,
        promptPreview: input.prompt?.substring(0, 50) + '...'
    });

    const taskId = await createKieTask({ model, input });

    // Polling para resultado
    let tries = 0;
    while (tries < 120) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const info = await recordKieInfo(taskId);

            if (info.state === 'success') {
                if (info.resultJson) {
                    try {
                        const parsed = JSON.parse(info.resultJson);
                        const urls = parsed?.resultUrls || parsed?.result || parsed?.urls;
                        const resultUrl = Array.isArray(urls) ? urls[0] : null;
                        if (resultUrl) return resultUrl;

                        // Tentar extrair URL de qualquer campo
                        const urlMatch = JSON.stringify(parsed).match(/https?:\/\/[^\s"]+/);
                        if (urlMatch) return urlMatch[0];
                    } catch { }
                }
            }

            if (info.state === 'fail') {
                throw new Error(info.failMsg || 'Falha na geração');
            }
        } catch (error) {
            // Ignorar falhas de rede / HTTP temporárias (como o 502 Bad Gateway)
            console.warn(`[KIE API] Falha na checagem de status da image (Tentativa ${tries + 1}/120). Tentando novamente...`, error);
        }

        tries++;
    }

    throw new Error('Timeout na geração');
}
