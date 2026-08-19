# Ultimate MTG — New Chat Handoff

_Last refreshed: 2026-08-20 NZST_

This file is the shortest recovery path for a fresh ChatGPT conversation. It is intentionally concise. For full history and engineering detail, read `PROJECT_HANDOFF.md` after this file, then `ULTIMATE_MTG_SPEC.md`.

## Start here in a new chat

Use this exact opening request:

> Continue the Ultimate MTG project in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. Read `NEW_CHAT_HANDOFF.md`, `PROJECT_HANDOFF.md`, `ULTIMATE_MTG_SPEC.md`, and `BASIC_FEATURES.md` first. Check `agent/package-probabilities`, PR #2, the exact current head, and CI before changing code. Continue from the next implementation target. Do not promote `server-current`, do not merge to `main`, and do not treat V0.15 as stable without my explicit approval.

A new chat should be able to start work immediately from that message without needing this old conversation.

---

## Current repository state

Repository:

- `vt7dfbmh7b-droid/mtg-ultimate-mcp`

Active development branch:

- `agent/package-probabilities`

Latest fully validated **implementation SHA**:

- `7c4996ce8cd74fc885c58d2d0f52aa36b750d2f8`

The active branch was fast-forwarded to that exact validated commit with `force=false` after the basic-feature cleanup passed all gates. Any later commit that only updates handoff documentation should not be confused with a new runtime implementation milestone.

Active validation PR:

- PR #2 — draft validation surface only
- base: `main`
- head: `agent/package-probabilities`
- **DO NOT MERGE** unless the user explicitly authorizes a release/promotion later.

Stable release boundary remains unchanged:

- package version: `0.13.0`
- `src/server-current.ts` remains V0.13
- V0.14/V0.15 remain experimental
- `main` remains untouched by the experimental development line.

---

## Exact validation for the current implementation

Final basic-feature cleanup head `7c4996ce8cd74fc885c58d2d0f52aa36b750d2f8` passed:

- deterministic CI run `32237201789`: **PASS**
- TopDeck Learning Source Live run `32237201769`: **PASS**
- Commander Live Control Suite run `32237201803`: **PASS**

These are the exact-head results that authorized the non-force fast-forward into `agent/package-probabilities`.

Do not substitute an older or intermediate CI result when validating future work.

---

## Basic-feature cleanup just completed

The cleanup audited everyday MTG functions before returning to ML/data work.

### Commander legality

Current Commander eligibility now correctly includes:

- legendary creatures;
- cards explicitly allowed to be commanders;
- legendary Vehicles or Spacecraft with printed power and toughness;
- valid paired Backgrounds and supported two-commander mechanics.

The current-rule fix is covered by adversarial tests, including face-local printed power/toughness.

### Historical rule safety

The 2025 Vehicle/Spacecraft commander-eligibility expansion is date-gated for historical evaluation. Current rules may not leak backward into older prediction cutoffs.

Older Vehicles/Spacecraft only count as historical commanders before that rule change when they independently had valid commander permission at the time.

### Shared command-zone validation

`assessCommanderConfiguration` is now the shared command-zone configuration check used by ordinary card-fit and card-intelligence paths.

A candidate card cannot be called legal for supplied commanders unless the supplied single commander or two-commander configuration is itself valid and Commander-legal.

### Preferred basic MCP surface

`BASIC_FEATURES.md` documents the preferred everyday tools while retaining older generations for backward compatibility.

`src/basic-feature-surface.test.ts` protects the preferred stable surface and ensures V0.15 experimental tools do not silently enter the stable runtime.

### Basic live smoke

The existing manual live smoke now includes a real Scryfall Spacecraft Commander control in addition to:

- source health;
- Scryfall card resolution;
- USD→NZD conversion;
- V0.13 NZD pricing;
- exact MTGJSON stock-precon reconstruction.

---

## Known basic-feature follow-ups — not current blockers

These are useful maintenance follow-ups but should not replace the main implementation target unless the user asks for them.

1. **Official per-card rulings feed**
   - `card_intelligence_v05` uses live Oracle data plus local rules heuristics.
   - `rulesAttention` is not an official Gatherer/Scryfall rulings feed and must not be described as official ruling text.

2. **Combo outage reporting consistency**
   - the core Commander Spellbook service already has evidence-safe wrappers that return explicit `sourceStatus: unavailable` on transient failures;
   - the oldest/basic `find_deck_combos` MCP entry still uses the raw path and returns an error on provider failure rather than the richer unavailable-evidence record;
   - it does **not** fabricate “no combos”, so this is a UX/truth-labeling consistency improvement rather than an urgent correctness failure.

