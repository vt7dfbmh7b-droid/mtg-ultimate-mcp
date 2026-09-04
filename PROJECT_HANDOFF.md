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
- Active branch validation: **accepted-checkpoint-77a-intel01-positive-route-follow-up-ff32-cumulative-strategy-fuel-and-floor-failures**

## Audit reuse rule

The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and is a reusable baseline, not a recurring task. Do not rerun or restate the full audit unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change triggers a re-audit. Inspect the live active-branch head, then continue only from nextActions and the open targeted findings. Treat source f0c3b9f... as semantic/component evidence, source 45f4cb9... as runtime evidence, and the FF32 isolated/current-source replay as benchmark findings; no promotion without explicit approval.

## Stable safety boundary

Stable remains **V0.13 / 0.13.0** on `main`. No merge, stable/current promotion, version bump or release is authorized by this handoff.

## Latest fully validated executable experimental baseline

`63bb7274004060eea507f7991a04b84921d0cd47` on `agent/package-probabilities`.

Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until milestone controls complete.

## Important pending validation

The last persisted Marvel control is `f0c3b9f82dca49f295e44175e517d992e6e5356e` with outcome **focused-zero-swap-broad-zero-swap**. At source f0c3b9f..., exact-source focused and broad Marvel controls executed and persisted with the generic compound operational-component guard enabled. Both lanes returned no-supported-improvement with zero swaps: the six previously observed focused substitutions are now rejected because multi-component operational cards must retain their like-for-like component families, and broad Marvel still has no supported package after its restricted fast-mana/tutor pool is exhausted. Build, deterministic regressions, target execution and persistence passed; target-quality/strategy gates correctly remain red because no accepted package repairs the failed Bracket-5 gates. Dependent Necron Dynasties, Squirreled Away, Food and Fellowship and Middle-earth controls pass at f0c3b9f.... The separate generic INTEL-01 positive control passed at source 50e5d19... (workflow 33811643472) with complete discovery, strict closure, exact legal/affordable printings, atomic injection, final recognition and route audits; the finished deck retained one route, so alternate-route resilience remains a follow-up. Accepted checkpoint remains 77a5383...; no promotion.

## Next actions

1. Do not repeat the completed comprehensive system audit unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change triggers a re-audit; treat docs/SYSTEM-AUDIT-2026-09-02.md as the baseline and work only from the targeted remediation queue.
2. Keep the historical six focused-Marvel swaps unaccepted; source f0c3b9f... now rejects their compound operational-component losses generically and both exact-source Marvel lanes fail closed with zero swaps.
3. Decide whether the restricted Marvel family needs an explicit construction ceiling or a generic candidate-pool expansion; do not add card-name exceptions, and rerun both lanes from one exact executable source after any policy change.
4. Preserve the component guard and its anonymous multi-axis regression while revalidating any future candidate-pool change against interaction, land/mana, treasure, sacrifice, token, card-advantage and cost-reduction floors.
5. Treat INTEL-01 as scenario-level validated at source 50e5d19... for package discovery, closure, feasibility, injection, protection, final recognition and access/setup audits; keep the one-route resilience finding open and non-gating.
6. When the full INTEL-02 family is mechanically green and manually acceptable, update project-state.json and validation-index.json together and record that exact executable SHA as the new accepted development checkpoint.
7. The FF-only Counter Blitz benchmark (#32) failed on isolated source a079090... (workflow 33813323027) with package-wide Y'shtola spells-control retention loss (425→421 affinity; 29→27 trigger spells) despite five locally preserved swaps; a disposable replay on active source 7a2a80f... also reduced trigger spells 29→21 and board wipes 3→2 despite higher coarse affinity. Reproduce both findings on one current executable source and add generic package-level strategy-fuel/structural-floor gates before any acceptance.
8. Keep PR #29 as experimental/evidence history. Do not merge or promote it automatically; when V0.15 is genuinely accepted, prepare a clean promotion candidate rather than treating the current 1,000+ commit evidence branch as release-ready.

## Permanent recovery references

- `validation-index.json` / `docs/VALIDATION-STATE.md` — consolidated registered validation status.
- `ULTIMATE_MTG_SPEC.md` — north-star behavior.
- `docs/ROADMAP.md` — milestone plan.
- `docs/DECISIONS.md` — durable architectural decisions.
- `docs/KNOWN-FAILURES.md` — failures that must remain prevented.
- `docs/VALIDATION-MATRIX.md` — what each test/control actually proves.
- `docs/PROJECT-MANAGEMENT.md` — recovery/update protocol.
