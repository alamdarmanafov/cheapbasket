export interface PriceTagRead { price: number | null; name: string | null; unit_price: number | null; barcode: string | null }

/**
 * Reads a shelf price tag: the selling price in manat, the product name as
 * printed, the unit price if the tag carries one, the barcode if legible.
 * Same vision model as the receipt reader; the prompt is narrow because a
 * price tag is one number and a lot of distraction (old price, per-kilo
 * price, loyalty price).
 */
export async function readPriceTag(imageBase64: string): Promise<PriceTagRead> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY təyin edilməyib — etiket oxuma bağlıdır');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You read supermarket shelf price tags from Azerbaijan. Reply with JSON: {"price": number|null, "name": string|null, "unit_price": number|null, "barcode": string|null}. "price" is the current selling price in AZN for one piece or pack — the largest, most prominent number; if a crossed-out old price is shown, ignore it; if a loyalty-card price and a regular price are shown, take the regular one. "unit_price" is the per-kg/per-litre price if printed separately. "name" is the product name as printed. "barcode" is the EAN digits if legible. Null for anything unreadable.',
        },
        { role: 'user', content: [{ type: 'text', text: 'Bu qiymət etiketini oxu.' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = j.choices?.[0]?.message?.content ?? '{}';
  const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { price?: unknown; name?: unknown; unit_price?: unknown; barcode?: unknown };
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 10000 ? Math.round(n * 100) / 100 : null;
  };
  const barcode = String(p.barcode ?? '').replace(/\D/g, '');
  return {
    price: num(p.price),
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 120) : null,
    unit_price: num(p.unit_price),
    barcode: barcode.length >= 8 && barcode.length <= 14 ? barcode : null,
  };
}
