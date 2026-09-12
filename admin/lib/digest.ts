import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from './server';
import { copy, langOf, type Lang } from './pushCopy';
import { PUSH_CHANNEL, PUSH_SOUND } from '@/lib/push';

export interface Drop { product_id: string; store_id: string; new_price: number; old_price: number; drop_amount: number; drop_percent: number; changed_at: string; name: string; brand: string; size: string; emoji: string | null; store_name: string }
export interface DigestSettings { enabled: boolean; free_days: number[]; hour_baku: number; max_items: number; lookback_free_days: number; /** write the text with AI (costs tokens per user); off = free template */ use_ai: boolean; /** only Plus subscribers receive the digest */ plus_only: boolean }

const DEFAULTS: DigestSettings = { enabled: true, free_days: [1, 11, 21], hour_baku: 9, max_items: 5, lookback_free_days: 10, use_ai: false, plus_only: true };

export async function getSettings(): Promise<DigestSettings> {
  const { data } = await adminDb().from('app_settings').select('value').eq('key', 'digest').maybeSingle();
  return { ...DEFAULTS, ...((data?.value as Partial<DigestSettings>) ?? {}) };
}

const isPlus = (p: { plan?: string | null; plan_expires_at?: string | null }) => p.plan === 'plus' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date());

/** Which users are due today: Plus daily, Free on the configured days of month (Baku time). */
export function isDue(plus: boolean, settings: DigestSettings, now = new Date()): boolean {
  if (plus) return true;
  const bakuDay = new Date(now.getTime() + 4 * 3600000).getUTCDate();
  return settings.free_days.includes(bakuDay);
}

const SYSTEM =
  'Sən "Cheap Market AI" alış-veriş tətbiqinin bildiriş redaktorusan. Azərbaycan dilində, səmimi, qısa push bildirişi yaz. Yalnız JSON qaytar: {"title": "...", "body": "..."}. title ≤ 40 simvol, body ≤ 160 simvol, ən vacib 2-3 endirimi konkret qiymətlə qeyd et, sonda çağırış (məs. "Tətbiqdə bax"). Emoji az.';

const parseJson = (text: string, fallback: { title: string; body: string }) => {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return fallback;
  try {
    const j = JSON.parse(m[0]) as { title?: string; body?: string };
    return { title: (j.title || fallback.title).slice(0, 60), body: (j.body || fallback.body).slice(0, 200) };
  } catch {
    return fallback;
  }
};

/** OpenAI Chat Completions (used when OPENAI_API_KEY is set). */
async function composeWithOpenAI(user: string, fallback: { title: string; body: string }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.7, max_tokens: 300, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
  });
  if (!res.ok) return fallback;
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseJson(j.choices?.[0]?.message?.content ?? '', fallback);
}

/** Which AI writes the text: 'openai' | 'claude' | 'template'. */
export const aiProvider = () => (process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'claude' : 'template');

/** Write the message with the configured AI provider; a plain template otherwise. */
export async function composeMessage(drops: Drop[], plus: boolean, personal: boolean, useAi = false, lang: Lang = 'az'): Promise<{ title: string; body: string }> {
  const c = copy(lang);
  const lines = drops.map((d) => `${d.emoji ?? ''} ${c.line(`${d.brand} ${d.name} ${d.size}`.trim(), d.store_name, d.old_price.toFixed(2), d.new_price.toFixed(2))} (−${d.drop_percent}%)`);
  const fallback = {
    title: personal ? c.digestPersonal(drops.length) : c.digestGeneral(drops.length),
    body: lines.slice(0, 3).join('\n') + (drops.length > 3 ? `\n${c.more(drops.length - 3)}` : ''),
  };
  const user = `Bildirişi ${c.aiLang} yaz. ${plus ? 'Plus istifadəçi (gündəlik xəbər)' : 'Free istifadəçi (aylıq xəbər)'}${personal ? ', səbətindəki məhsullar' : ', ümumi endirimlər'}:\n${lines.join('\n')}`;
  const provider = useAi ? aiProvider() : 'template';
  if (provider === 'template') return fallback;
  try {
    if (provider === 'openai') return await composeWithOpenAI(user, fallback);
    const client = new Anthropic();
    const res = await client.messages.create({ model: 'claude-opus-5', max_tokens: 400, output_config: { effort: 'low' }, system: SYSTEM, messages: [{ role: 'user', content: user }] });
    return parseJson(res.content.map((b) => (b.type === 'text' ? b.text : '')).join(''), fallback);
  } catch {
    return fallback;
  }
}

