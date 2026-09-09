/** Resolve a Google Maps link (long or short) or a free-text address into coordinates. No API key needed. */
export interface Resolved {
  lat: number; lng: number; name?: string; address?: string;
  source: 'link' | 'geocode';
  open_from: string | null;
  open_until: string | null;
}

const UA = 'CheapMarketAdmin/1.0 (+https://cheapmarket.app)';
const HTML_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';

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

/** Follow redirects AND read the HTML body (for short links and full Google Maps URLs). */
async function expandAndReadHtml(url: string): Promise<{ finalUrl: string; html: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': HTML_UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.5' },
    });
    const html = await res.text().catch(() => '');
    return { finalUrl: res.url || url, html };
  } catch {
    return { finalUrl: url, html: '' };
  }
}

/** Extract opening hours from a Google Maps HTML page body. Returns null values if not found. */
function parseHoursFromHtml(html: string): { open_from: string | null; open_until: string | null } {
  if (!html) return { open_from: null, open_until: null };

  // 1. Try JSON-LD <script> blocks (most reliable)
  const ldBlocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, src] of ldBlocks) {
    try {
      const data: unknown = JSON.parse(src);
      const schemas = Array.isArray(data) ? data : [data];
      for (const schema of schemas) {
        if (!schema || typeof schema !== 'object') continue;
        const oh = (schema as Record<string, unknown>).openingHours;
        if (!oh) continue;
        const spec = Array.isArray(oh) ? oh[0] : oh;
        if (typeof spec === 'string') {
          const m = spec.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
          if (m) return { open_from: m[1], open_until: m[2] };
        }
      }
    } catch { /* continue */ }
  }

  // 2. Look for quoted time pairs: "08:00","22:00" in JSON blobs (APP_INITIALIZATION_STATE etc.)
  const pairRe = /"(\d{2}:\d{2})","(\d{2}:\d{2})"/g;
  const pairs: Array<[string, string]> = [];
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(html)) !== null) {
    const [, from, until] = m;
    if (from < until) pairs.push([from, until]);
  }
  if (pairs.length) {
    const freq = new Map<string, number>();
    for (const [f, u] of pairs) {
      const k = `${f}|${u}`;
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    const [best] = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const [f, u] = best[0].split('|');
    return { open_from: f, open_until: u };
  }

  return { open_from: null, open_until: null };
}

export async function resolvePlace(input: string): Promise<Resolved> {
  const text = input.trim();
  if (!text) throw new Error('Link və ya ünvan boşdur');

  if (/^https?:\/\//i.test(text)) {
    const isGmaps = /google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(text);
    const isShortLink = /goo\.gl|maps\.app/i.test(text);

    let finalUrl = text;
    let html = '';

    if (isGmaps || isShortLink) {
      ({ finalUrl, html } = await expandAndReadHtml(text));
    }

    const hit = fromUrl(finalUrl);
    const hours = /google\.com\/maps/i.test(finalUrl)
      ? parseHoursFromHtml(html)
      : { open_from: null, open_until: null };

    if (hit) return { ...hit, source: 'link', ...hours };

    // A "search?api=1&query=<text>" link carries a place *name*, not coordinates —
    // the form Google's own share sheet and most spreadsheet exports produce. Geocode
    // that text rather than giving up on the row.
    const named = decodeURIComponent(finalUrl).match(/[?&]query=([^&]+)/)?.[1] ?? decodeURIComponent(text).match(/[?&]query=([^&]+)/)?.[1];
    const term = named && !/^-?\d/.test(named) ? named.replace(/\+/g, ' ').trim() : '';
    if (term) return { ...(await geocode(term)), ...hours };

    throw new Error('Linkdə koordinat tapılmadı. Google Maps-də yerin səhifəsini açıb "Paylaş → Linki kopyala" ilə götür.');
  }

  const direct = fromUrl(text);
  if (direct) return { ...direct, source: 'link', open_from: null, open_until: null };

  return { ...(await geocode(text)), open_from: null, open_until: null };
}

/** Free-text address or place name → OpenStreetMap Nominatim (fair use: admin-only, low volume). */
async function geocode(text: string): Promise<Resolved> {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=az&accept-language=az&q=${encodeURIComponent(text)}`;
  const res = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Geokodlama xətası (${res.status})`);
  const j = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; name?: string }>;
  if (!j.length) throw new Error('Ünvan tapılmadı. Daha dəqiq yaz (küçə, rayon, Bakı) və ya Google Maps linkini yapışdır.');
  return { lat: Number(j[0].lat), lng: Number(j[0].lon), name: j[0].name, address: j[0].display_name, source: 'geocode', open_from: null, open_until: null };
}
