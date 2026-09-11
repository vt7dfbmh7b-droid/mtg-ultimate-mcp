# Counter Blitz recovery: user objective and execution handoff

Recorded 2026-09-11 at the user's request. This is a recovery plan, not a validated repair or a promotion decision.

## What we are trying to accomplish

Restore Ultimate MTG's ability to independently produce a coherent, strong Tidus / Counter Blitz upgrade comparable to or better than the older deck the user supplied. The user has spent a week improving the system and a day pursuing repairs without convincing deck-quality progress. More commits, passing narrow tests, longer explanations, or a stronger model are not the outcome they asked for.

The old deck is a held-out comparison, not an answer to feed the builder. Do not hardcode it, seed its winning package, supply it through mustInclude, or optimize card overlap. Independently finding equivalent or better strategic packages counts; reproducing identical cards is not required. Do not promise 100% certainty.

Recovery fixture: stock Counter Blitz with Tidus, Yuna's Guardian; counters, proliferate, dense countermagic, and supported combat plus compact combo routes. Preserve the previously requested official physical Final Fantasy-family printing eligibility, including eligible promotional/special/Secret Lair printings; no budget cap or arbitrary user swap cap. Verify exact original request and eligibility rules before freezing the fixture. Deliver a legal 100-card singleton Bant deck with adequate mana, draw, interaction, and protection. Internal search limits must be reported as implementation limits, not represented as user constraints.

## Authority and current evidence

- Read project-state.json and AGENTS.md first. This document records the user's recovery priority before further unrelated benchmark-breadth work; it does not weaken any validation, workflow, or truth boundary.
- Active experimental branch at recording: agent/v15-native-deck-intelligence. Separate candidate repair branch: agent/counter-blitz-generic-mechanism-floor-20260911. Do not assume those branches contain the same source or silently merge them.
- The authoritative state names accepted product 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7. Preserve that acceptance record. Historical e17b0a1 references are not proof of which code generated the user's old Tidus deck.
- Candidate remote repair checkpoint reported in this session: f92ec2178e3090a62193b895896ef7159ab4b3da. Re-fetch source and reproduce before relying on it. Local and remote commit hashes can differ; never attach evidence to the wrong tree.
- Two synthetic local boundary checks reproduced failures through both core and wrapper. They are not a completed live deck replay, not proof of the entire regression's cause, and not evidence that a repair is finished.
- No validated independent recovery deck has been established by this plan. Existing green narrow tests do not establish it.
- Keep main/stable V0.13 unchanged. Do not merge, promote, or alter PR #29 metadata as part of this recovery handoff. Do not change schedules, workflow files, workflow-freeze controls, or accepted validation records. Documentation on the experimental branch is not a product release.

## Execute in this order

### 1. Establish a reproducible comparison

Record the exact original request, source deck, eligible card-data snapshot, tool entry point, model/provider/settings, code SHA, and execution parameters. Identify whether the old result came from the plugin, assistant reasoning, or their combination; mark unknown provenance explicitly. Preserve the older deck separately for post-generation review only. Freeze baseline and candidate inputs consistently. Do not restart a broad audit or roll back the week's work without causal evidence.

### 2. Turn the two reproduced gaps into meaningful failing tests

| Boundary | Reproduced result | Required behavior |
| --- | --- | --- |
| Under-target theme density | Countermagic starts at 1 against target 8; adding a counterspell cuts the existing counterspell despite an available surplus cut, leaving 1 | A quality-only substitution must not be counted as density repair. Prefer feasible genuine progress while retaining legitimate quality substitutions in their proper role. |
| Whole-package preservation | Proliferate starts at 9 with floor 8; two individually approved cuts leave 7 | Update counts after each accepted swap and audit the final package, so cumulative cuts cannot breach the floor. |

Reproduce failures on the exact pre-fix source, then implement the smallest general correction and show those same assertions pass. Include positive controls for genuine surplus cuts and legitimate substitutions, and negative controls for under-target loss and cumulative floor breaches. Do not change an assertion to accept the defective behavior merely to make the suite green. Earlier test expectations that accepted cutting the last counterspell need substantive review. These are generic mechanism tests, not Tidus/card-name exceptions.

### 3. Trace one complete independent production-path build

Run from the frozen stock input without showing the builder the reference deck. Capture bounded diagnostic evidence at discovery, eligibility filtering, ranking, candidate pairing, package acceptance, and final deck audit. Determine exactly where useful engines or win packages disappear, and why alternatives were rejected.

Return a completed 100-card result or one precise execution blocker. A timeout is an execution failure, not evidence that no improvement exists. Whether full rebuilding is needed instead of bounded refinement is a hypothesis to test, not an established diagnosis.

### 4. Repair only the demonstrated causal bottleneck

Candidate explanations include incomplete discovery, generic utility overriding strategy, failure to evaluate multi-card packages, or an unsuitable refinement/rebuild route. Choose among them from the trace. Change one causal mechanism at a time and compare under controlled inputs. Preserve useful verified improvements. Reject unsupported changes instead of stacking speculative patches or adding card-specific exceptions.

A stronger model is a separate controlled experiment, not a guaranteed fix: hold code, prompt, data, and evaluation constant when comparing models. Do not change model and product logic together and then attribute the result to either one.

### 5. Prove recovery and non-regression before acceptance

Define the rubric, thresholds, repeat count, and seeds/settings before generation. Run focused tests and required full validation against the exact frozen product SHA, then complete the affected blind replay and contrasting fixtures, including budget/graveyard-aristocrat and combat/typal decks where available. Preserve existing benchmark gates and immutable evidence.

Review whole decks, not just scores: card/printing eligibility, legality, mana curve and color reliability, useful interaction, supported engines, access to key pieces, protection, and executable combat/combo finishing routes. Compare the held-out old deck only after independent generation. Check multiple predeclared runs rather than selecting one lucky result. Do not claim match-winning superiority from construction heuristics or mocks alone; report any playtesting evidence separately.

Acceptance requires repeated completed independent builds meeting the agreed rubric, no material control-fixture regression, and a durable manual verdict tied to exact source and replay evidence. If a requested target is infeasible within the eligible pool, demonstrate that from the pool and report it; do not silently lower thresholds after seeing results. Do not confuse provider failures with missing cards.

Only reconcile authoritative acceptance state after these gates pass, using the existing synchronized state/handoff/index process and applicable authorization. No narrow test result or documentation change advances the accepted product checkpoint.

## Stop the repair loop

- Never report "fixed" without completed deck-quality evidence. Distinguish boundary fix, integration result, and accepted recovery.
- Do not repeat a blocked call until its blocker changes. Permission/access failures require direction, not a workaround.
- Do not introduce another speculative product patch without a failing test or trace supporting it.
- Check current and earlier-commit branch-writing runs before writes; respect single-flight execution.
- Preserve failed and successful evidence. Store manual BENCH verdicts outside replaceable generated replay output, following AGENTS.md.
- End every attempt with exact source SHA, what completed, what remains unproven, the blocker if any, and ONE justified next action.
- Documentation and test-count growth are not deck-quality progress. This document should prevent rediscovery, not become another workstream.

## First action for the next agent

Read authoritative state, inspect the active and candidate branches and concurrent runs, and reproduce the two boundary failures on the intended candidate tree with unchanged meaningful assertions. Preserve that evidence, then make only the demonstrated generic correction. Follow with the complete blind production-path build; do not stop at green unit tests or proceed to unrelated benchmark breadth while the user's recovery question remains unanswered.