async function expoSend(messages: Array<{ to: string; title: string; body: string; data?: unknown }>) {
  let sent = 0;
  let errors = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({ ...m, sound: PUSH_SOUND, channelId: PUSH_CHANNEL }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
    const j = (await res.json()) as { data?: Array<{ status: string }> };
    for (const t of j.data ?? []) t.status === 'ok' ? sent++ : errors++;
  }
  return { sent, errors };
}

/**
 * Runs the digest for every due user. `force` ignores the schedule (manual test),
 * `dryRun` composes but does not send.
 */
export async function runDigest(opts: { force?: boolean; dryRun?: boolean; onlyUserId?: string } = {}) {
  const db = adminDb();
  const settings = await getSettings();
  if (!settings.enabled && !opts.force) return { skipped: 'disabled', sent: 0, users: 0, errors: 0, preview: [] as Array<{ user_id: string; title: string; body: string }> };

  const { data: tokens } = await db.from('push_tokens').select('user_id, token');
  const byUser = new Map<string, string[]>();
  for (const t of tokens ?? []) if (t.user_id) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);
  const userIds = Array.from(byUser.keys()).filter((id) => !opts.onlyUserId || id === opts.onlyUserId);
  if (!userIds.length) return { sent: 0, users: 0, errors: 0, preview: [] };

  const [{ data: profiles }, { data: drops }, { data: baskets }, { data: sentToday }] = await Promise.all([
    db.from('profiles').select('user_id, plan, plan_expires_at, digest_enabled, blocked, lang').in('user_id', userIds),
    db.from('price_drops').select('*').order('drop_percent', { ascending: false }).limit(200),
    db.from('baskets').select('id, user_id, basket_items(product_id)').in('user_id', userIds),
    db.from('digest_log').select('user_id').gte('sent_at', new Date(Date.now() - 20 * 3600000).toISOString()),
  ]);
  const allDrops = (drops ?? []) as Drop[];
  const doneToday = new Set((sentToday ?? []).map((r) => r.user_id));
  const basketItems = new Map<string, Set<string>>();
  for (const b of baskets ?? []) basketItems.set(b.user_id, new Set(((b as { basket_items?: Array<{ product_id: string }> }).basket_items ?? []).map((i) => i.product_id)));

  const messages: Array<{ to: string; title: string; body: string; data: unknown }> = [];
  const preview: Array<{ user_id: string; title: string; body: string }> = [];
  const logs: Array<{ user_id: string; title: string; body: string }> = [];

  for (const uid of userIds) {
    const p = (profiles ?? []).find((x) => x.user_id === uid) ?? {};
    if ((p as { blocked?: boolean }).blocked || (p as { digest_enabled?: boolean }).digest_enabled === false) continue;
    const plus = isPlus(p as { plan?: string; plan_expires_at?: string });
    if (settings.plus_only && !plus) continue;
    if (!opts.force && (!isDue(plus, settings) || doneToday.has(uid))) continue;

    const lookbackMs = (plus ? 1 : settings.lookback_free_days) * 86400000;
    const recent = allDrops.filter((d) => Date.now() - new Date(d.changed_at).getTime() < lookbackMs);
    const mine = basketItems.get(uid);
    const personal = mine ? recent.filter((d) => mine.has(d.product_id)) : [];
    const pick = (personal.length ? [...personal, ...recent.filter((d) => !mine?.has(d.product_id))] : recent).slice(0, settings.max_items);
    if (!pick.length) continue;

    const msg = await composeMessage(pick, plus, personal.length > 0, settings.use_ai, langOf(p as { lang?: string | null }));
    const url = pick.length === 1 ? `/product/${pick[0].product_id}` : '/deals';
    preview.push({ user_id: uid, ...msg });
    logs.push({ user_id: uid, ...msg });
    for (const to of byUser.get(uid) ?? []) messages.push({ to, ...msg, data: { url } });
  }

  if (opts.dryRun) return { sent: 0, users: preview.length, errors: 0, preview };
  const { sent, errors } = messages.length ? await expoSend(messages) : { sent: 0, errors: 0 };
  if (logs.length) await db.from('digest_log').insert(logs);
  return { sent, users: preview.length, errors, preview };
}
