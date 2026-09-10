import { NextResponse } from 'next/server';
import { notifyRecentDrops } from '@/lib/alerts';
import { errText } from '@/lib/server';

export const maxDuration = 60;

/**
 * Vercel Cron: hourly sweep for price drops nobody has been told about.
 *
 * `runSync` already alerts on the drops it causes, but that only covers prices
 * that arrive through a Wolt source. A price corrected by hand in the admin
 * panel lands in `price_history` exactly the same way and used to notify nobody
 * at all — the whole "your basket got cheaper" feature was silent for every
 * store we do not scrape. This picks those up. `price_alert_log` dedupes for 24
 * hours, so a drop the sync run has already sent is not sent twice.
 *
 * The window is a little over an hour so a run that starts late does not leave a
 * gap between sweeps.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await notifyRecentDrops(new Date(Date.now() - 70 * 60000).toISOString()));
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
