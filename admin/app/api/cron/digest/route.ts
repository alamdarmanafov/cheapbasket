import { NextResponse } from 'next/server';
import { runDigest } from '@/lib/digest';
import { errText } from '@/lib/server';

export const maxDuration = 60;

/** Vercel Cron target (see vercel.json). Protected by CRON_SECRET, which Vercel sends as a Bearer token. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const r = await runDigest();
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
