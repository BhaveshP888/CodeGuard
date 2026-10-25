import { describe, it, expect } from 'vitest';
import { splitMarkdownDocument, splitSourceCode } from './splitter';

describe('LangChain Ingestion Splitter', () => {
  it('should split markdown into semantic chunks', async () => {
    const md = `
# Authentication Guidelines

## Password Hashing
All user passwords must be hashed using Argon2id with a memory cost of 64MB.

## Session Tokens
JWT tokens must not exceed a 15-minute lifespan and must be signed with RS256.

## Multi-Factor Authentication
Admins must enforce TOTP or WebAuthn for privileged actions.
    `.trim();

    const chunks = await splitMarkdownDocument(md, 200, 20);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.includes('Password Hashing'))).toBe(true);
  });

  it('should split TypeScript code with line tracking', async () => {
    const tsCode = `
export function verifySessionToken(token: string): boolean {
  if (!token) return false;
  return token.startsWith("ey");
}

export class SecurityManager {
  private secret: string;
  constructor(secret: string) {
    this.secret = secret;
  }
}
    `.trim();

    const chunks = await splitSourceCode(tsCode, 'typescript', 300, 50);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].startLine).toBeGreaterThanOrEqual(1);
    expect(chunks[0].endLine).toBeGreaterThanOrEqual(chunks[0].startLine);
  });
});
