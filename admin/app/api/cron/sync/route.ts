import { NextResponse } from 'next/server';
import { runSync } from '@/lib/sync';
import { errText } from '@/lib/server';

export const maxDuration = 60;

/** Vercel Cron: re-sync every saved Wolt source and push instant price-drop alerts. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await runSync());
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
