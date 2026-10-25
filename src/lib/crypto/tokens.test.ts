import { describe, it, expect, beforeEach } from 'vitest';
import { encryptToken, decryptToken } from './tokens';

describe('AES-256-GCM Token Encryption', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  it('should encrypt and decrypt a plaintext token successfully', () => {
    const originalToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = encryptToken(originalToken);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes = 24 hex characters
    expect(encrypted.tag).toHaveLength(32); // 16 bytes = 32 hex characters
    expect(encrypted.ciphertext).not.toEqual(originalToken);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it('should fail decryption if ciphertext is tampered with', () => {
    const originalToken = 'ghp_secret_access_token_12345';
    const encrypted = encryptToken(originalToken);

    // Tamper with the last character of the ciphertext
    const tamperedCiphertext = encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.endsWith('0') ? '1' : '0');
    const tampered = { ...encrypted, ciphertext: tamperedCiphertext };

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('should produce different ciphertexts for the same plaintext due to random IVs', () => {
    const token = 'gho_sample_token';
    const enc1 = encryptToken(token);
    const enc2 = encryptToken(token);

    expect(enc1.iv).not.toEqual(enc2.iv);
    expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
    expect(decryptToken(enc1)).toBe(token);
    expect(decryptToken(enc2)).toBe(token);
  });
});
