# BENCH-01 Batch D candidate-breadth diagnostic — 2026-09-06

## Purpose

Test whether the terminal Batch D component-preservation vetoes were caused by the downstream correctness guard itself or by bounded upstream package diversification. No Commander product intelligence changed. The diagnostic used the same frozen executable product source as Batch D, `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`, and changed only `candidatePackagesPerRound` from 4 to the currently supported maximum of 6.

The source-freeze guard, repository tests, build, and diagnostic execution all passed in Actions run `34019315945` at wrapper SHA `d78770f7934fcb8b472dd37c5e7ca5c0bed2a737`. The full raw result is retained in Actions artifact `9985050796`. The first persistence attempt exposed a harness-only provenance defect: runtime result/log files were reset before they were copied into `test-results`, producing empty committed copies even though the uploaded artifact was complete. Workflow commit `18f47aec4d3a1109cb26a88d51960dd5100b0ac9` stages runtime evidence outside the checkout before reset; its rerun is the persistence verification gate. This defect does not invalidate the uploaded diagnostic artifact or change product validation status.

## Result

| Fixture | Batch D breadth 4 | Diagnostic breadth 6 | Interpretation |
| --- | --- | --- | --- |
| Quick Draw | 8 swaps, Bracket 3 | 8 swaps, Bracket 3 | Unchanged control. More package breadth did not alter the bounded outcome. |
| Virtue and Valor | 4 swaps, Bracket 2 | 4 swaps, Bracket 2 | Unchanged. Terminal candidates still regress requested compound-theme component floors, supporting a legitimate bounded construction ceiling rather than a preservation-guard defect. |
| Explorers of the Deep | 4 swaps, Bracket 2 | **9 swaps, Bracket 3** | Material breadth sensitivity: +5 accepted swaps and +1 assessed bracket under otherwise unchanged inputs. Broader diversification found component-preserving accepted paths that breadth 4 did not surface. |

Explorers remained Commander-legal and its final controlled compound theme remained satisfied. Its final deck had 52 aggregate theme matches across the requested Merfolk typal / +1/+1 counters / card draw / combat facets. The run still terminated later when the remaining generated packages were ineligible; terminal rejected candidates continued to show genuine requested-component floor regressions. Therefore the preservation gate is still doing required correctness work.

## BENCH verdict

This is evidence of **candidate-discovery/package-diversification sensitivity**, but it is not yet repeated across multiple unrelated problem fixtures. Explorers improves materially at supported breadth 6; Virtue does not, and Quick Draw remains unchanged as the control. Per BENCH-01 rules, one positive fixture is insufficient to authorize a generic discovery/ranking product repair.

Do **not** weaken `candidateCompoundThemeComponentGateV15`. Do **not** treat increasing package breadth in a benchmark harness as a validated product fix. The correct next evidence gate is a frozen-source unseen batch that includes at least one other component-rich typal/theme fixture and one unrelated non-typal compound-theme fixture. If breadth sensitivity repeats across unrelated families, a generic candidate-discovery/ranking repair may then be justified. If it does not, record Explorers as a bounded-search sensitivity and continue broad BENCH coverage without changing product intelligence.

## Product/status boundary

- Latest fully validated Commander product remains `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.
- The diagnostic wrapper/evidence heads are not newer validated product baselines.
- Counter Blitz dense-countermagic allocation remains watch-only; this diagnostic does not reproduce or reopen it.
- PR #29 remains unmerged.
- Stable/current remains V0.13.
- V0.15 remains not promotion-ready pending broader adversarial evidence.
