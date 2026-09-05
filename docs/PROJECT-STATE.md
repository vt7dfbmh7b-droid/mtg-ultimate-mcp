<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-05T14:45:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: BENCH-01 remains the critical path. The repaired ce4c9eba source proved the compound parser worked, then Cavalry Charge and Counter Blitz independently exposed the same generic component-compensation defect: requested Knight/combat facets regressed in Cavalry and proliferate regressed 4→2 in Counter while aggregate compound metrics remained green. The generic component-preservation gate is now fully validated at dd085caf4e47f6f5e1976667dc90de2db46c00a1. Freeze that exact source and replay Counter Blitz plus Cavalry Charge without Commander-intelligence edits between them. Judge each requested component independently and only then decide whether the blocker is closed or another generic repair is justified.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

The formal accepted development checkpoint remains 77a5383..., while BENCH-01 has now advanced beyond the parser repair. Repaired Cavalry Charge and Counter Blitz independently proved that aggregate compound-theme density could hide regression in an explicitly requested component. The generic per-component candidate-acceptance repair was implemented without deck/card-specific logic, focused regressions were added, and final combined source dd085caf4e47f6f5e1976667dc90de2db46c00a1 passed normal CI run 33972639473 end-to-end: project-management checks, validation-index checks, recovery smoke test, type-check/build, and the full test suite. This exact SHA is now the frozen repaired experimental product source for paired Counter Blitz and Cavalry Charge replay. PR #29 remains active and stable remains V0.13 because BENCH-01 is not yet promotion-grade.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `dd085caf4e47f6f5e1976667dc90de2db46c00a1`
- Scope: Fully validated generic compound-component preservation repair. It independently audits every controlled compound component before the existing aggregate theme gate, preserves satisfied components, prevents below-target components from moving backward, fails closed on missing/inconsistent component evidence, leaves single-theme behavior unchanged, and passed normal CI run 33972639473 including full tests and build. This is a validated experimental BENCH-01 replay baseline, not stable promotion or proof of benchmark superiority.

Always inspect the live active-branch head before editing. A later documentation/project-management commit is not automatically a new executable validation milestone.

## Milestones

| ID | Milestone | Status | Goal |
|---|---|---|---|
| PM-01 | Persistent Project State & Handoff Automation | validated | Make repository state authoritative so a fresh chat can recover exact project context with minimal rechecking. |
| PM-02 | Validation State Indexing | validated | Consolidate key persisted control metadata into one deterministic validation index so fresh chats can identify current, stale, passing and failing evidence immediately. |
| INTEL-01 | Win-package intelligence | validated | Very-good verified full-table win-package discovery, feasibility, injection, and protection. |
| INTEL-02 | Actual autonomous deck improvement | implemented-validation-pending | Very-good target-aware autonomous refinement that repairs real deck weaknesses rather than cosmetic metrics. |
| BENCH-01 | Adversarial Commander benchmark suite | active | Prove deck-building quality across combo, combat, control, aristocrats, typal, budget, theme-restricted, cEDH-ish, and hybrid decks. |
| INTEL-03 | Human-level strategic reasoning layer | planned | Model commander role, synergy networks, structural-card importance, cut consequences, primary/secondary plans, and coherent package trade-offs. |
| INTEL-04 | Counterfactual deck comparison & expert explanation | planned | Compare complete 100-card alternatives and explain why one deck state is stronger under the exact requested constraints. |

## Current validation status

