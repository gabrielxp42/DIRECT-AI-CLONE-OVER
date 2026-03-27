/**
 * Integração com Tmpfiles.org
 * Útil para uploads TEMPORÁRIOS como:
 * - Inputs de referência de imagem no DTF Factory
 * - Arquivos de processamento rápido que não precisam sujar o banco/Wasabi
 */

export interface TmpfilesResponse {
  status: string;
  message?: string;
  data?: {
    url: string; // Ex: https://tmpfiles.org/12345/image.png
  };
}

export const uploadFileToTmpfiles = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Erro no Tmpfiles: ${response.statusText}`);
    }

    const data: TmpfilesResponse = await response.json();

    if (data.status !== 'success' || !data.data?.url) {
      throw new Error('Falha ao obter URL do Tmpfiles');
    }

    // O tmpfiles retorna uma URL de visualização (ex: https://tmpfiles.org/12345/image.png)
    // Para obter o link de download direto, substituímos "tmpfiles.org/" por "tmpfiles.org/dl/"
    const directUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    
    return directUrl;
  } catch (error) {
    console.error('Erro ao fazer upload temporário:', error);
    throw error;
  }
};
