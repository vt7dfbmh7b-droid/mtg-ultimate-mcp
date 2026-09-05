# Ultimate MTG Roadmap

This roadmap converts the north-star specification into bounded development milestones. `project-state.json` is authoritative for which milestone is active now.

## North star

Build the best evidence-backed autonomous Commander deck-building intelligence we can, then prove it deserves to be trusted.

The intended end state is a Commander specialist that can outperform a strong general-purpose AI on Commander deck construction through deeper domain focus, structured evidence, exhaustive checking, counterfactual comparison, and consistent verification.

## PM-01 — Persistent Project State & Handoff Automation — VALIDATED

Goal: stop treating chat history as project memory.

Delivered:
- `project-state.json` is the machine-readable current-state authority;
- `docs/PROJECT-STATE.md` and `PROJECT_HANDOFF.md` are generated from it;
- architecture decisions, known failures, roadmap and validation matrix are committed;
- CI detects state/handoff drift;
- a self-reporting integrity control binds project-management typecheck/state validation/source build to an exact source SHA.

Initial validated control:
- `test-results/project-management/integrity.txt`
- source `73366cf57c055fc0ae7831209ad155b360bf036f`
- project-management typecheck: success
- state validation: success
- normal source build: success

## PM-02 — Validation State Indexing — VALIDATED

Goal: stop making fresh chats hunt through individual result directories to determine what is current, stale, passing or failing.

Delivered:
- `validation-registry.json` registers high-value controls needed for recovery and milestone claims;
- `validation-index.json` is deterministically generated from registry + persisted metadata + project state;
- `docs/VALIDATION-STATE.md` is the generated human snapshot;
- index records bind tested source SHA, pass/fail/unknown state, claim level and checkpoint match;
- CI fails on a stale validation index;
- the self-reporting PM integrity control regenerates the index whenever it updates its own persisted result;
- `npm run project:resume` derives a fresh-session recovery brief without old chat history or individual result-folder inspection.

## INTEL-01 — Win-package intelligence — VALIDATED

Goal: very-good verified win-package reasoning.

Validated direction includes:
- bounded but deep Commander Spellbook discovery with honest incomplete-evidence semantics;
- exact commander legality/color/printing/budget filtering;
- multiplayer full-table closure aligned with final evaluation semantics;
- package feasibility against swap capacity;
- atomic package injection;
- protection of already-present package pieces;
- R/competitive preference among feasible verified packages;
- no false absence when discovery is truncated or unavailable;
- final route recognition, alternate-route retention, route setup/interruption and exact tutor/access auditing.

The exact-source positive control at `5829b37b686255ba35d419b37be17095e54fb696` is green and retains four verified full-table routes with two distinct library routes. BENCH-01 still tests whether this intelligence translates into better complete decks across adversarial archetypes.

## INTEL-02 — Actual autonomous deck improvement — IMPLEMENTED / BENCHMARK VALIDATION PENDING

Goal: improve the deck that exists, not an abstract score.

The role-truth, structural-floor and package-preservation hardening is implemented far enough to enter adversarial benchmarking. The complete dependent family was replayed from one frozen executable source, `5829b37b686255ba35d419b37be17095e54fb696`.

On that replay:
- Food and Fellowship, Necron Dynasties, Squirreled Away and Scions & Spellcraft are mechanically green and manually acceptable with recorded watch items;
- the earlier Food false green that spent `Well of Lost Dreams` on one-shot interaction did not recur;
- generic strategy/resource/component guards remained active;
- Marvel focused and broad fail closed with zero swaps because the restricted pool cannot satisfy the remaining Bracket-5 fast-mana/tutor/verified-win requirements without violating preserved structure;
- that Marvel result is an expected construction ceiling, not target achievement and not a reason to relax standards;
- the themed special-printing audit is provider-unknown after Scryfall HTTP 429, not evidence of absence and not a BENCH-01 blocker.

The accepted development checkpoint remains `77a5383fa7490aa91360b8186a4bda890f632157`. Starting BENCH-01 does not promote `5829b37...`; it uses that source as a frozen evaluation baseline while broader quality evidence is gathered.

## BENCH-01 — Adversarial Commander benchmark suite — ACTIVE

Goal: measure intelligence rather than anecdotes and determine whether the specialist actually beats strong general-purpose AI on complete Commander deck decisions.

Operating rules:
- freeze executable source for each benchmark batch;
- run several unseen, contrasting fixtures before changing Commander intelligence;
- never add card-name or scenario-specific hacks merely to pass a fixture;
- score hard truth before subjective quality;
- compare complete 100-card outputs under identical commander, budget, theme/printing and bracket constraints;
- record concrete expert-review wins, losses and ambiguous trade-offs;
- only convert repeated cross-fixture weaknesses into generic INTEL-03/INTEL-04 or INTEL-02 remediation work.

### Batch A — frozen source `5829b37...`

First contrasting fixtures:
1. **Counter Blitz / Tidus, Yuna's Guardian** — FINAL FANTASY printings only; Bant +1/+1 counters/proliferate; dense countermagic; hybrid combat and combo identity; preserve meaningful non-combo combat routes rather than collapsing into a single infinite line.
2. **Liliana, Heretical Healer // Liliana, Defiant Necromancer** — unrestricted mono-black with a hard NZ$500 whole-deck budget; aristocrats/graveyard/reanimation identity; compare the already-captured specialist result against a fresh strong general-AI build under the same constraints.

Benchmark families to expand after Batch A:
- combat/commander-damage;
- compact combo;
- hybrid combat-combo;
- aristocrats;
- control;
- typal/tribal;
- graveyard/reanimator;
- counters;
- spellslinger;
- equipment;
- budget constrained;
- exact printing-family/theme constrained;
- unusual partner pairs;
- high Bracket 4;
- Bracket 5 / cEDH-ish construction.

Scored dimensions:
- Commander legality, exact 100, singleton/color identity;
- exact printing-family/theme restrictions and hard budgets;
- target-gate movement and bracket truth;
- win-route correctness, closure and resilience;
- primary/secondary strategy preservation;
- cut quality and structural-card losses;
- mana, interaction, card advantage and resource-engine structure;
- probability/simulation improvement where the claim is supported;
- spend efficiency;
- complete-deck coherence;
- explanation quality;
- expert manual comparison against the strong general-AI baseline.

## INTEL-03 — Human-level strategic reasoning layer — PLANNED

Goal: represent why cards and packages matter to this deck.

Planned concepts:
- commander role and dependency graph;
- primary, secondary and fallback game plans;
- synergy clusters and shared-core cards;
- structural-card importance / cut blast radius;
- setup cost, interruption exposure and recovery;
- dead-piece risk and card-role reuse;
- package overlap and redundancy;
- meta-sensitive interaction needs;
- deck identity / theme preservation.

## INTEL-04 — Counterfactual deck comparison & expert explanation — PLANNED

Goal: compare whole legal deck states, not isolated card grades.

Expected behavior:
- original deck vs candidate A/B/C under identical seeds/evidence;
- explicit hard-gate deltas;
- route-access and resilience deltas;
- mana/curve/interaction effects;
- price and printing truth;
- strategy trade-offs;
- smallest coherent improvement preference;
- expert-quality explanation of both accepted and rejected swaps.

## Later phases

Potential later work is intentionally subordinate to demonstrated Commander intelligence:
- richer tournament/meta learning;
- historical model evidence;
- personalized pilot preferences;
- additional formats;
- UI polish and convenience features.

Do not add breadth merely because it is possible. New work should either improve Commander expertise, verification, autonomous decision quality, or the evidence used to prove those qualities.
