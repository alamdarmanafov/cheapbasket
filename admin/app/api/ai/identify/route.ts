import { NextResponse } from 'next/server';
import { identifyWithOpenAI, matchProducts } from '@/lib/identify';
import { userFromToken } from '@/lib/iap';
import { adminDb, errText } from '@/lib/server';

export const maxDuration = 30;

/** Start of "today" in Baku (UTC+4) as ISO. */
const bakuDayStart = () => {
  const now = new Date(Date.now() + 4 * 3600 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
};

/**
 * POST { image: base64 jpeg } → { identified, candidates, remaining }
 * Photo identification is a Plus feature; Free users get `photo.free_per_day` (default 1) per day. Requires a signed-in user.
 */
export async function POST(req: Request) {
  try {
    const userId = await userFromToken(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Giriş tələb olunur', code: 'auth' }, { status: 401 });
    const db = adminDb();
    const [{ data: profile }, { data: setting }] = await Promise.all([
      db.from('profiles').select('plan, plan_expires_at').eq('user_id', userId).maybeSingle(),
      db.from('app_settings').select('value').eq('key', 'photo').maybeSingle(),
    ]);
    const plus = profile?.plan === 'plus' && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
    const freePerDay = Number((setting?.value as { free_per_day?: number } | null)?.free_per_day ?? 1);
    let remaining: number | null = null;
    if (!plus) {
      const { count } = await db.from('ai_usage').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'photo').gte('created_at', bakuDayStart());
      const used = count ?? 0;
      if (used >= freePerDay) return NextResponse.json({ error: `Pulsuz planda gündə ${freePerDay} foto. Limitsiz tanıma üçün Plus-a keç.`, code: 'limit', limit: freePerDay }, { status: 429 });
      remaining = freePerDay - used - 1;
    }

    const { image } = (await req.json()) as { image?: string };
    if (!image) return NextResponse.json({ error: 'Şəkil yoxdur' }, { status: 400 });
    if (image.length > 2_500_000) return NextResponse.json({ error: 'Şəkil çox böyükdür' }, { status: 413 });
    const identified = await identifyWithOpenAI(image.replace(/^data:image\/\w+;base64,/, ''));
    const candidates = await matchProducts(identified);
    await db.from('ai_usage').insert({ user_id: userId, kind: 'photo' });
    return NextResponse.json({ identified, candidates, remaining, plus });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
