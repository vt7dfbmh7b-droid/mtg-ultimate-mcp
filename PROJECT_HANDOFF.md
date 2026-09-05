<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project Handoff

This is the short compatibility handoff. **`project-state.json` is the authoritative current-state source.**

## Resume in under five minutes

1. Read `project-state.json` and `docs/PROJECT-STATE.md`.
2. Read `validation-index.json` and `docs/VALIDATION-STATE.md` to identify current versus stale registered evidence.
3. Inspect live head of `agent/v15-native-deck-intelligence` and PR #29.
4. Read `ULTIMATE_MTG_SPEC.md`, then only the decision/failure/validation docs relevant to the active milestone.
5. Continue from the Next actions below. Do not reconstruct old chats unless state integrity fails.

## Current mode

- Active milestone: **BENCH-01 — Adversarial Commander benchmark suite**
- Intelligence development paused: **no**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`
- Active branch validation: **bench01-active-from-5829-exact-source-replay-positive-family-green-marvel-ceiling-explicit-provider-unknown-nonblocking-no-promotion**

## Audit reuse rule

The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and reusable. Do not rerun it without a material trigger. BENCH-01 is active from frozen source 5829b37...; preserve expected Marvel ceiling behaviour as red target evidence, keep provider-unknown separate from failure, freeze source within benchmark batches, and only make generic Commander-intelligence changes after multiple unseen fixtures expose a repeated weakness. No promotion without explicit approval.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence and BENCH-01 work on PR #29 remain experimental until benchmark evidence justifies a new accepted checkpoint.

## Important pending validation

The last persisted Marvel control is `5829b37b686255ba35d419b37be17095e54fb696` with outcome **expected-ceiling-fail-closed-zero-swap**. At exact source 5829b37..., focused and broad Marvel both execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Use source 5829b37b686255ba35d419b37be17095e54fb696 as the frozen starting source for BENCH-01 Batch A; do not modify Commander intelligence between fixtures in that batch.
3. Run the two first contrasting BENCH-01 fixtures: Counter Blitz as an FF-only Bant counters/proliferate deck with dense countermagic and hybrid combat/combo identity, and Liliana, Heretical Healer // Liliana, Defiant Necromancer under a NZ$500 whole-deck budget as the aristocrats/graveyard benchmark.
4. For each fixture, score legality and exact constraints first, then target-gate movement, whole-deck strategy preservation, win-route correctness/resilience, cut quality, mana/interaction/resource structure, budget/printing truth and complete 100-card manual quality.
5. Compare each complete benchmark result against a strong general-purpose-AI build under the same commander, budget, printing and theme restrictions; record concrete wins, losses and ambiguous trade-offs rather than relying on aggregate internal scores alone.
6. After the first frozen batch, expand unseen fixtures across combat, control, typal, aristocrats, unrestricted combo and hybrid decks. Accumulate repeated failure patterns before making generic fixes; never add card-name or scenario-specific hacks to make a benchmark pass.
7. Keep PR #29 open/draft and unmerged. PRs #30 and #32 are closed unmerged with evidence retained; keep PR #2 separate until its own archival decision. Stable main remains V0.13.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
