import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { reviewComments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ToggleResolveSchema = z.object({
  isResolved: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { commentId } = await context.params;
    const body = await req.json();
    const parsed = ToggleResolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const [updated] = await db
      .update(reviewComments)
      .set({ isResolved: parsed.data.isResolved })
      .where(eq(reviewComments.id, commentId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json({ comment: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update comment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
