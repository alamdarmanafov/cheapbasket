/**
 * AI-powered product matching using OpenAI.
 * Used ONLY as the 5th fallback after:
 *   1. Barcode match
 *   2. Exact normalized name
 *   3. Brand + quantity + unit
 *   4. Existing DB match
 * This keeps AI costs minimal.
 */

export interface MatchCandidate {
  id: string;
  name: string;
  brand: string;
  size: string;
  barcode: string | null;
}

export interface MatchResult {
  product_id: string | null;
  confidence: number;       // 0–100
  status: 'matched' | 'review' | 'rejected';
  reason: string;
}

const THRESHOLDS = { auto: 95, review: 80 };

function statusFromConf(confidence: number): MatchResult['status'] {
  if (confidence >= THRESHOLDS.auto) return 'matched';
  if (confidence >= THRESHOLDS.review) return 'review';
  return 'rejected';
}

/** Call OpenAI to find the best match among candidates for a query item. */
export async function aiMatch(
  query: { name: string; barcode: string | null },
  candidates: MatchCandidate[],
): Promise<MatchResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { product_id: null, confidence: 0, status: 'rejected', reason: 'No OPENAI_API_KEY' };
  if (!candidates.length) return { product_id: null, confidence: 0, status: 'rejected', reason: 'No candidates' };

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const candidateList = candidates
    .slice(0, 20) // limit to top 20 to keep prompt small
    .map((c, i) => `${i + 1}. id="${c.id}" name="${c.name}" brand="${c.brand}" size="${c.size}" barcode="${c.barcode ?? ''}"`)
    .join('\n');

  const systemPrompt = `You are a product matching AI for an Azerbaijani grocery price comparison app.
Your task: decide if any candidate product is the SAME physical product as the query item.
Rules:
- Different sizes/quantities (1L vs 2L, 1kg vs 3kg) = DIFFERENT products
- Different variants (Regular vs Zero, Color vs Original) = DIFFERENT products
- Same product sold under slightly different names/transliterations = SAME product
- Return ONLY valid JSON matching the schema below, no explanation.`;

  const userPrompt = `Query item: name="${query.name}" barcode="${query.barcode ?? ''}"

Candidates:
${candidateList}

Respond with JSON:
{
  "match_index": <1-based index of best candidate, or 0 if no match>,
  "confidence": <0-100 integer>,
  "reason": "<one sentence>"
}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const j = await res.json() as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(j.choices[0].message.content) as { match_index: number; confidence: number; reason: string };

    if (!parsed.match_index || parsed.match_index < 1 || parsed.match_index > candidates.length) {
      return { product_id: null, confidence: parsed.confidence ?? 0, status: 'rejected', reason: parsed.reason ?? 'No match' };
    }
    const matched = candidates[parsed.match_index - 1];
    const confidence = Math.min(100, Math.max(0, parsed.confidence ?? 0));
    return { product_id: matched.id, confidence, status: statusFromConf(confidence), reason: parsed.reason ?? '' };
  } catch (e) {
    return { product_id: null, confidence: 0, status: 'rejected', reason: (e as Error).message };
  }
}

/** Log AI match decision to `ai_logs` table. */
export async function logAiMatch(
  db: ReturnType<typeof import('../server').adminDb>,
  query: { name: string; barcode: string | null },
  result: MatchResult,
): Promise<void> {
  try {
    await db.from('ai_logs').insert({
      query_name: query.name,
      query_barcode: query.barcode,
      matched_product_id: result.product_id,
      confidence: result.confidence,
      status: result.status,
      reason: result.reason,
      created_at: new Date().toISOString(),
    });
  } catch { /* best-effort logging */ }
}
