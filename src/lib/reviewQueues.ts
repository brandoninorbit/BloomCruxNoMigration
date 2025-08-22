import type { CardMastery } from "@/types/mastery";

// Infer a topic key from the CardMastery blob if available; falls back to a default bucket.
function topicKey(c: CardMastery): string {
  const rec = c as unknown as Record<string, unknown>;
  const t = rec["topic"]; // preferred key if present
  if (typeof t === "string" && t.length > 0) return t;
  const concept = rec["concept"];
  if (typeof concept === "string" && concept.length > 0) return concept;
  const type = rec["cardType"];
  if (typeof type === "string" && type.length > 0) return type;
  return "__default";
}

// Round-robin interleave across topic buckets while preserving per-bucket order
function interleaveByTopic(xs: CardMastery[]): CardMastery[] {
  if (xs.length <= 1) return xs;
  const buckets = new Map<string, CardMastery[]>();
  for (const c of xs) {
    const k = topicKey(c);
    const arr = buckets.get(k);
    if (arr) arr.push(c); else buckets.set(k, [c]);
  }
  if (buckets.size <= 1) return xs;
  const keys = Array.from(buckets.keys());
  const iters = keys.map((k) => ({ k, idx: 0, arr: buckets.get(k)! }));
  const out: CardMastery[] = [];
  let active = iters.length;
  let cursor = 0;
  while (active > 0) {
    const it = iters[cursor];
    if (it.idx < it.arr.length) {
      out.push(it.arr[it.idx]);
      it.idx += 1;
      if (it.idx === it.arr.length) active -= 1;
    }
    cursor = (cursor + 1) % iters.length;
  }
  return out;
}

export function dueSRSQueue(all: CardMastery[], nowIso = new Date().toISOString()): CardMastery[] {
  const due = all
    .filter((c) => c.srs.nextDueIso <= nowIso)
    .sort((a, b) => Date.parse(a.srs.nextDueIso) - Date.parse(b.srs.nextDueIso));
  return interleaveByTopic(due);
}

export function struggleQueue(all: CardMastery[]): CardMastery[] {
  // prioritize low Mi, then low Ri; interleave across topics for desirable difficulty
  const weak = all
    .filter((c) => c.Mi < 0.60 || c.Ri < 0.5)
    .sort((a, b) => (a.Mi - b.Mi) || (a.Ri - b.Ri));
  return interleaveByTopic(weak);
}
