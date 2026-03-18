/**
 * Utilitário para buscar Blobs a partir de URLs (locais ou remotas).
 * Usado principalmente para converter URLs de imagens em Blobs para processamento.
 */
export async function fetchBlob(url: string): Promise<Blob> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch blob from ${url}: ${response.statusText}`);
        }
        return await response.blob();
    } catch (error) {
        console.error('Error fetching blob:', error);
        throw error;
    }
}
