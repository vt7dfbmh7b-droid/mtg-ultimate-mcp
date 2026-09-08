<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-08T09:43:14.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: BENCH-01 remains active. The c2fa83b7 precedence repair and five-fixture review are complete: two signature failures improve, but commander-compatible Aura target shape still fails in Ellivere. Resume with a focused production-path relationship/ordering regression and the smallest evidence-backed generic target-shape repair, not another precedence change or replay of unchanged completed work. Preserve all hard gates and the accepted e17b0a1c baseline.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd`

The generic cut-order precedence repair at c2fa83b7ea4a81e18445aba3a54529cdb31d86cd passed immutable CI (run 34204677999) and its frozen five-fixture replay. Complete-deck manual review REJECTED it as a replacement Commander baseline. The review repairs the prior Hakbal/Reflections of Littjara and Bello/Esika's Chariot failure signatures; Quick Draw and Elven Empire show no material regression. Ellivere still cuts the creature-enchanting Angelic Destiny for artifact-enchanting Hardlight Containment, exposing commander-compatible Aura target-shape reasoning. All replay decks remain exact-100, Commander legal and resolved. Durable verdict: test-results/bench01-manual-verdicts/c2fa83b7ea4a81e18445aba3a54529cdb31d86cd.md, originally committed at 44279f204c97bfb98197201adb75aeb431db1f24. The precedence repair, five-fixture replay and manual verdict are completed work; do not repeat them as unfinished tasks.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted fully validated Commander product baseline. Later candidates 00571713696977093fee717deecc2b26969e2643, 4a7bbf616ac6826ec4ac979894f8752133af3bca, 66836fef0009a6913336efe0ec074aefd277abd5, 569933bf605a841f14dc000d1f04296ad3456df3, dfdb9663bd2394dfa620511d750501880b903770 and c2fa83b7ea4a81e18445aba3a54529cdb31d86cd are formally validated/replayed but manually rejected as replacement baselines.

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

- Active branch status: **bench01-c2fa83b7-manual-reject-aura-target-shape-regression-next**
- Last persisted Marvel control source: `c2fa83b7ea4a81e18445aba3a54529cdb31d86cd`
- Last persisted Marvel control outcome: **execution-success-target-not-achieved**
- Note: Latest registered focused and broad Marvel metadata at c2fa83b7 records successful execution/build where reported, but failed control/target-quality gates; no target achievement is claimed. Preserve the earlier exact-source 5829b37 restricted-pool construction-ceiling result as historical evidence. A red historical or constrained target is not automatically a blocker to unrelated BENCH-01 work; investigate only if relevant source, pool, provider truth or policy evidence changes. Do not convert provider uncertainty into absence or an intelligence failure.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest accepted Commander baseline. The latest product c2fa83b7ea4a81e18445aba3a54529cdb31d86cd is formally validated and replayed but manually rejected; prior rejected candidates remain historical evidence, not accepted replacements.
- Use test-results/bench01-manual-verdicts/c2fa83b7ea4a81e18445aba3a54529cdb31d86cd.md as the newest durable whole-deck verdict. Green CI, successful replay execution, swap counts and bracket movement are not sufficient for baseline acceptance.
- Treat the cut-order precedence correction, five-fixture replay and manual review as complete. Preserve the meaningful-strategy-loss first priority and the corrected typed-identity-before-legacy-score ordering.
- Retain the demonstrated partial progress: Hakbal keeps Reflections of Littjara; Bello keeps Esika's Chariot; Quick Draw and Elven Empire show no material regression in this replay.
- The remaining observed failure is commander-compatible Aura target shape: broad Aura/enchantment identity allows a creature-enchanting mechanism to be replaced by an artifact-only Aura. This is strategy/relationship reasoning, not a legality, provider or harness failure.
- Source inspection at the recovered head identifies auraSpecializationV15 in src/services/requested-component-relationship-v15.ts as a concrete broad-type source: it recognizes requested/commander Aura vocabulary but does not inspect the candidate's Enchant target. Confirm the effect through the actual production relationship and replacement-priority path with a generic failing regression before implementing a repair.
- Keep the next repair advisory and generic. Preserve hard legality, authoritative targets, structural floors, semantic safety, package acceptance, meaningful strategy preservation and structural fallback. Do not make all Auras uncuttable or use card/commander/fixture exceptions.
- Run focused regressions and the complete immutable validation suite before freezing a repair SHA. Replay the affected five controls from unchanged validated source, review complete decks, and require material improvement without regression.
- No fresh contrasting acceptance fixture or new provider general-AI comparison was completed for c2fa83b7 because Ellivere still fails. After the affected controls improve, require at least one genuinely fresh contrasting fixture and strong general-AI comparison before a new baseline acceptance claim.
- Once this replacement-coherence defect is resolved or conclusively bounded, broaden BENCH-01 to fresh combo, hybrid, control, aristocrats, budget and unusual-commander cases. Keep Counter Blitz dense-countermagic allocation watch-only unless contrasting evidence reproduces it.
- Read AGENTS.md before writes. Use single-flight execution and existing checked-in interfaces; never alter .github/workflows/**, src/workflow-immutability.test.ts or workflowPolicyEpochSha during scheduled/autonomous development. Persist manual verdicts outside replaceable replay output.
- PR #29 and stable/current V0.13 remain unmerged/unpromoted until promotion-grade BENCH-01 evidence and all applicable formal/manual gates are satisfied. Existing standing gated authority is unchanged.

## Next actions

1. Read project-state.json and AGENTS.md; inspect all relevant branch writers, including earlier-commit jobs. Do not overlap a running validation, replay, integrity writer or product repair.
2. Resume from the completed c2fa83b7ea4a81e18445aba3a54529cdb31d86cd replay/manual rejection in test-results/bench01-manual-verdicts/c2fa83b7ea4a81e18445aba3a54529cdb31d86cd.md. Do not redo the completed precedence repair, five-fixture replay or manual review merely because a scheduled invocation ended.
3. Add a focused generic production-path regression for commander-compatible Aura target shape, starting with auraSpecializationV15 in src/services/requested-component-relationship-v15.ts and its actual requested-component/replacement-priority callers. Distinguish creature-enchanting support from artifact-only or other incompatible targets; include a valid compatible replacement and a structural fallback control.
4. Only after the regression/trace proves the centralized defect, implement the smallest generic relationship-shape inference or propagation correction. Preserve all existing hard and advisory safety boundaries; no fixture, card or commander exceptions.
5. Run focused tests plus the complete immutable repository validation. If green, freeze that exact repair SHA through the existing replay request interface; run the affected five fixtures unchanged and manually compare full decks with the c2fa83b7 verdict.
6. Once those controls materially improve without regression, run at least one fresh contrasting fixture from the same frozen source and resume strong general-AI comparison before accepting a new Commander baseline.
7. Persist meaningful results and update project-state plus its generated handoff/validation surfaces as one coordinated checkpoint. Then broaden BENCH-01 rather than restarting completed audits or familiar replay cycles.

## Permanent truth boundary

- Commander legality, exact card count, singleton and color identity outrank optimization scores.
- Exact physical-printing existence/restrictions and hard budgets are fail-closed truths.
- Provider unavailable is not evidence of absence.
- A generic infinite-damage statement is not a verified multiplayer full-table win unless opponent scope is proven.
- Pipeline execution or a green harness is not proof of intelligent deck improvement.
- Expected construction-ceiling behaviour is not the same as target achievement.
- A compound aggregate theme-density pass does not prove that every explicitly requested component was preserved or improved.
- For a controlled compound request, candidate acceptance must preserve every already-satisfied component and must not move any below-target component backward while gains elsewhere compensate.
- A downstream preservation veto does not by itself prove the guard is too strict; distinguish lack of compatible candidates from candidate-discovery/ranking failure before changing product behavior.
- Correct strategy labels or structurally valid replacements do not by themselves prove whole-deck Commander quality; manual complete-deck review remains mandatory.
- Relative requested-component and commander-mechanism value must consider the outgoing card as well as the incoming card; hard theme floors alone do not prove above-floor identity preservation.
- Boolean controlled-theme membership is insufficient to prove component preservation in a compound request; preserve and compare structured component identity symmetrically for outgoing and incoming cards.
- Broad requested-component membership is not proof of strategic equivalence. Relative replacement quality must also account for payoff/engine importance, mechanism specificity and commander-conditioned card-shape relationships where evidence supports them.
- Typed requested-mechanism evidence is ineffective if a weaker legacy affinity tie-break removes the card before replacement identity is compared; cut-ranking precedence is part of Commander strategy preservation.
- Shared Aura/enchantment type or relationship-family membership is not proof of commander-compatible Enchant target shape; distinguish creature-enchanting support from artifact-, land- or other-target Auras through generic evidence.
- A frozen-source replay is product evidence only when src/** is proven equal to the validated product SHA used for that batch.
- Scheduled/autonomous development has no authority to modify .github/workflows/**, src/workflow-immutability.test.ts, or the approved workflow-policy epoch; those are explicit interactive-maintenance-only surfaces.
- Never treat an unvalidated or manually unreviewed/rejected head as an accepted Commander checkpoint.
- No scenario-specific, card-name or benchmark-specific hacks; product changes require generic evidence.
- Stable/current promotion or PR merging requires complete validation, non-redundancy, safety and promotion-grade benchmark evidence. The user has granted standing authority to perform those actions once those gates are genuinely satisfied; no extra approval is required at that point.

## Fresh-chat recovery

Read in this order:

1. `project-state.json`
2. `AGENTS.md`
3. `docs/PROJECT-STATE.md`
4. `validation-index.json`
5. `docs/VALIDATION-STATE.md`
6. `ULTIMATE_MTG_SPEC.md`
7. `docs/COMMANDER-SPECIALIST-OBJECTIVE.md`
8. `docs/ROADMAP.md`
9. `docs/DECISIONS.md`
10. `docs/VALIDATION-MATRIX.md`
11. `docs/KNOWN-FAILURES.md`

Then: BENCH-01 remains active. Accepted Commander baseline: e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Latest tested product: c2fa83b7ea4a81e18445aba3a54529cdb31d86cd; immutable CI and frozen five-fixture replay are green, but test-results/bench01-manual-verdicts/c2fa83b7ea4a81e18445aba3a54529cdb31d86cd.md manually REJECTS baseline acceptance. Hakbal and Bello failure signatures are repaired; Ellivere still confuses creature-enchanting support with an artifact-only Aura. Precedence repair/replay/review are complete. Next unfinished stage: a generic failing production-path Aura target-shape regression, then the smallest justified repair, full validation and unchanged replay. Start at src/services/requested-component-relationship-v15.ts; broad Aura specialization currently omits candidate Enchant-target inspection. Require fresh contrasting and general-AI evidence only after affected controls improve. Obey AGENTS.md single-flight and protected-workflow boundaries. Stable remains V0.13 and PR #29 unmerged.
