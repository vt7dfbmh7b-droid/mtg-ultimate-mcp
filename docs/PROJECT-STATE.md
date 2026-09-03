<!-- GENERATED FROM project-state.json. DO NOT EDIT BY HAND. -->
# Ultimate MTG — Project State

Generated from `project-state.json`. Last state update: **2026-09-03T10:05:00Z**.

## Current mode

- Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`
- Active experimental branch: `agent/v15-native-deck-intelligence`
- Active PR: #29
- Active milestone: **INTEL-02**
- Intelligence development paused: **no**
- Reason: INTEL-02 remains active after generic semantic, resource-engine and lifecycle hardening. Source 7265531... passes the current focused and precon controls; broad Marvel remains red with a fully diagnosed constrained-pool limitation. Focused Marvel is mechanically green with six swaps but manual review still blocks acceptance for interaction quality, land/mana infrastructure and compound resource-engine tradeoffs. Runtime source 45f4cb9... passes pinned CI after fixing a shutdown deadline timer race. The accepted checkpoint stays 77a5383... until the current package is manually resolved and the restricted lane policy is decided.

## Stable boundary

- Branch: `main`
- Version: `0.13.0`
- `server-current`: V0.13
- Stable promotion authorized: **no**

## Experimental checkpoints

Development checkpoint at pause: `77a5383fa7490aa91360b8186a4bda890f632157`

Accepted INTEL-02 checkpoint remains 77a5383... because it is the last source explicitly accepted after exact-source testing and manual review. Semantic follow-up source 7265531... passes pinned CI-adjacent deterministic validation, focused Marvel, Middle-earth Food and Fellowship, Necron Dynasties and Squirreled Away controls; broad Marvel still fails target quality and strategy preservation because its restricted pool has only two eligible fast-mana and two eligible tutor matches, all already present or excluded. Focused Marvel is mechanically green with six swaps across three rounds, but manual review remains blocked on interaction quality, lost land/mana infrastructure and compound resource-engine tradeoffs. Runtime follow-up 45f4cb9... makes the shutdown deadline timer enforceable and passes pinned CI. Neither follow-up is promoted to accepted checkpoint status.

Latest fully validated executable experimental baseline recorded by project state:

- Branch: `agent/package-probabilities`
- SHA: `63bb7274004060eea507f7991a04b84921d0cd47`
- Scope: Latest fully validated executable experimental baseline documented by the prior authoritative handoff. Later V0.15 deck-intelligence work on PR #29 remains experimental until milestone controls complete.

Always inspect the live active-branch head before editing. A later documentation/project-management commit is not automatically a new executable validation milestone.

## Milestones

| ID | Milestone | Status | Goal |
|---|---|---|---|
| PM-01 | Persistent Project State & Handoff Automation | validated | Make repository state authoritative so a fresh chat can recover exact project context with minimal rechecking. |
| PM-02 | Validation State Indexing | validated | Consolidate key persisted control metadata into one deterministic validation index so fresh chats can identify current, stale, passing and failing evidence immediately. |
| INTEL-01 | Win-package intelligence | implemented-validation-pending | Very-good verified full-table win-package discovery, feasibility, injection, and protection. |
| INTEL-02 | Actual autonomous deck improvement | active | Very-good target-aware autonomous refinement that repairs real deck weaknesses rather than cosmetic metrics. |
| BENCH-01 | Adversarial Commander benchmark suite | planned | Prove deck-building quality across combo, combat, control, aristocrats, typal, budget, theme-restricted, cEDH-ish, and hybrid decks. |
| INTEL-03 | Human-level strategic reasoning layer | planned | Model commander role, synergy networks, structural-card importance, cut consequences, primary/secondary plans, and coherent package trade-offs. |
| INTEL-04 | Counterfactual deck comparison & expert explanation | planned | Compare complete 100-card alternatives and explain why one deck state is stronger under the exact requested constraints. |

## Current validation status

- Active branch status: **accepted-checkpoint-77a-compound-resource-45f-manual-review-blocked**
- Last persisted Marvel control source: `7265531610a7012f7940f591c99a2fc6ef3af06e`
- Last persisted Marvel control outcome: **focused-pass-broad-fail**
- Note: At source 7265531..., focused Marvel refinement passed mechanically with six swaps across three accepted rounds and removed only the average-nonland-MV failure (2.71→2.58). The package stops with no-supported-swaps-found; manual review remains blocked because accepted substitutions lose spot interaction, land ramp/tutor, persistent colored-mana, mana-rock, treasure, sacrifice or compound card/token/mana-engine roles even when coarse strategy affinity stays green. Broad Marvel executed successfully but accepted no package: exhaustive restricted discovery found two fast-mana and two tutor matches, all already present or excluded, so target quality and strategy preservation remain blocking. Runtime hardening was separately validated by CI at 45f4cb9....

Required before resuming broad INTEL-01/INTEL-02 claims:

- Manually audit all six focused-Marvel IN→OUT packages from source 7265531...; mechanical green is not sufficient, especially for interaction quality, land/mana infrastructure and compound resource engines
- If manual review rejects any package, add only generic semantic/resource-quality rules and rerun focused and broad Marvel from one exact source
- Require focused Marvel and broad Marvel to pass target-quality and strategy-preservation gates on the same exact executable source before calling the restricted lane uniformly green
- Keep graveyard directionality/actionable recursion, explicit artifact engines, self-sacrifice versus repeatable outlets, secondary-plan inference, strategy-support density, premium early infrastructure, board wipes, token-death engines and board-scaling payoffs fail-closed
- Run a positive eligible verified full-table package scenario so INTEL-01 discovery, feasibility, atomic injection, protection and independent final recognition are proven end to end
- Commander legality, exact 100 cards, singleton/color identity, printing-family/set restrictions and hard budgets must remain intact in every expanded control

## Next actions

1. Keep the six focused-Marvel swaps unaccepted until interaction, land/mana infrastructure and compound resource-engine tradeoffs are manually resolved with surplus evidence.
2. If manual review rejects any focused package, implement only generic semantic/resource-quality rules and rerun focused and broad Marvel from one exact source.
3. If any control or manual audit fails, fix the generic semantic/selection rule rather than adding name-specific exceptions, then rerun the whole affected family from one exact executable source.
4. When the full INTEL-02 family is mechanically green and manually acceptable, update project-state.json and validation-index.json together and record that exact executable SHA as the new accepted development checkpoint.
5. Then run an eligible verified full-table win-package scenario to close the main INTEL-01 proof gap.
6. Only after the consolidated checkpoint and positive INTEL-01 proof should BENCH-01 broaden to materially different cases such as FF-only Counter Blitz and the NZ$500 Liliana, Heretical Healer challenge.
7. Keep PR #29 as experimental/evidence history. Do not merge or promote it automatically; when V0.15 is genuinely accepted, prepare a clean promotion candidate rather than treating the current 1,000+ commit evidence branch as release-ready.

## Permanent truth boundary

- Commander legality, exact card count, singleton and color identity outrank optimization scores.
- Exact physical-printing existence/restrictions and hard budgets are fail-closed truths.
- Provider unavailable is not evidence of absence.
- A generic infinite-damage statement is not a verified multiplayer full-table win unless opponent scope is proven.
- Pipeline execution is not proof of intelligent deck improvement.
- No merge, stable/current promotion, version bump, or release without explicit user approval.

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

Then: Inspect the live active-branch head and PR state. Treat 77a5383... as the accepted INTEL-02 checkpoint. Semantic source 7265531... passes focused Marvel and the current precon controls; broad Marvel remains a correctly diagnosed constrained-pool failure, focused package acceptance is manually blocked pending resource-quality review, and runtime shutdown hardening passes CI at 45f4cb9.... Continue only from nextActions and do not promote without explicit approval.