- Active branch status: **bench01-compound-component-gate-validated-dd085caf-paired-replay-required-no-promotion**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Preserve all generic guards proven by the 5829b37... family replay, including strategy-fuel, structural-floor, graveyard-directionality, artifact-engine, token/death-payoff, resource-component and exact legality/budget/printing truth.
- Preserve historical BENCH-01 Batch A as a 1-1 pre-repair result: Liliana NZ$500 specialist win; Counter Blitz general-AI win. Do not relabel that evidence because later repairs improve the specialist.
- Preserve ce4c9eba59617be2cf57718408b40252230bccf4 as the validated parser-repair baseline and its repaired replay evidence. Cavalry Charge regressed Knights 32→27 and combat references 21→17; Counter Blitz independently regressed proliferate 4→2 while aggregate compound metrics remained green. Together those fixtures authorized one generic component-preservation repair.
- Treat dd085caf4e47f6f5e1976667dc90de2db46c00a1 as the exact fully validated compound-component repair source. Normal CI run 33972639473 passed project-state/index/recovery checks, type-check/build, and the full repository tests on that SHA.
- Freeze dd085caf4e47f6f5e1976667dc90de2db46c00a1 for the paired repaired Counter Blitz and Cavalry Charge replays. Do not change Commander-intelligence source between those two fixtures.
- For each replay, inspect exact legality/printing/budget truth, whole-deck quality, target movement/achievement and every requested compound component independently. Aggregate theme density alone is insufficient evidence.
- Keep Marvel expected restricted-pool ceiling evidence and provider-unknown Scryfall HTTP 429 semantics separate from BENCH blockers.
- After the paired replay, continue several unseen contrasting BENCH-01 fixtures before another intelligence change unless the pair reveals another clear repeated generic correctness blocker.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Freeze dd085caf4e47f6f5e1976667dc90de2db46c00a1 as the exact validated product source for the next paired BENCH replay. Normal CI run 33972639473 is the acceptance evidence for this repair; do not alter src/** between Counter Blitz and Cavalry Charge.
3. Replay Counter Blitz from dd085caf... under the same FF-only Bant +1/+1 counters/proliferate/countermagic/combat constraints and compare the complete final deck to the locked 18-swap general-AI baseline. Verify proliferate no longer regresses while legality, FF printing truth, counters, countermagic, combat identity, protection/access, routes, curve and bracket truth remain acceptable.
4. Replay Cavalry Charge from the same unchanged dd085caf... source under Knights typal + combat + graveyard recursion/reanimation, NZ$35 per added card, NZ$200 total and maximum 12 swaps. Verify Knight and combat components are preserved while legality, budget, recursion/structural improvements and whole-deck quality remain acceptable.
5. Interpret the two replays together. A green aggregate compound score is insufficient: record every controlled component before/after and distinguish target movement from target achievement. If both fixtures show the compensation defect closed without unacceptable quality regression, close this BENCH correctness blocker.
6. If the paired replay exposes another repeated generic defect, localize and justify one generic repair from cross-fixture evidence before changing product source. Do not add deck/card-specific thresholds or exceptions.
7. Once this blocker is closed, continue several unseen BENCH-01 fixtures across combat, control, typal, aristocrats, unrestricted combo, hybrid and other contrasting families before another intelligence change. Convert only repeated cross-fixture weaknesses into generic repairs.
8. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Standing authorization permits merge/promotion without another approval only after complete validation and broad benchmark evidence demonstrate the specialist is genuinely ready.

## Permanent truth boundary

- Commander legality, exact card count, singleton and color identity outrank optimization scores.
- Exact physical-printing existence/restrictions and hard budgets are fail-closed truths.
- Provider unavailable is not evidence of absence.
- A generic infinite-damage statement is not a verified multiplayer full-table win unless opponent scope is proven.
- Pipeline execution or a green harness is not proof of intelligent deck improvement.
- Expected construction-ceiling behaviour is not the same as target achievement.
- A compound aggregate theme-density pass does not prove that every explicitly requested component was preserved or improved.
- For a controlled compound request, candidate acceptance must preserve every already-satisfied component and must not move any below-target component backward while gains elsewhere compensate.
- Never treat an unvalidated head or staged repair as an accepted checkpoint.
- No scenario-specific, card-name or benchmark-specific hacks; product changes require generic evidence.
- Stable/current promotion or PR merging requires complete validation, non-redundancy, safety and promotion-grade benchmark evidence. The user has granted standing authority to perform those actions once those gates are genuinely satisfied; no extra approval is required at that point.

## Fresh-chat recovery

Read in this order:

1. `project-state.json`
2. `docs/PROJECT-STATE.md`
3. `validation-index.json`
4. `docs/VALIDATION-STATE.md`
5. `ULTIMATE_MTG_SPEC.md`
6. `docs/COMMANDER-SPECIALIST-OBJECTIVE.md`
7. `docs/ROADMAP.md`
8. `docs/DECISIONS.md`
9. `docs/VALIDATION-MATRIX.md`
10. `docs/KNOWN-FAILURES.md`

Then: The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and reusable; do not rerun it without a material trigger. BENCH-01 is active. Repaired Cavalry Charge and Counter Blitz independently proved a generic compound-component compensation defect on frozen source ce4c9eba.... The one authorized generic component-preservation repair is now fully validated at dd085caf4e47f6f5e1976667dc90de2db46c00a1 by normal CI run 33972639473. Freeze that exact source and replay Counter Blitz plus Cavalry Charge without src changes between them, judging every requested component independently as well as whole-deck quality. Stable remains V0.13 until broad promotion-grade evidence exists; standing user authorization allows merge/promotion once full validation and evidence gates are satisfied.
