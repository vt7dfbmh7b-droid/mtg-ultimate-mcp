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
- Active branch validation: **accepted-checkpoint-77a-newer-evidence-stale-current-executable-revalidation-required**

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until milestone controls complete.

## Important pending validation

The last persisted Marvel control is `b9ab88d3d56caa7d6744cc78e002dc17dfa8bac4` with outcome **focused-fail-broad-fail**. The latest registered Marvel batch is exact-source b9ab88d... and both lanes are red. Focused Marvel executed but failed its target-gate quality outcome. Broad Marvel executed but failed target quality and strategy preservation. Later fixes landed after this batch, so these failures are valuable regression evidence but are not a current-head verdict.

## Next actions

1. Exact-source validate the current executable candidate across the complete registered INTEL-02 control family and normal deterministic/project-integrity checks; do not accept a new checkpoint from partial or mixed-source evidence.
2. Manually audit every accepted swap from Necron Dynasties, Squirreled Away, Food and Fellowship, focused Marvel and broad Marvel. Reject any package that weakens a primary/secondary engine, meaningful wipe/interaction infrastructure, premium early mana, recursion, token-death/card-advantage engines or persistent colored mana merely to satisfy generic role counts.
3. If any control or manual audit fails, fix the generic semantic/selection rule rather than adding name-specific exceptions, then rerun the whole affected family from one exact executable source.
4. When the full INTEL-02 family is mechanically green and manually acceptable, update project-state.json and validation-index.json together and record that exact executable SHA as the new accepted development checkpoint.
5. Then run an eligible verified full-table win-package scenario to close the main INTEL-01 proof gap.
6. Only after the consolidated checkpoint and positive INTEL-01 proof should BENCH-01 broaden to materially different cases such as FF-only Counter Blitz and the NZ$500 Liliana, Heretical Healer challenge.
7. Keep PR #29 as experimental/evidence history. Do not merge or promote it automatically; when V0.15 is genuinely accepted, prepare a clean promotion candidate rather than treating the current 1,000+ commit evidence branch as release-ready.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
