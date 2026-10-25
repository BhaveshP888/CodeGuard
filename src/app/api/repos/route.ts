import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { repositories } from '@/lib/db/schema';
import { getUserOctokit } from '@/lib/github/octokit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const octokit = await getUserOctokit(session.user.id);

    // Fetch user repositories from GitHub
    const { data: githubRepos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
      affiliation: 'owner,collaborator,organization_member',
    });

    // Fetch already connected repositories in DB
    const connectedRepos = await db
      .select()
      .from(repositories)
      .where(eq(repositories.userId, session.user.id));

    const connectedMap = new Map(connectedRepos.map((r) => [r.githubRepoId, r]));

    const result = githubRepos.map((repo) => {
      const connected = connectedMap.get(repo.id);
      return {
        id: repo.id,
        dbId: connected?.id || null,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url,
        description: repo.description,
        isConnected: Boolean(connected),
        isIndexed: connected?.isIndexed ?? false,
        indexingStatus: connected?.indexingStatus ?? 'idle',
        lastIndexedAt: connected?.lastIndexedAt ?? null,
      };
    });

    return NextResponse.json({ repositories: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch repositories';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const ConnectRepoSchema = z.object({
  githubRepoId: z.number().int(),
  fullName: z.string().min(1),
  defaultBranch: z.string().default('main'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = ConnectRepoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { githubRepoId, fullName, defaultBranch } = parsed.data;

    // Check if repo already connected
    const existing = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.userId, session.user.id),
          eq(repositories.githubRepoId, githubRepoId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({ repository: existing[0] });
    }

    const [created] = await db
      .insert(repositories)
      .values({
        userId: session.user.id,
        githubRepoId,
        fullName,
        defaultBranch,
        indexingStatus: 'idle',
        isIndexed: false,
      })
      .returning();

    return NextResponse.json({ repository: created }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to connect repository';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
