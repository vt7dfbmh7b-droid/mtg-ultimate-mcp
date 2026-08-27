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

- Active milestone: **INTEL-02 — Actual autonomous deck improvement**
- Intelligence development paused: **no**
- Experimental branch: `agent/v15-native-deck-intelligence`
- Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`
- Active branch validation: **deterministic-semantic-repair-green-live-controls-pending**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until milestone controls complete.

## Important pending validation

The last persisted Marvel control is `77a5383fa7490aa91360b8186a4bda890f632157` with outcome **focused-pass-broad-fail**. At exact source 77a5383..., focused Marvel passed with Vanquish the Horde -> Reanimate and Arcane Signet -> Brainstorm, moving average nonland mana value 2.71 -> 2.59 while preserving legal exact-100 Marvel printings and substantive strategy. The independently persisted broad Marvel control at the same source failed target-quality and strategy-preservation gates. This is restricted focused-scenario evidence, not a broad Marvel pass.

## Next actions

1. Publish and exact-source validate the combined KF-026 through KF-030 semantic repair: own-graveyard engines must outrank graveyard hate; movement into a graveyard must never count as reanimation; explicit artifact engines must outrank generic artifacts; self-sacrifice must not impersonate a repeatable outlet; and token multipliers, death engines and board-scaling payoffs must receive substantive cut protection.
2. Rerun and manually audit Necron Dynasties and Squirreled Away. Reject any package that still cuts Trazyn/Resurrection-Orb-style graveyard engines, Chatterfang/anthem/overrun-style token engines, or Poison-Tip-Archer/Moldervine-Reclamation-style token-death engines for generic role-count gains.
3. Keep Marvel and Middle-earth restricted controls active during the repair. Broad Marvel must pass its whole-deck target and strategy gates; Food and Fellowship must retain its exact four-swap quality or improve honestly.
4. Only after those controls meet the same high standard should budget, card-pool and new-archetype conditions broaden further.
5. Run an eligible verified full-table package scenario to validate INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition end to end; current Marvel, Middle-earth, Food and Necron controls do not provide that positive win-route proof.
6. Migrate legacy KF-013 evidence writers to isolated paths plus bounded latest-head reconciliation before treating concurrent persistence as globally closed.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