3. **Legacy USD fields**
   - older compatibility tools retain historical USD-oriented output fields;
   - V0.13 `price_card_nzd_v13` remains the preferred NZ pricing path.

Do not delete historical tools merely to make the list shorter; compatibility is intentional.

---

## Real-data / ML state already completed

The experimental line already contains:

- universal V0.15 Commander build pipeline;
- exact BigInt hypergeometric/probability/statistics engine;
- strict historical/as-of provenance;
- leakage-safe real-corpus infrastructure;
- real-source lineage/independence policy;
- genuine-future holdout sealing;
- transparent-vs-neural future evaluation;
- TopDeck leakage linkage by event, pilot and exact deck fingerprint;
- strict TopDeck `deckObj` materialization;
- bounded privacy-safe TopDeck live-source validation.

TopDeck live acquisition has already demonstrated a real candidate pool of **4,395 strict exact Commander deck/outcome candidates across 173 events** from the bounded 30-day/16+ player audit recorded in `PROJECT_HANDOFF.md`.

Important: those are real outcome/deck candidates, **not automatically trustworthy historical training rows**.

Present-day Oracle/legal/card truth may not be backdated into historical predictor evidence.

ML remains shadow/advisory only and never overrides hard MTG truth.

---

## NEXT IMPLEMENTATION TARGET

### Provenance-safe historical predictor/card-data acquisition

This is the immediate engineering target after this handoff.

The new chat should:

1. verify the active branch and latest exact CI before starting;
2. create an isolated implementation branch from the current active implementation lineage;
3. inventory **primary or genuinely versioned/archive card-data sources** capable of proving historical Oracle/type/mana/printing/Commander-legality facts as of an event cutoff;
4. distinguish a present-day/current feed from an archive that was independently published/effective at the historical cutoff;
5. preserve source URI, source/version identity, effective/publication time and SHA-256 content hash;
6. never assign an old `availableAt` timestamp to data first observed today;
7. use the existing strict historical card-data provenance gate rather than weakening it;
8. if adequate retrospective archives do not exist, prefer a forward contemporaneous-capture pipeline;
9. resolve only printings that actually existed by the historical cutoff;
10. apply the dated historical Commander legality/construction validator;
11. materialize `ProvenancedDeckFeatureSnapshotV15` only after provenance passes;
12. join trusted predictor snapshots to real TopDeck outcomes through `topdeck-real-corpus-materializer-v15` and the existing leakage-group boundary;
13. report accepted/rejected/unavailable coverage honestly rather than manufacturing corpus scale.

Once trusted predictor snapshots exist, the following milestone is to materialize and audit the first real historical corpus before making any neural-model usefulness claim.

---

## Hard rules for all future work

Never weaken these to make a test or model look better:

- Commander legality and banned/current rules truth;
- exact 100-card construction and command-zone rules;
- singleton/color identity;
- unresolved-card failures;
- exact physical-printing existence;
- exact set/printing-family/finish constraints;
- must-include / must-exclude constraints;
- hard per-card budgets;
- verified combo requirements;
- source-outage distinction from verified absence;
- historical no-future-knowledge rule;
- leakage prevention before normalization/model fitting.

TopDeck API credentials are configured through the repository secret `TOPDECK_API_KEY`. Never reveal, print or persist the secret value.

---

## Validation discipline

For material implementation work:

1. branch/isolate first;
2. strict TypeScript/build;
3. complete deterministic suite;
4. dedicated live provider control when the external source is central;
5. Commander live regression for Commander/build changes;
6. inspect individual failing steps/logs rather than trusting only aggregate status;
7. distinguish provider outage/rate-limit/credential failure from code failure;
8. never weaken truth gates to make CI green;
9. fold only after exact-head validation;
10. use non-force fast-forward when possible;
11. validate the active lineage after fold when appropriate;
12. update the handoff checkpoint;
13. keep `main` and stable V0.13 untouched unless the user explicitly authorizes promotion.

---

## Files the new chat should read first

In order:

1. `NEW_CHAT_HANDOFF.md` — this fast checkpoint
2. `PROJECT_HANDOFF.md` — full validated history and next-target detail
3. `ULTIMATE_MTG_SPEC.md` — north-star product/engineering specification
4. `BASIC_FEATURES.md` — preferred everyday MCP surface and compatibility guidance

After reading them, check the live repository state rather than assuming this document is still the newest commit.