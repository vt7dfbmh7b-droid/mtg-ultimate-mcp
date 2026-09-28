# Counter Blitz recovery status

**28 September 2026 — Stage 1 published; Stage 2 software safeguards verified; review complete.**

Read START-HERE.md and docs/STAGE-2-SAFEGUARDS.md. Publication and Stage 2 tests/existing CI are approved. Stage 1 commit e91b8877 passed state/build checks; CI 36456549050 had 1127 passes and one historical-registry classification failure. Stage 2 corrects that classification without workflow or integrity-test changes. Recognition repair and schedules remain paused. Evidence descriptions below are the preserved Stage 1 findings.

## Objective and boundaries

Independently upgrade untouched Counter Blitz stock with Tidus under legal exact-100 Bant and eligible physical Final Fantasy printing constraints. Preserve counters, proliferate, countermagic, combat, protection and White Mage/Walking Ballista access. Supplied and historical Tidus builds remain evaluation-only: no seeds, templates, must-includes or card-name hacks.

Active experimental branch: agent/counter-blitz-generic-mechanism-floor-20260911. Main/stable V0.13, PR #29, workflows, workflow guard, policy epoch and schedules remain unchanged. A proposed B4 practical milestone does not replace the original B5 challenge. Do not introduce a new budget or weaken existing benchmark assertions.

## Source and acceptance distinctions

| Item | Exact source / status |
| --- | --- |
| Broad accepted Commander baseline | 1ef10cec8c50d3d576cb1c3ae3c2566a4f632aa7; retained |
| Narrow accepted compound-progress repair | 43e9c1c80dadfea4d53ed1a2affebd90131e362f; retained |
| Completed diagnostic source | 4be988f0cd99015fb9e18207ae574158bf402f73; candidate identities and rejection examples exist |
| Latest recorded executable benchmark source | 8606761c4d2e29cebb980bb06520b6aced459a1b; explicit B4 runner option, not a recognition repair |
| Existing CI | 36311443690; completed success on source 8606761c |
| Existing B5/Liliana Batch A | 36311443685; execution success, B5 target quality incomplete |
| Remote evidence writer/base for this proposal | 34109290ba41693d9184ec21768fa65079302409 |

The development checkpoint remains the accepted narrow repair. A later source with green execution is not automatically a new accepted Commander baseline.

## Existing results

| Measurement | B4 local comparison | B5 Batch A |
| --- | --- | --- |
| Legal exact 100 / FF printing observations | Pass | Pass |
| Net swaps | 15 | 28 |
| Engine-assessed bracket | 3 / target 4 | 3 / target 5 |
| Countermagic | 6/8 | 10/8 |
| Protection | 7/8 | 7/8 |
| Counters / proliferate / combat counts | 48 / 5 / 14 | 44 / 5 / 14 |
| White Mage / Ballista access | Recorded present | Recorded present |
| Recorded capture/replay equality | Two fresh processes; no network fallback | Two fresh processes; no network fallback |
| Quality verdict | Incomplete target achievement | Incomplete target achievement |

B4 also misses its inherited 20-swap assertion and stops at all-competing-packages-below-improvement-threshold. B5 stops at no-supported-swaps-found. More swaps are not independently proof of stronger construction. These existing role counts are affected by recognition defects; they are not corrected functional truth or independent bracket certification.

Both use retained evaluation time 2026-09-12T08:30:39.498Z. B4 used Node 24.19.0 locally; CI is pinned to Node 22.23.2. Do not claim a fully runtime-matched B4/B5 comparison or current price/source freshness.

## Confirmed next product defects

- Saved anonymous public-planner evidence recognizes “Counter target spell” but misses “Counter target noncreature spell.” Source matching and candidate queries need consistent generic treatment.
- Saved anonymous evidence recognizes literal land search but misses Forest-type search. The B4 trace permits an outgoing Three Visits with empty roles. Missing loss accounting is the defect; do not hard-code protection for that card.
- Saved B4 evidence also exposes conditional transform/search credit. Sidequest requires four Birds before transformation. Beneficiary handling and contextual tutor value need bounded follow-up after the first repair.

Generic self-reference and compound-progress repairs already exist. Candidate diagnostics already exist. Do not repeat them or assert FF pool exhaustion from role-count scarcity.

## Evidence preservation and next action

See docs/STAGE-1-EVIDENCE.md and the preservation manifest under test-results/bench01-bracket4-comparison/8606761c4d2e29cebb980bb06520b6aced459a1b/. B4 results, traces, provider capture, decks, log and reproducer are preserved in this proposed package. Existing B5 evidence is already committed at the remote base.

Two older local cache copies were incomplete. The original GitHub artifact was recovered and archive/snapshot hashes match the recorded originals. Use the recovered paths in the inventory; do not reuse the incomplete caches.

**Next:** STOP at the completed Stage 2 review (docs/STAGE-2-REVIEW.md). Stage 3 recognition repair needs separate approval. Preserve other open Commander failures separately; whole-deck review remains required before acceptance. No Commander baseline or target has advanced.
