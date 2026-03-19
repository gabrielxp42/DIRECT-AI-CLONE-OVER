/**
* Gallery Service — Armazena metadata de gerações no localStorage.
* 
* Cada item salva: prompt, data, caminho do arquivo, thumbnail (base64 pequeno),
* aspect ratio, garment mode, e configurações usadas.
*/

const STORAGE_KEY = 'dtf-gallery-items';
const MAX_ITEMS = 200;
const THUMB_SIZE = 360; // px — Reduzido para evitar quota do LocalStorage (era 1024)

export interface GalleryItem {
    id: string;
    prompt: string;
    timestamp: number;
    savedPath: string | null;
    masterFilePath?: string | null; // Caminho da imagem original (sem halftone)
    masterUrl?: string | null; // URL temporária para uso no browser (web)
    thumbnail: string; // base64 pequeno (~5KB)
    aspectRatio: string;
    garmentMode: 'black' | 'white' | 'color';
    widthCm: number;
    heightCm: number;
    halftonePreset: string;
    // Metadata extra
    upscaleFactor?: number;
    generationTimeMs?: number;
}

/** Gera ID único */
function generateId(): string {
    return `gal-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Cria thumbnail base64 a partir de uma blob URL ou data URL.
 * Retorna uma string base64 JPEG comprimida (~3-8KB).
 */
export async function createThumbnail(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Blob URLs não precisam de CORS — só setar para URLs externas
        if (!imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
            img.crossOrigin = 'anonymous';
        }

        // Timeout de segurança
        const timeout = setTimeout(() => reject(new Error('Thumbnail timeout')), 10000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                const aspect = img.naturalWidth / img.naturalHeight;

                let w: number, h: number;
                if (aspect >= 1) {
                    w = THUMB_SIZE;
                    h = Math.round(THUMB_SIZE / aspect);
                } else {
                    h = THUMB_SIZE;
                    w = Math.round(THUMB_SIZE * aspect);
                }

                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, w, h);

                // JPEG com qualidade 0.85 para melhor visualização
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Erro ao criar thumbnail'));
        };
        img.src = imageUrl;
    });
}

/** Lê todos os items da galeria */
export function getGalleryItems(): GalleryItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const items: GalleryItem[] = JSON.parse(raw);
        // Ordenar por mais recente
        return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
        console.error('[Gallery] Erro ao ler galeria:', e);
        return [];
    }
}

/** Salva um novo item na galeria */
export function saveGalleryItem(item: Omit<GalleryItem, 'id'>): GalleryItem {
    const items = getGalleryItems();
    const newItem: GalleryItem = { ...item, id: generateId() };

    // Adicionar no início (mais recente primeiro)
    items.unshift(newItem);

    // Limitar total de items (remover os mais antigos)
    const trimmed = items.slice(0, MAX_ITEMS);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        console.log('[Gallery] Item salvo:', newItem.id);
    } catch (e) {
        console.error('[Gallery] Erro ao salvar (localStorage cheio?):', e);
        // Tentar com menos items
        const smaller = trimmed.slice(0, MAX_ITEMS / 2);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(smaller));
    }

    return newItem;
}

/** Remove um item da galeria */
export function removeGalleryItem(id: string): void {
    const items = getGalleryItems().filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Atualiza um item existente na galeria */
export function updateGalleryItem(id: string, updates: Partial<GalleryItem>): void {
    const items = getGalleryItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            console.log('[Gallery] Item atualizado:', id);
        } catch (e) {
            console.error('[Gallery] Erro ao atualizar item:', e);
        }
    }
}

export function syncWithFiles(files: { filename: string, path: string }[]): number {
    const items = getGalleryItems();
    let updatedCount = 0;

    // Helper to strip extension
    const stripExt = (name: string) => name.replace(/\.[^/.]+$/, "").toLowerCase();

    items.forEach(item => {
        // Helper to find file in the list using fuzzy logic
        const findFile = (currentPath: string | null) => {
            if (!currentPath) return undefined;
            const basename = currentPath.split(/[/\\]/).pop() || '';
            const basenameNoExt = stripExt(basename);

            // 1. Try exact match
            let found = files.find(f => f.filename === basename);

            // 2. Try match without extension (case-insensitive via stripExt)
            if (!found) {
                found = files.find(f => stripExt(f.filename) === basenameNoExt);
            }
            return found;
        };

        // Verifica masterFilePath
        if (item.masterFilePath) {
            const found = findFile(item.masterFilePath);
            if (found && item.masterFilePath !== found.path) {
                console.log(`[Sync] Updating master path via match for ${item.id}: ${found.path}`);
                item.masterFilePath = found.path;
                updatedCount++;
            }
        }

        // Verifica savedPath e tenta curar (healing)
        if (item.savedPath) {
            const found = findFile(item.savedPath);
            if (found) {
                // Update savedPath
                if (item.savedPath !== found.path) {
                    console.log(`[Sync] Updating saved path for ${item.id}: ${found.path}`);
                    item.savedPath = found.path;
                    updatedCount++;
                }

                // HEALING: Se não tem masterFilePath, usa este encontrado
                if (!item.masterFilePath) {
                    console.log(`[Sync] Healing master path for ${item.id}: ${found.path}`);
                    item.masterFilePath = found.path;
                    updatedCount++;
                }
            }
        }
    });

    if (updatedCount > 0) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            console.log(`[Sync] Updated ${updatedCount} items.`);
        } catch (e) {
            console.error('[Sync] Error saving synced items:', e);
        }
    }
    return updatedCount;
}

/** Limpa toda a galeria */
export function clearGallery(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/** Formata timestamp para exibição */
export function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;

    // Menos de 1 hora
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return mins <= 1 ? 'Agora mesmo' : `${mins} min atrás`;
    }

    // Menos de 24 horas
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h atrás`;
    }

    // Mesmo ano
    if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
