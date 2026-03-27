import { S3Client } from '@aws-sdk/client-s3';

// Lendo as configurações do .env
const WASABI_REGION = import.meta.env.VITE_WASABI_REGION || 'us-east-1'; // ex: us-east-1, sa-east-1
const WASABI_ACCESS_KEY = import.meta.env.VITE_WASABI_ACCESS_KEY_ID || import.meta.env.VITE_WASABI_ACCESS_KEY || '';
const WASABI_SECRET_KEY = import.meta.env.VITE_WASABI_SECRET_ACCESS_KEY || import.meta.env.VITE_WASABI_SECRET_KEY || '';
const WASABI_ENDPOINT = import.meta.env.VITE_WASABI_ENDPOINT || `https://s3.${WASABI_REGION}.wasabisys.com`;

// Criação do cliente S3 configurado para o Wasabi
export const wasabiClient = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY,
    secretAccessKey: WASABI_SECRET_KEY,
  },
  // O Wasabi requer que o path style seja true para evitar problemas de DNS com buckets com pontos no nome
  forcePathStyle: true,
});

export const WASABI_BUCKET_NAME = import.meta.env.VITE_WASABI_BUCKET || import.meta.env.VITE_WASABI_BUCKET_NAME || 'overpixelchat';
