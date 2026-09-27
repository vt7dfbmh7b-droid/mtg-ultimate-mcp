# BENCH-01 manual verdict — Counter Blitz recovery

- Reviewed: 2026-09-27
- Exact product source: `43e9c1c80dadfea4d53ed1a2affebd90131e362f`
- Frozen evidence: Batch A run `35959975135`, persisted on active branch at `56ef00294482ca63c37ebe25660721efa5b97b2f`
- Exact-source CI: `35959975121` (1,127 passed, 0 failed, 1 skipped)
- Evaluation timestamp: 2026-09-12; two fresh processes produced identical output using the retained snapshot with no network fallback. This establishes deterministic replay, not current provider freshness.

## Counter Blitz

The complete resulting list remains exactly 100 cards, Commander legal and compliant with the eligible Final Fantasy physical-printing policy. The 28 net swaps retain Tidus, White Mage and Walking Ballista; the recorded route includes the White Mage/Ballista line and Gatta/Luzzu with Hardened Scales. The hybrid counters/proliferate/combat floors pass: counters 44/16, proliferate 5/3, countermagic 10/8 and combat 14/8. The substantial-upgrade gate also passes.

The requested protection target is still short at 7/8. The engine assessor reports bracket 3 against requested target 5. Final construction gates still failing are fast mana 1/3 and tutors 1/4. The final round stops `no-supported-swaps-found`; protection discovery had 18 role matches and five selected candidates, while the restricted pool reports 429 eligible names, one fast-mana role match and two tutor role matches before existing/excluded filtering. These summary counts do not show candidate identities or detailed pairing rejection reasons, so they do not prove that the full pool is exhausted. No competitive certification is warranted.

The frozen benchmark used evaluation time 2026-09-12, so it is not a fresh provider evaluation. Liliana is a separate scenario: legal 100, NZ$467.61 under the retained NZ$500 cap, assessed high bracket 4. Its pass does not offset Counter Blitz's unmet targets.

## Verdict

Accept the narrow generic compound-component progress repair. The public planner now carries verified per-component progress through the final aggregate gate while retaining component and aggregate checks; the anonymous regression and exact-source CI passed. The resulting Counter Blitz deck is useful measured progress, but it does not satisfy full recovery and does not replace accepted Commander baseline `1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7`.

## Next justified action

Improve the retained public-planner trace to identify eligible tutor, protection and fast-mana candidates and record why no candidate/cut packages survived. Then determine whether the cause is role classification, package compatibility or true FF-pool scarcity. Keep the B5 and protection targets, legality, strategy requirements and held-out historical Tidus isolation unchanged. Do not claim a pool ceiling before that audit.
