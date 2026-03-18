
import { 
    KIECreateTaskInput, 
    KIERecordInfoData, 
    uploadToTmpFiles, 
    createKieTask, 
    recordKieInfo, 
    generateWithKieModel 
} from './kieApi';

// Re-exportar funções e tipos da API
export type { KIECreateTaskInput, KIERecordInfoData };
export { uploadToTmpFiles, createKieTask, recordKieInfo, generateWithKieModel };

/**
 * Adicionar fundo preto LOCALMENTE via Canvas (Client-side only)
 * NÃO usa IA - apenas processa a imagem existente
 */
export async function addBlackBackground(imageUrl: string): Promise<string> {
    console.log('🎨 Adicionando fundo preto localmente...');

    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            reject(new Error('Canvas não disponível no ambiente atual'));
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d')!;

            // 1. Preencher com preto primeiro
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Desenhar a imagem por cima (a transparência mostrará o preto)
            ctx.drawImage(img, 0, 0);

            // 3. Converter para blob URL
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    console.log('✅ Fundo preto adicionado localmente');
                    resolve(url);
                } else {
                    reject(new Error('Erro ao criar blob'));
                }
            }, 'image/png', 1.0);
        };

        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = imageUrl;
    });
}

/**
 * Adicionar fundo branco LOCALMENTE via Canvas (Client-side only)
 * NÃO usa IA - apenas processa a imagem existente
 */
export async function addWhiteBackground(imageUrl: string): Promise<string> {
    console.log('🎨 Adicionando fundo branco localmente...');

    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            reject(new Error('Canvas não disponível no ambiente atual'));
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext('2d')!;

            // 1. Preencher com branco primeiro
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Desenhar a imagem por cima (a transparência mostrará o branco)
            ctx.drawImage(img, 0, 0);

            // 3. Converter para blob URL
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    console.log('✅ Fundo branco adicionado localmente');
                    resolve(url);
                } else {
                    reject(new Error('Erro ao criar blob'));
                }
            }, 'image/png', 1.0);
        };

        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = imageUrl;
    });
}
