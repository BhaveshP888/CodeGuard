import { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { decryptToken } from '@/lib/crypto/tokens';

/**
 * Returns an authenticated Octokit instance for the given user by decrypting their stored token.
 */
export async function getUserOctokit(userId: string): Promise<Octokit> {
  const userList = await db
    .select({
      encryptedAccessToken: users.encryptedAccessToken,
      accessTokenIv: users.accessTokenIv,
      accessTokenTag: users.accessTokenTag,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userList[0];
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  const token = decryptToken({
    ciphertext: user.encryptedAccessToken,
    iv: user.accessTokenIv,
    tag: user.accessTokenTag,
  });

  return new Octokit({
    auth: token,
  });
}

/**
 * Create a raw Octokit instance directly with a known token (useful for webhooks or ephemeral tokens).
 */
export function createOctokitWithToken(token: string): Octokit {
  return new Octokit({
    auth: token,
  });
}
