import { adminDb } from './server';

/**
 * Pays a user for a suggestion that just became a product, and tells them.
 *
 * The credit is a database function that refuses to pay the same barcode
 * twice, so approving, undoing and approving again — or a retried request —
 * costs nothing extra. The push is best effort: the celebration in the app
 * catches up on the next launch whether or not the phone was reachable now.
 */
export async function rewardSuggester(userId: string | null | undefined, barcode: string | null | undefined, productName: string): Promise<number> {
  if (!userId || !barcode) return 0;
  const db = adminDb();
  const { data, error } = await db.rpc('award_suggestion_points', { p_user: userId, p_barcode: barcode });
  if (error) throw error;
  const points = Number(data ?? 0);
  if (points <= 0) return 0;

  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', userId);
  const to = (tokens ?? []).map((t) => t.token as string).filter(Boolean);
  if (to.length) {
    const messages = to.map((token) => ({
      to: token,
      title: `Təklifin qəbul edildi 🎉 +${points} xal`,
      body: `"${productName}" bazaya əlavə olundu. Xallar hesabındadır.`,
      sound: 'default',
      channelId: 'price-drops',
      data: { url: '/referral' },
    }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    }).catch(() => undefined);
  }
  return points;
}
