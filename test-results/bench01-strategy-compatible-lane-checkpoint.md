# BENCH-01 strategy-compatible candidate lane — durable checkpoint

Status: **formally validated; Commander-product acceptance pending mandatory frozen-source replay/manual review**.

## Exact product source

- Product SHA: `d7b203ce14161875720c72290a7adbcc12129cde`
- Generic repair: within an already-required structural role/target gate, prefer strategy/request-identity-compatible candidates; use generic structural candidates only as fallback when the aligned lane yields zero actually eligible printings after printing/price checks.
- Product logic remains generic: no fixture names, commander names, card-name exceptions, or benchmark-label branches.

## Completed validation

Immutable CI run `34067059640` passed project-state tooling type-check, automation/E2E scripts type-check, project-state validation, validation-index validation, recovery smoke testing, production build, focused cross-archetype strategy-compatible-lane regressions, and the complete repository test suite.

Additional checked-in-source generalization controls already completed successfully on this lineage include exact Squirreled Away and exact Necron Dynasties stock-precon refinement, with legality/command-zone/budget truth, measurable whole-deck target improvement, and strategy-preservation gates green.

The Marvel-only Bracket-5 refinement control remained fail-closed with zero supported swaps and no target achievement. This is consistent with the previously documented restricted-pool construction ceiling and is not evidence that the new strategy-compatible lane failed.

## Mandatory replay in progress

Workflow run `34067122529` is executing the five-fixture replay from frozen product SHA `d7b203ce14161875720c72290a7adbcc12129cde`.

Frozen-source proof passed before generation (`src/**` in the replay wrapper matched the product SHA exactly). Fixtures:

- Quick Draw
- Virtue and Valor
- Explorers of the Deep
- Elven Empire
- Animated Army

Do **not** accept the product SHA merely because formal validation is green. Wait for replay evidence to persist, inspect all five complete final decks, and compare directly against `test-results/bench01-strategy-anchor-replay/manual-verdict-27a2fab.md`.

## Acceptance boundary

Accepted Commander baseline remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616` until the new lineage passes mandatory manual whole-deck quality acceptance. PR #29 remains unmerged and stable/current remains V0.13.

## Exact next safe action

1. Resume workflow run `34067122529`; do not restart it while it is valid and still running.
2. If it completes successfully, fetch persisted `test-results/bench01-strategy-anchor-replay/review/summary.json` and all five final decklists.
3. Manually assess legality/size, mana, curve, ramp/draw/interaction/protection/removal/wipes, synergy density, commander support, strategy preservation, replacement quality, role balance, combo/win routes, resilience, and actual target achievement.
4. Compare against the prior rejected five-deck evidence. Specifically verify that generic role-only padding is materially reduced in Stella Lee spellslinger, Ellivere enchantment-combat, Hakbal Merfolk/counters, Lathril Elf typal, and Bello high-MV artifact/enchantment identity.
5. Record specialist-vs-general-AI verdicts where evidence is sufficient.
6. Only if whole-deck quality materially improves without structural regressions should `d7b203ce...` replace the accepted Commander baseline. Otherwise record it as formally green but manually rejected and isolate the next repeated generic weakness before another product repair.
