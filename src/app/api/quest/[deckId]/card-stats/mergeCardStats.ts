// Extracted helper for merging per-card stats + mission answers
export function mergeCardStats(
  statsRows: Array<{ card_id: number; attempts: number; correct: number; streak: number; ease: number; interval_days: number; due_at: string | null }>,
  answersRows: Array<{ card_id: number; correct_fraction: number | null; answered_at: string | null }>
) {
  function mapBase(r: { card_id: number; attempts: number; correct: number; streak: number; ease: number; interval_days: number; due_at: string | null }) {
    return {
      cardId: Number(r.card_id),
      attempts: Number(r.attempts ?? 0),
      correct: Number(r.correct ?? 0),
      streak: Number(r.streak ?? 0),
      ease: typeof r.ease === 'number' ? r.ease : 2.5,
      intervalDays: Number(r.interval_days ?? 0),
      dueAt: r.due_at ?? null,
      bestCorrectness: 0,
      avgCorrectness: 0,
      lastAnsweredAt: null as string | null,
    };
  }
  const stats = new Map<number, ReturnType<typeof mapBase>>();
  for (const r of statsRows) stats.set(Number(r.card_id), mapBase(r));
  const aggMap = new Map<number, { best: number; sum: number; count: number; last: string | null }>();
  for (const row of answersRows) {
    const cid = Number(row.card_id);
    const val = typeof row.correct_fraction === 'number' ? row.correct_fraction : 0;
    const bucket = aggMap.get(cid) || { best: 0, sum: 0, count: 0, last: null };
    if (val > bucket.best) bucket.best = val;
    bucket.sum += val;
    bucket.count += 1;
    if (!bucket.last || (row.answered_at && new Date(row.answered_at) > new Date(bucket.last))) {
      bucket.last = row.answered_at;
    }
    aggMap.set(cid, bucket);
  }
  for (const [cid, data] of aggMap.entries()) {
    const base = stats.get(cid) || mapBase({ card_id: cid, attempts: 0, correct: 0, streak: 0, ease: 2.5, interval_days: 0, due_at: null });
    base.bestCorrectness = data.best;
    base.avgCorrectness = data.count > 0 ? data.sum / data.count : 0;
    base.lastAnsweredAt = data.last;
    stats.set(cid, base);
  }
  return Array.from(stats.values()).sort((a, b) => a.cardId - b.cardId);
}
