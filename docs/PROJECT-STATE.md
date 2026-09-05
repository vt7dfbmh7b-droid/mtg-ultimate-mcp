<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-05T07:13:11.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: BENCH-01 is now the critical path. Batch A produced a 1-1 specialist/general-AI split, and unseen Cavalry Charge independently reproduced Counter Blitz's compound natural-language theme rejection. Cross-fixture evidence therefore justified one generic repair in the centralized neutral-theme layer. That repair remains unaccepted because corrected run 33949687254 did not finish green. The immediate task is to isolate that exact validation failure, make only the demonstrated generic compatibility correction, achieve focused regressions + full suite + build green, remove temporary repair harness surfaces, then freeze the exact repaired source and replay Counter Blitz and Cavalry Charge from that same unchanged source before any further Commander-intelligence edits.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

The accepted development checkpoint remains 77a5383... and stable remains V0.13. Source 5829b37b686255ba35d419b37be17095e54fb696 is the frozen exact-source INTEL-02 replay and initial BENCH-01 product baseline, not a promoted checkpoint. BENCH-01 Batch A is complete: Liliana NZ$500 is a decisive specialist win because it satisfies the hard whole-deck budget while retaining strong competitive construction signals; Counter Blitz is a decisive general-AI win because the specialist rejected the natural compound request and made zero swaps. Cavalry Charge independently reproduced the same compound free-form theme rejection, establishing a generic centralized compound-theme representation defect rather than a fixture-specific problem. A controlled compound-theme repair is staged on the active branch, but it is not accepted: focused neutral-theme regressions passed while corrected validation run 33949687254 ultimately failed before a green full-suite/build acceptance. No repaired product SHA is frozen or validated yet. PRs #30 and #32 remain closed unmerged with evidence retained; PR #2 remains separate; PR #29 remains the active experimental record.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/package-probabilities`
- SHA: `63bb7274004060eea507f7991a04b84921d0cd47`
- Scope: Latest fully validated executable experimental baseline recorded by project state. Later V0.15 deck-intelligence, BENCH-01 evidence and the in-progress compound-theme repair remain experimental until benchmark and validation evidence justify a new accepted checkpoint.

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

- Active branch status: **bench01-compound-theme-repair-validation-blocked-focused-regressions-green-full-validation-failed-no-repaired-sha-accepted-no-promotion**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Preserve all generic guards proven by the 5829b37... family replay, including strategy-fuel, structural-floor, graveyard-directionality, artifact-engine, token/death-payoff, resource-component and exact legality/budget/printing truth.
- Preserve the completed BENCH-01 Batch A result as a split specialist/general-AI score: Liliana NZ$500 specialist win; Counter Blitz general-AI win. Do not relabel either result because later repairs exist.
- Treat Cavalry Charge as independent cross-fixture evidence for the same compound natural-language request defect; the repair must remain generic and controlled, with unknown leftovers still fail-closed and no raw user text executed as provider query grammar.
- Do not accept the compound-theme repair until focused neutral-theme regressions, the full repository suite and build are green from the same source and temporary one-shot repair surfaces are removed from the accepted product commit.
- After repair acceptance, freeze that exact repaired source SHA and replay Counter Blitz and Cavalry Charge from the identical source with no Commander-intelligence changes between them; inspect deck quality and constraint truth, not workflow colour alone.
- Keep Marvel ceiling evidence and provider-unknown Scryfall HTTP 429 semantics separate from BENCH blockers.
- Continue unseen contrasting BENCH-01 fixtures before further product changes unless the replay itself exposes a clear generic correctness blocker.

## Next actions

1. Do not repeat the completed comprehensive system audit; docs/SYSTEM-AUDIT-2026-09-02.md remains the reusable baseline unless a material architecture, runtime-entry-point, stable-boundary or project-state-integrity change occurs.
2. Preserve BENCH-01 Batch A as completed evidence from product baseline 5829b37...: Liliana NZ$500 is the specialist win; Counter Blitz is the general-AI win; aggregate verdict is split-not-promotion-grade. Preserve the locked general-AI baselines rather than regenerating them after seeing specialist results.
3. Preserve Cavalry Charge as the second unrelated reproduction of the compound-theme rejection. Together with Counter Blitz, this is sufficient generic evidence for the centralized controlled compound-theme repair; do not seek a card/deck-specific workaround.
4. At the current active branch head, isolate the exact failure in corrected validation run 33949687254 / job 101261983495. Focused neutral-theme regressions already passed; fix only the demonstrated remaining full-suite/build/compatibility problem and preserve the bounded combat discovery contract.
5. Require the repaired source to pass focused neutral-theme regressions, the full repository test suite and build. Remove temporary one-shot repair workflows/scripts from the accepted product commit. Do not mark the repair accepted or freeze a repaired SHA before all of those conditions are true.
6. Once green, freeze the exact repaired product SHA and replay Counter Blitz FF-only plus Cavalry Charge compound from that same unchanged source. Verify legality, exact restrictions, budgets/swap limits, actual accepted swaps, requested strategy axes, whole-deck cohesion and benchmark target movement rather than relying on status alone.
7. Compare the repaired Counter result against the locked 18-swap general-AI baseline and inspect Cavalry against its NZ$35-per-card, NZ$200-total and 12-swap limits. Record whether the repair merely parses the request or actually produces stronger complete decks.
8. If the repaired replay is sound, continue several unseen fixtures across combat, control, typal, aristocrats, unrestricted combo, hybrid and other contrasting families before making another intelligence change. Convert only repeated cross-fixture weaknesses into generic repairs.
9. PR #29 and stable V0.13 remain unchanged while BENCH-01 is not promotion-grade. Once all relevant validation is green and broad benchmark evidence shows the specialist consistently deserves promotion, the standing user authorization permits merging/promotion without another approval; document the evidence and resulting state in the same run.

## Permanent truth boundary

- Commander legality, exact card count, singleton and color identity outrank optimization scores.
- Exact physical-printing existence/restrictions and hard budgets are fail-closed truths.
- Provider unavailable is not evidence of absence.
- A generic infinite-damage statement is not a verified multiplayer full-table win unless opponent scope is proven.
- Pipeline execution or a green harness is not proof of intelligent deck improvement.
- Expected construction-ceiling behaviour is not the same as target achievement.
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

Then: The comprehensive system audit in docs/SYSTEM-AUDIT-2026-09-02.md is complete and reusable; do not rerun it without a material trigger. BENCH-01 is active. Batch A is complete at 1-1, Cavalry independently reproduced the Counter compound-theme defect, and the generic compound-theme repair is the immediate validation gate. Do not replay repaired benchmarks until a fully green repaired source is accepted and frozen. Then replay Counter Blitz and Cavalry Charge from the same unchanged repair SHA, inspect complete-deck quality, continue unseen contrasting fixtures, and only make further generic intelligence changes from repeated evidence. Stable remains V0.13 until promotion-grade evidence exists; standing user authorization allows merge/promotion once the full validation and evidence gates are satisfied.
