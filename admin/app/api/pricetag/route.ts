import { NextResponse } from 'next/server';
import { readPriceTag } from '@/lib/pricetag';
import { userFromToken } from '@/lib/iap';
import { adminDb, errText } from '@/lib/server';

export const maxDuration = 30;

const bakuDayStart = () => {
  const now = new Date(Date.now() + 4 * 3600 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
};

/**
 * POST { image } → { price, name, unit_price, barcode } read off a shelf tag.
 * The app fills the price-report sheet with it; the report itself still goes
 * through price_reports (0035), so nothing is written here. A daily ceiling
 * per person (app_settings 'pricetag' → free_per_day, default 20) keeps the
 * vision bill in bounds.
 */
export async function POST(req: Request) {
  try {
    const userId = await userFromToken(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Giriş tələb olunur', code: 'auth' }, { status: 401 });
    const db = adminDb();
    const { data: setting } = await db.from('app_settings').select('value').eq('key', 'pricetag').maybeSingle();
    const cfg = (setting?.value as { enabled?: boolean; free_per_day?: number } | null) ?? null;
    if (cfg?.enabled === false) return NextResponse.json({ error: 'Etiket oxuma hazırda bağlıdır', code: 'off' }, { status: 403 });
    const perDay = Number(cfg?.free_per_day ?? 20);
    const { count } = await db.from('ai_usage').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'pricetag').gte('created_at', bakuDayStart());
    if ((count ?? 0) >= perDay) return NextResponse.json({ error: `Gündə ${perDay} etiket. Sabah davam et.`, code: 'limit' }, { status: 429 });

    const { image } = (await req.json()) as { image?: string };
    if (!image) return NextResponse.json({ error: 'Şəkil yoxdur' }, { status: 400 });
    if (image.length > 4_000_000) return NextResponse.json({ error: 'Şəkil çox böyükdür' }, { status: 413 });

    await db.from('ai_usage').insert({ user_id: userId, kind: 'pricetag' });
    const read = await readPriceTag(image);
    if (read.price == null) return NextResponse.json({ ...read, error: 'Qiymət oxunmadı — etiketi yaxından, düz çək', code: 'unread' }, { status: 422 });
    return NextResponse.json({ ...read, remaining: perDay - (count ?? 0) - 1 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
