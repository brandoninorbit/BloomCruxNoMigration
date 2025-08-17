# BloomCrux – Copilot-Facing Guide

> **Purpose**: Give GitHub Copilot a compact, actionable spec so it generates code that *always* respects BloomCrux rules: Bloom levels, CSV/manual decks, mastery/XP, and psychology. This file integrates the **Context Checklist** decisions so features align with the intended user flow.

**Canonical sources**

- Full instruction doc: `docs/Bloomcrux Instructions.docx`
- Pedagogy blueprint: `docs/Bloom's Taxonomy Study Website Plan.docx`
- Context Checklist: `/CONTEXT_CHECKLIST.md`

---

## 1) Golden Rules (must-keep promises)

- **Progression**: Missions unlock in order: Remember → Understand → Apply → Analyze → Evaluate → Create. Default mission complete at **≥ 65%** (user can toggle threshold in mission settings). Bloom mastery however is 80% and above
- **Decks**: Start as empty. Users can add manually in UI or bulk import CSV. Example decks remain only for logged-out users via “Show Example.”
- **Card types are CSV-first**. Every card is CSV-authorable. When autograding isn’t viable, **SelfCheck=1** enables manual reflection.
- **Manual editing parity**: The deck editor must support add/edit/delete cards that update the *same schema* as CSV import.
- **XP model**:
  - Bloom XP = correctness% × base XP.
  - Commander XP = Bloom XP × multiplier (Remember ×1.0 → Create ×3.0).
- **Psychology**: Favor desirable difficulty, spaced repetition (SM-2 default), interleaving, metacognition.
- **Biology toggle**: Mini-options in deck creation/settings (not global). Unlocks Punnett, gels, phylo, molecule viewer **without** blocking other subjects.

---

## 2) Bloom Levels ↔ Default Card Types

(Same as before; override via `BloomLevel` column.)

---

## 3) CSV Schemas (minimum columns)

(Same schemas as before. Key note: CSV import UI must include **Instructions button** in top-right of parser, as per checklist.)

---

## 4) Missions & SRS

- **Quest**: One mission per Bloom level. Cards shuffled once. Completion defaults to ≥65% (toggleable).
- **Target Practice**: Uses SM-2 flags. Users can set their own threshold (default 65%) before mission via “Engage Target” popup.
- **Random Remix**: Pure randomness.
- **Level Up**: Focused practice on one Bloom level.
- **Timed Drill**: Awards a little extra XP; always shows a “mission debrief” popup before mission begins.

**Persistence**: All SRS + mission data synced to DB (no client-only state). If user logs out mid-mission, progress auto-saves after every card and resumes at the same card on re-login.

---

## 5) XP & Mastery

(Same math as before; dashboards show circle bars for Commander XP, straight bars for Bloom mastery.)

---

## 6) Shop & Tokens

- **Currency**: Tokens (earned via missions).
- **Earning**: Based on accuracy × Bloom multiplier.
- **Spending**: Cosmetic-first; rare prestige unlocks scale with Commander level. Early power-ups may offer effort-enhancing boosts (extra reviews, reflection prompts, XP boosts) but never shortcuts.
- **Economy**: Higher Commander level = more tokens earned *and* higher costs (keeps balance, prevents inflation).
- **UI**: Shop access is **only in study mission page** (not global nav).

---

## 7) Biology Toggle (refined)

- Appears in **deck creation/settings** only.
- Tools are optional mini-helpers (Punnett, gels, phylo, molecule viewer).
- Default mode is subject-neutral. Biology toggle never blocks non-bio learners.

---

## 8) UI/Routes Map

- **Pages**: About (default logged-out), Home (default logged-in), Dashboard, Decks, Edit Deck, Study (with in-mission shop button).
- **Navigation**: Through header. Decks → Study → Missions. Shop button appears in Study view on hover.
- **Design style**: Agent/ops theme (“Commander Level,” “Operation: [mission name]”).

---

## 9) Data & Storage

- **DB**: Supabase (all decks, users, SRS data per-user).
- **Media**: Supabase storage buckets (images, audio, CSVs).
- **Migration**: Just ensure schema evolves in Supabase; no external DB needed.

---

## 10) Copilot Prompts (copy-paste)

**CSV Import**

> Implement CSV import parser with schemas in §3. Must include Instructions button in top-right. Preserve unknown columns.

**Deck Editor**

> Add manual card add/edit/delete. Sync to Supabase per-user decks. Keep schema identical to CSV.

**Missions**

> Build study mission flow with save-after-each-card. Resume seamlessly after logout. Respect toggles: pass threshold, SRS target practice, timed drill XP boost.

**Shop**

> Implement token-based shop accessible only from study page. Cosmetics scale with Commander level; no shortcuts allowed.

**Biology Toggle**

> Add optional toggle in deck creation/settings to enable mini-tools (Punnett, gels, phylo, molecule viewer). Default is neutral.

---

## 11) Acceptance Criteria

- Decks and missions fully persisted in Supabase.
- Mid-mission logout restores session at same card.
- XP math + Commander multipliers exact per §5.
- Tokens economy cosmetic-first, scaling by Commander level.
- Shop access only from study page.
- Biology toggle only in deck settings, never global.
- Build passes clean (`npm run build`, `npx tsc --noEmit`).

