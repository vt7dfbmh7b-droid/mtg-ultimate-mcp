# Counter Blitz recovery status

Reconciled 2026-09-27 from the exact-source frozen run. This supersedes the September 24 checkpoint.

## Objective and boundaries

Independently upgrade untouched Counter Blitz stock with Tidus under legal 100-card Bant and eligible physical Final Fantasy printing constraints. Preserve counters, proliferate, countermagic, combat, protection and the White Mage/Walking Ballista route. Historical Tidus decks stay held out: no seed, must-include list or card-name hack.

Work only on `agent/counter-blitz-generic-mechanism-floor-20260911`. Main/stable V0.13, PR #29, workflows, workflow guard and policy epoch remain unchanged. Development schedules were observed paused on September 22; no schedule changes were made.

## Completed evidence

- Product source: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`.
- Exact CI: `35959975121`; 1,127 tests passed, zero failed, one skipped. Local exact-source suite matched.
- Frozen Counter Blitz + Liliana Batch A: `35959975135`, completed successfully. Project-state writer: `35959975065`, completed successfully.
- Persisted evidence: `56ef00294482ca63c37ebe25660721efa5b97b2f` under `test-results/bench01-batch-a/`.
- The generic compound-theme repair carries a verified under-target component gain through the final aggregate gate; aggregate OR coverage no longer vetoes it. An anonymous public-planner regression covers the case. Revision: `compound-progress-preservation-v6`.
- Counter Blitz replay: two fresh processes, identical deck/metrics, no network fallback. Retained evaluation time is September 12, not current provider freshness.

## Result, not full recovery

Counter Blitz is legal 100 with eligible FF physical printings and 28 net swaps. White Mage and Walking Ballista are both retained. Measured counters 44/16, proliferate 5/3, countermagic 10/8 and combat 14/8 pass; protection is 7/8 and the engine-assessed bracket is 3 against target 5. The hybrid strategy floors, combo access, and substantial-upgrade gate pass. Quality remains `incomplete-target-achievement`; termination is `no-supported-swaps-found`.

The remaining Bracket-5 construction gates are fast mana (1/3) and tutors (1/4). The final retained-pool trace reports 429 eligible cards, one fast-mana role match and two tutor role matches before existing/excluded filtering; only one tutor candidate is available for another slot. Protection discovery reports 18 role matches and five selected candidates, but none forms a supported package in the final round. These counts identify candidate scarcity and package rejection, not a proven card-pool ceiling: the persisted final trace does not include candidate names or detailed pairing rejection reasons.

Liliana remains legal 100, NZD 467.61 against its retained NZD 500 budget, assessed high bracket 4. Passing construction thresholds does not certify bracket 5 or competitive performance.

## Verdict and next action

Accept the generic compound-progress repair, not full recovery or a new broad Commander baseline. Accepted baseline remains `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`. Durable complete-deck review: `test-results/bench01-manual-verdicts/43e9c1c80dadfea4d53ed1a2affebd90131e362f.md`.

Next, expose names and rejection reasons for the retained legal tutor/protection/fast-mana candidates through the public planner trace. Then distinguish role-classification misses, incompatible candidate/cut packages and a genuinely exhausted FF-only pool. Keep all target gates, legality, strategy preservation and held-out isolation intact. Do not repeat snapshot setup, fixed self-reference work or the completed compound-progress case. Do not assert the pool ceiling until candidate alternatives and their rejections are audited.
