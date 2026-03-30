import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { wasabiClient, WASABI_BUCKET_NAME } from './client';

// Categorias explícitas para garantir que o Wasabi só seja usado para arquivos permanentes
export type WasabiFolder = 
  | 'print-files' // Arquivos de impressão (Direct / Pedidos com arquivos)
  | 'dtf-masters' // Imagens geradas originais (Galeria do usuário no DTF Factory)
  | 'dtf-treated' // Imagens finais tratadas/filtradas (Galeria do usuário)
  | 'assets';     // Arquivos permanentes gerais

export const uploadFileToWasabi = async (
  file: File,
  folder: WasabiFolder = 'print-files'
): Promise<{ url: string; path: string }> => {
  try {
    // Gerar um nome de arquivo único para evitar colisões
    const timestamp = new Date().getTime();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${cleanFileName}`;

    // Usar @aws-sdk/lib-storage para upload multipart (muito mais estável para arquivos grandes no browser)
    // O erro 'readableStream.getReader is not a function' acontece no sdk v3 quando passamos um File puro em browsers as vezes.
    // Passar o Blob bruto ou ArrayBuffer costuma resolver, o Upload já lida com streams melhor.
    const parallelUploads3 = new Upload({
      client: wasabiClient,
      params: {
        Bucket: WASABI_BUCKET_NAME,
        Key: key,
        Body: file, // O @aws-sdk/lib-storage sabe lidar com File natively na web
        ContentType: file.type,
      },
      // Configurações de partição para otimizar arquivos pesados (ex: TIFFs)
      queueSize: 4, 
      partSize: 1024 * 1024 * 5, // 5 MB
      leavePartsOnError: false,
    });

    parallelUploads3.on("httpUploadProgress", (progress) => {
      // Aqui poderíamos emitir eventos de progresso no futuro, se necessário
      // console.log(`Upload Wasabi Progress: ${progress.loaded}/${progress.total}`);
    });

    await parallelUploads3.done();

    // Constrói a URL final
    let url = '';
    // Pegar o endpoint do cliente, mas se falhar cai no fallback
    const configEndpoint = await wasabiClient.config.endpoint();
    if (configEndpoint) {
      const hostname = configEndpoint.hostname;
      const protocol = configEndpoint.protocol;
      url = `${protocol}//${hostname}/${WASABI_BUCKET_NAME}/${key}`;
    } else {
      url = `https://s3.us-east-1.wasabisys.com/${WASABI_BUCKET_NAME}/${key}`;
    }

    return { url, path: key };
  } catch (error) {
    console.error('Erro ao fazer upload para o Wasabi:', error);
    throw error;
  }
};

/**
 * Gera uma URL assinada temporária para visualizar/baixar um arquivo privado
 */
export const getPresignedUrl = async (key: string, expiresIn: number = 3600, filename?: string): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: filename ? `inline; filename="${filename}"` : 'inline'
    });
    const url = await getSignedUrl(wasabiClient, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Erro ao gerar URL assinada do Wasabi:', error);
    throw error;
  }
};

export const deleteFileFromWasabi = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: WASABI_BUCKET_NAME,
      Key: key,
    });
    await wasabiClient.send(command);
  } catch (error) {
    console.error('Erro ao excluir arquivo do Wasabi:', error);
    throw error;
  }
};
