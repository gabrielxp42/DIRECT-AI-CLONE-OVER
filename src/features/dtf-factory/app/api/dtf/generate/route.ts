
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateWithKieModel } from '@dtf/services/kieApi';
import { 
    applyHalftoneServer, 
    getHalftonePreset, 
    addBlackBackgroundServer, 
    addWhiteBackgroundServer,
    HalftoneSettings 
} from '@dtf/lib/server-halftone';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
    try {
        // 1. Autenticação
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Token de autenticação não fornecido' }, { status: 401 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
        }

        // 2. Ler parâmetros do corpo
        const body = await req.json();
        const { 
            prompt, 
            aspectRatio = '1:1', 
            garmentMode = 'black', // 'black', 'white', 'color'
            halftonePreset = 'halftone_medio_preto',
            modelId = 'nano-banana-2',
            imageFiles, // Base64 array
            maskImage, // Base64
            skipHalftone = false // Opção para retornar imagem limpa
        } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt é obrigatório' }, { status: 400 });
        }

        // 3. Debitar Tokens (20 tokens por geração)
        // Usamos o cliente autenticado do usuário para chamar a RPC
        const { error: debitError } = await supabase.rpc('debit_user_tokens', {
            p_user_uid: user.id,
            p_amount: 20,
            p_reason: `API Generation: ${prompt.substring(0, 20)}...`,
            p_metadata: {}
        });

        if (debitError) {
            console.error('Erro ao debitar tokens:', debitError);
            return NextResponse.json({ error: 'Saldo insuficiente ou erro ao debitar tokens: ' + debitError.message }, { status: 402 });
        }

        // 4. Gerar Imagem com KIE
        // Nota: generateWithKieModel faz polling interno. Pode demorar 30-60s.
        // Vercel Free timeout é 10s. Pro é 60s.
        // Se der timeout, o cliente recebe erro, mas os tokens foram debitados e a imagem gerada no background.
        // Idealmente, usaríamos Webhooks ou background jobs, mas para MVP síncrono:
        
        let generatedUrl: string;
        try {
            // Preparar imagens de entrada se houver
            // O kieService espera strings (url ou base64)
            const imageUrls = imageFiles ? (Array.isArray(imageFiles) ? imageFiles : [imageFiles]) : undefined;

            generatedUrl = await generateWithKieModel(
                prompt,
                aspectRatio,
                imageUrls,
                garmentMode === 'white' ? 'Solid Plain White Background' : 'Solid Black Background',
                '2K', // Default resolution for API
                modelId,
                maskImage
            );
        } catch (genError: any) {
            // Estornar tokens em caso de falha na geração
            // await creditTokensServer(user.id, 20, 'Estorno: Falha na geração API');
            return NextResponse.json({ error: 'Erro na geração da imagem: ' + genError.message }, { status: 500 });
        }

        // 5. Download da imagem gerada
        const imageRes = await fetch(generatedUrl);
        if (!imageRes.ok) throw new Error('Falha ao baixar imagem gerada');
        const imageArrayBuffer = await imageRes.arrayBuffer();
        let imageBuffer = Buffer.from(imageArrayBuffer);

        // 6. Processamento de Fundo
        if (garmentMode === 'black') {
            imageBuffer = await addBlackBackgroundServer(imageBuffer);
        } else if (garmentMode === 'white') {
            imageBuffer = await addWhiteBackgroundServer(imageBuffer);
        }

        // 7. Halftone (se não for colorido e não pulado)
        if (garmentMode !== 'color' && !skipHalftone) {
            const presetKey = garmentMode === 'white' ? 'white_shirt' : (halftonePreset || 'halftone_medio_preto');
            const preset = getHalftonePreset(presetKey);
            
            if (preset) {
                const settings: HalftoneSettings = {
                    ...preset.settings,
                    removeBlack: true,
                    edgeContraction: 2,
                    invertInput: garmentMode === 'white' ? true : preset.settings.invertInput,
                    invertOutput: garmentMode === 'white' ? true : preset.settings.invertOutput,
                };
                
                imageBuffer = await applyHalftoneServer(imageBuffer, settings);
            }
        }

        // 8. Retornar imagem
        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="dtf-api-${Date.now()}.png"`,
                'X-Overpixel-Tokens-Charged': '20'
            }
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor: ' + error.message }, { status: 500 });
    }
}
