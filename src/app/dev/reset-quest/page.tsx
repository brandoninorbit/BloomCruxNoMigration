"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export const dynamic = "force-dynamic";

export default function ResetQuestDevPage() {
  return (
    <Suspense fallback={<main className="container mx-auto p-6">Loading…</main>}>
      <ResetQuestInner />
    </Suspense>
  );
}

function ResetQuestInner() {
  const params = useParams() as { deckId?: string } | null;
  const sp = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const deckIdParam = params?.deckId ?? sp?.get("deckId") ?? "";
  const [deckId, setDeckId] = useState<string>(deckIdParam);
  const [wipeXp, setWipeXp] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");

  async function reset() {
    setBusy(true);
    setMsg("");
    const id = Number(deckId);
    if (!Number.isFinite(id)) {
      setMsg("Enter a valid deckId.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/quest/${id}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wipeXp }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setMsg(`Reset ok. Missions/SRS/Progress cleared${wipeXp ? " and XP events wiped" : ""}.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Dev • Reset Quest</h1>
      <div className="space-y-3 max-w-md">
        <label className="block">
          <span className="text-sm text-slate-600">Deck ID</span>
          <input value={deckId} onChange={(e) => setDeckId(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="123" />
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={wipeXp} onChange={(e) => setWipeXp(e.target.checked)} />
          <span>Also wipe XP events</span>
        </label>
        <div className="flex gap-2">
          <button onClick={reset} disabled={busy} className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50">{busy ? "Resetting…" : "Reset"}</button>
          <button onClick={() => router.back()} className="px-4 py-2 rounded border">Back</button>
        </div>
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </div>
    </main>
  );
}
