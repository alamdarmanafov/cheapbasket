import { NextResponse } from 'next/server';
import { adminDb, errText } from '@/lib/server';
import { userFromToken } from '@/lib/iap';

/** The app asks for its own subscription state (after restore or on launch). */
export async function GET(req: Request) {
  try {
    const userId = await userFromToken(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
    const { data } = await adminDb().from('profiles').select('plan, plan_expires_at, plan_source, plan_product_id').eq('user_id', userId).maybeSingle();
    return NextResponse.json(data ?? { plan: 'free' });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
