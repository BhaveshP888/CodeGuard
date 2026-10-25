import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID;
const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'codeguard-artifacts';

export const storageClient = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Uploads a buffer to Cloudflare R2 / S3 storage.
 */
export async function uploadToStorage(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType = 'application/octet-stream'
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await storageClient.send(command);
  return key;
}

/**
 * Retrieves a file from Cloudflare R2 / S3 storage as a UTF-8 string.
 */
export async function getFromStorage(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await storageClient.send(command);
  if (!response.Body) {
    throw new Error(`File ${key} is empty or not found`);
  }

  return response.Body.transformToString('utf-8');
}
