import { NextResponse } from 'next/server';
import { identifyWithOpenAI, matchProducts } from '@/lib/identify';
import { errText } from '@/lib/server';

export const maxDuration = 30;

/** POST { image: base64 jpeg } → { identified, candidates } — used by the app's "Məhsulun şəklini çək". */
export async function POST(req: Request) {
  try {
    const { image } = (await req.json()) as { image?: string };
    if (!image) return NextResponse.json({ error: 'Şəkil yoxdur' }, { status: 400 });
    if (image.length > 2_500_000) return NextResponse.json({ error: 'Şəkil çox böyükdür' }, { status: 413 });
    const identified = await identifyWithOpenAI(image.replace(/^data:image\/\w+;base64,/, ''));
    const candidates = await matchProducts(identified);
    return NextResponse.json({ identified, candidates });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
