/** Resolve a Google Maps link (long or short) or a free-text address into coordinates. No API key needed. */
export interface Resolved { lat: number; lng: number; name?: string; address?: string; source: 'link' | 'geocode' }

const UA = 'CheapBasketAdmin/1.0 (+https://cheapbasket.vercel.app)';

function fromUrl(url: string): { lat: number; lng: number; name?: string } | null {
  const dec = decodeURIComponent(url);
  const name = dec.match(/\/maps\/place\/([^/@]+)/)?.[1]?.replace(/\+/g, ' ');
  // !3d40.40!4d49.86 → exact pin of the place
  const pin = dec.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) return { lat: Number(pin[1]), lng: Number(pin[2]), name };
  // /@40.40,49.86,17z → viewport centre
  const at = dec.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]), name };
  // ?q=40.40,49.86 | ?ll= | ?query= | ?destination=
  const q = dec.match(/[?&](?:q|ll|query|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]), name };
  // plain "40.40, 49.86"
  const plain = dec.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (plain) return { lat: Number(plain[1]), lng: Number(plain[2]) };
  return null;
}

/** Follow redirects of short links (maps.app.goo.gl, goo.gl/maps) to the long URL. */
async function expand(url: string): Promise<string> {
  if (!/goo\.gl|maps\.app/.test(url)) return url;
  const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA } });
  return res.url || url;
}

export async function resolvePlace(input: string): Promise<Resolved> {
  const text = input.trim();
  if (!text) throw new Error('Link və ya ünvan boşdur');
  if (/^https?:\/\//i.test(text)) {
    const long = await expand(text);
    const hit = fromUrl(long);
    if (hit) return { ...hit, source: 'link' };
    throw new Error('Linkdə koordinat tapılmadı. Google Maps-də yerin səhifəsini açıb "Paylaş → Linki kopyala" ilə götür.');
  }
  const direct = fromUrl(text);
  if (direct) return { ...direct, source: 'link' };
  // Free-text address → OpenStreetMap Nominatim (fair use: admin-only, low volume)
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=az&accept-language=az&q=${encodeURIComponent(text)}`;
  const res = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Geokodlama xətası (${res.status})`);
  const j = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; name?: string }>;
  if (!j.length) throw new Error('Ünvan tapılmadı. Daha dəqiq yaz (küçə, rayon, Bakı) və ya Google Maps linkini yapışdır.');
  return { lat: Number(j[0].lat), lng: Number(j[0].lon), name: j[0].name, address: j[0].display_name, source: 'geocode' };
}
