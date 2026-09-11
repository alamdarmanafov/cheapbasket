import { gtinVariants } from './gtin';
import { adminDb, fetchAll } from './server';

export interface Identified { brand: string | null; name: string | null; size: string | null; barcode: string | null; query: string }
export interface Candidate { id: string; brand: string; name: string; size: string; score: number }

const norm = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9%.,\s]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length > 1);

/** Ask a vision model what product is in the photo (brand / name / size / any visible barcode digits). */
export async function identifyWithOpenAI(imageBase64: string): Promise<Identified> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY təyin edilməyib — şəkillə tanıma bağlıdır');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You identify grocery products from a photo taken in an Azerbaijani supermarket. Reply with JSON: {"brand": string|null, "name": string|null, "size": string|null, "barcode": string|null, "query": string}. "name" is the product type in Azerbaijani (e.g. "Süd 3.2%", "Yumurta", "Ayran"), "size" like "1 L", "500 q", "10 ədəd". "barcode" only if digits are clearly readable. "query" is a short search string combining brand and name. If unsure, still give your best guess.' },
        { role: 'user', content: [{ type: 'text', text: 'Bu hansı məhsuldur?' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = j.choices?.[0]?.message?.content ?? '{}';
  const m = raw.match(/\{[\s\S]*\}/);
  const p = (m ? JSON.parse(m[0]) : {}) as Partial<Identified>;
  const brand = p.brand?.toString().trim() || null;
  const name = p.name?.toString().trim() || null;
  return { brand, name, size: p.size?.toString().trim() || null, barcode: (p.barcode?.toString().replace(/\D/g, '') || null) as string | null, query: p.query?.toString().trim() || [brand, name].filter(Boolean).join(' ') };
}

/** Score the catalogue against the identification and return the best matches. */
export async function matchProducts(id: Identified, limit = 5): Promise<Candidate[]> {
  const db = adminDb();
  if (id.barcode && id.barcode.length >= 8) {
    const { data } = await db.from('products').select('id, brand, name, size').in('barcode', gtinVariants(id.barcode)).limit(1).maybeSingle();
    if (data) return [{ ...data, score: 100 }];
  }
  const data = await fetchAll<{ id: string; brand: string; name: string; size: string; category: string }>(
    (from, to) => db.from('products').select('id, brand, name, size, category').range(from, to)
  );
  const q = tokens(id.query);
  const brandT = id.brand ? tokens(id.brand) : [];
  const nameT = id.name ? tokens(id.name) : [];
  const sizeN = id.size ? norm(id.size).replace(/\s/g, '') : '';
  const out: Candidate[] = [];
  for (const p of data) {
    const full = `${p.brand} ${p.name} ${p.size} ${p.category ?? ''}`;
    const ft = new Set(tokens(full));
    let score = 0;
    for (const t of q) if (ft.has(t)) score += 2;
    for (const t of brandT) if (ft.has(t)) score += 4;
    for (const t of nameT) if (ft.has(t)) score += 3;
    if (sizeN && norm(p.size).replace(/\s/g, '') === sizeN) score += 2;
    // partial token matches (e.g. "sud" vs "südlü")
    for (const t of [...q, ...brandT, ...nameT]) if (t.length > 3 && [...ft].some((f) => f !== t && (f.startsWith(t) || t.startsWith(f)))) score += 1;
    if (score > 0) out.push({ id: p.id, brand: p.brand, name: p.name, size: p.size, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).filter((c, _, arr) => c.score >= Math.max(3, arr[0].score * 0.5));
}
