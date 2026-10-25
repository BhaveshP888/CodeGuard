import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getMasterKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY or AUTH_SECRET environment variable is not configured');
  }

  // Derive a consistent 32-byte key from the secret
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Fallback to SHA-256 digest to ensure exact 32 bytes
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(secret).digest();
}

export interface EncryptedPayload {
  ciphertext: string; // hex
  iv: string; // hex
  tag: string; // hex
}

/**
 * Encrypts a plaintext string (e.g. GitHub OAuth token) using AES-256-GCM.
 */
export function encryptToken(plainText: string): EncryptedPayload {
  if (!plainText) {
    throw new Error('Cannot encrypt empty plaintext');
  }

  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts an encrypted token payload back to plaintext.
 */
export function decryptToken(encrypted: EncryptedPayload): string {
  if (!encrypted.ciphertext || !encrypted.iv || !encrypted.tag) {
    throw new Error('Invalid encrypted payload structure');
  }

  const key = getMasterKey();
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
