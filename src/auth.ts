import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { encryptToken } from '@/lib/crypto/tokens';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || '',
      clientSecret: process.env.AUTH_GITHUB_SECRET || '',
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile && account.access_token) {
        const githubId = String(profile.id || account.providerAccountId);
        const username = (profile as { login?: string }).login || profile.name || 'github-user';
        const email = profile.email || token.email || null;
        const avatarUrl = (profile as { avatar_url?: string }).avatar_url || token.picture || null;

        const encrypted = encryptToken(account.access_token);

        // Upsert user into PostgreSQL
        const existingUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.githubId, githubId))
          .limit(1);

        let userId = existingUsers[0]?.id;

        if (userId) {
          await db
            .update(users)
            .set({
              username,
              email,
              avatarUrl,
              encryptedAccessToken: encrypted.ciphertext,
              accessTokenIv: encrypted.iv,
              accessTokenTag: encrypted.tag,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
        } else {
          const inserted = await db
            .insert(users)
            .values({
              githubId,
              username,
              email,
              avatarUrl,
              encryptedAccessToken: encrypted.ciphertext,
              accessTokenIv: encrypted.iv,
              accessTokenTag: encrypted.tag,
            })
            .returning({ id: users.id });

          userId = inserted[0]?.id;
        }

        token.userId = userId;
        token.username = username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.userId) {
          session.user.id = token.userId as string;
        }
        if (token.username) {
          session.user.username = token.username as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.AUTH_SECRET,
});
