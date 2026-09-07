import { NextResponse } from 'next/server';
import { notifyRecentDrops } from '@/lib/alerts';
import { errText, requireAdmin } from '@/lib/server';

export const maxDuration = 30;

/** Admin UI calls this right after saving prices: pushes "your basket item got cheaper" for drops since `since`. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { since, dryRun } = (await req.json()) as { since?: string; dryRun?: boolean };
    return NextResponse.json(await notifyRecentDrops(since ?? new Date(Date.now() - 10 * 60000).toISOString(), { dryRun }));
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
