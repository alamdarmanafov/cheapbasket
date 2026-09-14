import { NextResponse } from 'next/server';
import { notifyRequests } from '@/lib/requests';
import { errText } from '@/lib/server';

export const maxDuration = 60;

/** Vercel Cron, hourly: open price requests go out to that store's shoppers. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await notifyRequests());
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
