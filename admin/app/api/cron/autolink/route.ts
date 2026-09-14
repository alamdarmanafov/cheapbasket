import { NextResponse } from 'next/server';
import { autolinkNext } from '@/lib/autolink';
import { errText } from '@/lib/server';

export const maxDuration = 60;

/**
 * Vercel Cron, hourly: the batch matcher for one store per run, round-robin,
 * so every store with a feed gets a pass each day within the function's
 * time budget. The store it did is kept in app_settings.autolink.cursor.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await autolinkNext());
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
