<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-06T11:28:00.000Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **BENCH-01**
- Intelligence development paused: **no**
- Reason: BENCH-01 remains active. Manual replay showed corrected strategy inference still permits structurally attractive replacements that materially weaken commander/requested identity. The generic relative replacement-identity comparator is now staged but unwired; the next action is runtime integration into the already-legal cut ordering, followed by focused/full validation and frozen-source replay.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **yes**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

The formal accepted development checkpoint remains 77a5383.... The latest accepted fully validated Commander product remains e17b0a1cba659b229fd6f0b6e2df79c5e464a616. Adaptive diversification candidate 247fb37bc34ad70678ff12ec297a6e9bdc220323 was engineering-green but failed manual whole-deck acceptance. Strategy-anchor descendant 2e34ebff20d0a66b7c4649feb1e9984c156e43ca passed focused regression, full repository tests and build, and its five-fixture replay confirms the false Equipment/Voltron inference was corrected. However, Animated Army still regressed in whole-deck quality and Elven Empire / Explorers still expose generic structural replacement pressure overriding requested identity quality. Source diagnosis is now complete: deck-builder-v07 performs hard semantic/structural/authoritative gates first, then chooses among surviving cuts using strategy-loss, structural-deficit, curve and heuristic pressure without a relative controlled-theme IN-vs-OUT identity comparison. Commits db471dc7/9e809785 stage a generic advisory replacement-identity comparator plus typal, artifact/enchantment and spellslinger control regressions. This staged primitive is not wired into runtime and is not validated or accepted. The adaptive lineage therefore remains unaccepted.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/v15-native-deck-intelligence`
- SHA: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`
- Scope: Latest accepted fully validated Commander product baseline. Generic neutral-theme taxonomy bridge for shared card-draw and lifegain semantics. Later adaptive-diversification and strategy-anchor descendants contain useful engineering fixes/evidence but have not passed required manual whole-deck Commander-quality acceptance as a product lineage.

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

- Active branch status: **bench01-replacement-identity-priority-staged-unwired-unvalidated**
- Last persisted Marvel control source: `5829b37b686255ba35d419b37be17095e54fb696`
- Last persisted Marvel control outcome: **expected-ceiling-fail-closed-zero-swap**
- Note: At exact source 5829b37..., focused and broad Marvel execute and persist honestly with zero accepted swaps because the restricted pool cannot repair the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure. Keep these controls red for target achievement. Treat the result as expected construction-ceiling behaviour, not as a passing target and not as a blocker to BENCH-01 on other archetypes. Rerun only when the relevant pool, provider truth or policy changes.

Required before resuming broad INTEL-01/INTEL-02 claims:

- Keep e17b0a1cba659b229fd6f0b6e2df79c5e464a616 as the latest accepted fully validated Commander baseline until a later product lineage passes both formal validation and required whole-deck BENCH acceptance.
- Retain the generic positive Equipment/equip/attach anchor regression from 2e34ebff20d0a66b7c4649feb1e9984c156e43ca; the false Bello Equipment/Voltron strategy signal is a closed semantic defect.
- Treat 247fb37bc34ad70678ff12ec297a6e9bdc220323 adaptive diversification as engineering-green but manually rejected, and 2e34ebff20d0a66b7c4649feb1e9984c156e43ca as a fully tested strategy-anchor descendant whose overall adaptive lineage remains manually rejected.
- Treat db471dc7afa4a2207be0e2d63e6f2002fe0a8c71 / 9e809785addff5d3e52c67e8c0bbf1573f4da921 as a staged, advisory relative replacement-identity primitive and regression contract only; it is not runtime-wired, validated, or accepted product behavior.
- Wire the generic comparator only after all existing hard legality, package, strategy-loss, structural, authoritative-target and curve gates have admitted candidate swaps; it must rank legal alternatives rather than veto necessary structural cuts.
- Do not freeze all typal/theme cards, add fixture/card exceptions, weaken target gates, or simply raise theme minimums.
- Do not weaken compound-theme/component preservation, legality, budget, printing, strategy-preservation, package acceptance, target-progress, simulation or win-route truth gates.
- Require focused + full validation and one frozen-source multi-fixture replay with manual whole-deck review before accepting a replacement-priority repair.
- Keep the earlier Counter Blitz dense-countermagic allocation concern watch-only unless a broader cross-fixture batch reproduces it.
- Do not merge PR #29 or promote stable/current V0.13 until BENCH-01 becomes promotion-grade and all relevant validation and manual quality evidence are green.

## Next actions

1. Wire replacement-identity-priority-v15 into deck-builder-v07 candidate-cut ordering only after existing hard semantic/structural/authoritative/package/curve gates; derive controlled-theme match from existing explicitTheme metadata and substantive strategy affinity from existing V0.15 strategyAffinity matches.
2. Add an integration regression proving an on-identity legal cut outranks an identity-eroding legal cut while a structurally necessary identity cut remains possible when no equal legal alternative exists.
3. Run focused replacement-priority regressions, then full repository tests/type-check/build/project-state integrity; freeze the exact green repair SHA.
4. Replay Animated Army, Elven Empire and Explorers of the Deep plus Quick Draw and Virtue and Valor controls from that unchanged SHA; manually inspect complete decks and compare against the rejected 247fb37/2e34 lineage before acceptance.
5. Only after manual whole-deck quality improves across the repeated failure pattern should BENCH-01 broaden or PR #29 / V0.15 promotion readiness be reconsidered.

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
- Repeated breadth sensitivity plus source proof that the breadth parameter bounds serial diversification justified adaptive-search experimentation, but manual whole-deck rejection means breadth movement alone is not product-quality success.
- Correct strategy labels do not by themselves prove replacement quality; relative commander/requested-identity value of IN versus OUT must be considered above hard minimum floors.
- Relative identity priority is advisory ordering among already-legal replacements, not a new hard preservation floor; necessary structural cuts must remain possible.
- Common Commander vocabulary must only become enforceable when it maps to generic measurable card semantics; never silently accept unknown leftovers.
- Never treat an unvalidated or manually rejected head as an accepted checkpoint.
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

Then: BENCH-01 remains active. Keep e17b0a1c... as the latest accepted product baseline. The source diagnosis for identity erosion is complete: deck-builder-v07 lacks relative requested-theme IN-vs-OUT ranking after hard gates. Commits db471dc7/9e809785 stage a generic advisory comparator and contrasting regression contract, but runtime wiring and validation remain unfinished. Next: wire the comparator into legal cut ordering, add integration coverage, fully validate, freeze the green SHA, then replay Animated Army / Elven Empire / Explorers plus Quick Draw / Virtue and Valor controls. Stable remains V0.13 and PR #29 remains unmerged.
