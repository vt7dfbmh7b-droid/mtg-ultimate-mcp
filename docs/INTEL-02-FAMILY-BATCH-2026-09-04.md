# INTEL-02 Family Batch — 2026-09-04

## Verdict

**NOT READY FOR CHECKPOINT OR BENCH-01**

The broader INTEL-02 family was executed from one frozen executable source: d51c7b686a92ac3ebfbb0a70d0d1e25f8939b7a1. All result metadata for the family controls records that source SHA; later evidence-writer commits are result-only descendants. No product TypeScript was changed for this batch.

The current accepted development checkpoint remains 77a5383fa7490aa91360b8186a4bda890f632157. Stable main, V0.13.0, and PR #29 were not promoted or merged.

The batch is not manually acceptable yet. The main blocker is a concrete false green in Food and Fellowship, with additional manual holds in Necron Dynasties and Squirreled Away. Marvel remains an honest target-quality ceiling, and the themed-printing lane is provider-unavailable rather than green or red.

## Mechanical family result

| Control | Run | Mechanical result | Manual / interpretation |
|---|---:|---|---|
| Project-state integrity | 33836223170 | pass | Engineering control green |
| Strategy-inference regression | 33836223187 | pass | Engineering control green |
| Necron Dynasties unrestricted refinement | 33836223193 | pass | Hold: Tomb Blade → Lively Dirge needs component review |
| Squirreled Away unrestricted refinement | 33836223192 | pass | Provisional: several accepted cuts have unmodeled role changes |
| Food and Fellowship refinement | 33836223211 | pass | Reject for checkpoint: Well of Lost Dreams → Hobbit's Sting is a false green |
| Scions & Spellcraft FF-only | 33836223174 | pass | Manual pass for this scenario; package fuel and structural floors held |
| Marvel focused Bracket 5 | 33836223188 | fail | Expected honest no-change target failure; zero swaps |
| Marvel broad Bracket 5 | 33836223180 | fail | Expected honest no-change target failure; zero swaps |
| Expanded Middle-earth permanent family | 33836223168 | success | Under target by two brackets; no swaps, so no refinement claim |
| Themed special-printing audit | 33836223208 | unknown | Retried once; Scryfall HTTP 429 both attempts, so verification is unavailable |
| CI | 33836223171 | pass | Build/CI control green |

The permanent Middle-earth printing proof also passed on the same frozen source. The themed audit is intentionally classified as unknown, not absence.

## Manual accepted-swap review

| Lane | Swap | Disposition | Reason |
|---|---|---|---|
| Necron | Shard of the Nightbringer → Myr Retriever | accept | Lower curve and adds artifact/graveyard recursion coherence |
| Necron | Caged Sun → Annihilating Glare | accept | Converts a high-cost mana doubler into cheap interaction without an observed engine loss |
| Necron | Darkness → Dark Ritual | accept with watch | Reasonable fast-mana trade; one-shot acceleration should remain bounded |
| Necron | Tomb Blade → Lively Dirge | hold | Evidence itself reports locally unreplaced artifact-engine roles, including creature/life-drain/sacrifice functions |
| Squirrels | Insatiable Frugivore → Not Dead After All | hold | Current roles leave creature, graveyard-utility, narrow-sacrifice and sacrifice-synergy functions unreplaced |
| Squirrels | Rootcast Apprenticeship → Hangarback Walker | accept | Preserves the counter/token line and improves the creature body |
| Squirrels | Casualties of War → Pest Infestation | accept with watch | Strong token/removal trade, but current role truth under-reports the incoming artifact/enchantment coverage |
| Squirrels | Arasta of the Endless Web → Twitching Doll | hold | Both expose repeatable token production, but the defensive spider/instant-sorcery-trigger function changes materially |
| Food | Great Oak Guardian → Gorbag of Minas Morgul | hold | The team-wide untap/pump finisher is not represented by the aggregate Food metrics |
| Food | Well of Lost Dreams → Hobbit's Sting | reject | Repeatable life-gain-triggered draw is exchanged for one-shot spot removal; the current role output reports no cut roles |
| Food | Crypt Incursion → Weathered Wayfarer | hold | Graveyard-hate/lifegain function is traded for a conditional land tutor without a caller-owned component floor |
| Food | Generous Ent → Samwise Gamgee | accept | Coherent Food/recursion/token replacement with a lower curve |
| Scions | Alphinaud Leveilleur → Arcane Denial | accept | Trades a creature draw body for counterspell/draw while preserving spells-control fuel |
| Scions | Sage's Nouliths → Diabolic Intent | accept | Off-plan equipment/untap/token package becomes a relevant tutor |
| Scions | Ardbert, Warrior of Darkness → Sram, Senior Edificer | accept | Final deck retains multiple equipment/attachment cards, making the draw engine supportable |

The manual deck comparison also confirmed that the current Necron result did not repeat the historical Trazyn/Resurrection Orb failure, and the current Squirrels result retained Second Harvest, Poison-Tip Archer, Moldervine Reclamation and Nadier's Nightblade.

## What blocks promotion

1. Food and Fellowship can pass whole-deck Food support/affinity while spending a repeatable draw engine on a one-shot interaction card.
2. The current generic per-swap roles do not expose all compound or unique engine functions in Necron and Squirreled Away, so aggregate retention is not sufficient for a manual checkpoint.
3. Marvel's restricted construction pool still cannot repair the fast-mana, tutor and verified-win gates; no threshold relaxation or pool expansion is justified.
4. The themed-printing result needs a later provider-available rerun.

## Targeted follow-up — KF-053 correction

The initial batch's Food false green was reproduced as a real role-truth defect. A test-first Well-shaped regression was added at source `f3d63d02d5bb6f9baeb537a39f1f4f5e79d7b634`; the semantic fix landed in source `5c926d8fbe02df8b86f649af460cdd22b515a385`, and the final Food control used source `63b664dc0f93d57c100ea284062a453523aa23dc`.

The role parser now recognizes variable-quantity repeatable draws such as Well of Lost Dreams' `draw X cards` wording, including the specialized life-gain-triggered draw role. The Food control also declares a minimum of two such baseline engines.

The final exact-source Food result (workflow `33855550907`) passed build, deterministic regressions, exact 100-card legality, Middle-earth printings, budget, measurable target improvement, and strategy preservation. Its package acceptance evidence records the declared engine floor as **2 → 2**; the selected package retains both Dawn of Hope and Well of Lost Dreams and no longer accepts Well → Hobbit's Sting. It accepted four swaps, improved average nonland mana value 3.26 → 3.08, early plays 22 → 26, and cheap interaction 5 → 6. Persisted evidence is in `test-results/middle-earth-precon-refine/`.

The post-fix family replay from source `5c926d8fbe02df8b86f649af460cdd22b515a385` is mechanically green for the completed Necron, Squirreled Away, INTEL-01 positive, strategy-inference, precon-generalization, Liliana and CI lanes. Marvel focused and broad remain honest target-quality failures with zero supported improvement; the expanded Middle-earth lane was still executing when this follow-up was recorded.

Manual acceptance is still incomplete. The remaining review holds include Necron's Tomb Blade → Increasing Ambition component loss, Squirreled Away's Insatiable Frugivore → Not Dead After All and Arasta → Twitching Doll role changes, and Food's Crypt Incursion → Weathered Wayfarer graveyard-hate trade. These are separate from the corrected KF-053 false green and remain sufficient to block checkpoint promotion.

## Next action

Keep the accepted development checkpoint at `77a5383...`. Complete the remaining manual family review and resolve the Necron/Squirrels/Food holds before considering a new checkpoint. Keep BENCH-01 gated until the broader INTEL-02 family is mechanically green and manually acceptable. Do not merge or promote PR #29.


## Exact-source replay follow-up — source `5829b37b686255ba35d419b37be17095e54fb696`

After the targeted role-truth corrections, the complete dependent family was replayed from one exact executable source, `5829b37b686255ba35d419b37be17095e54fb696`. The source is a validation marker descendant of the semantic fix; it makes the path-filtered workflows execute the same source without changing runtime behavior. Every family result records this source in its workflow/executed-source metadata. Later branch-head commits are evidence-writer descendants only.

| Control | Run | Result | Interpretation |
|---|---:|---|---|
| CI | 33919245845 | pass | Build and repository control green |
| Strategy-inference regression | 33919245930 | pass | Generic semantic regression control green |
| INTEL-01 positive full-table package | 33919245779 | pass | Positive package/control evidence green |
| Food and Fellowship | 33919245869 | pass | Exact legality, budget, target quality and strategy preservation green |
| Necron Dynasties | 33919245821 | pass | Exact legality, budget, directionality, recursion and artifact-engine gates green |
| Squirreled Away | 33919245870 | pass | Exact legality, budget, combat-token and token-sacrifice gates green |
| Scions & Spellcraft FF-only | 33919245811 | pass | Package fuel, structural floors and policy control green |
| Expanded Middle-earth permanent family | 33919245932 | success | Exact printing-family control green; zero swaps, so no improvement claim |
| Marvel focused Bracket 5 | 33919245868 | fail closed | Zero swaps; target-quality gate remains honestly red |
| Marvel broad Bracket 5 | 33919245819 | fail closed | Zero swaps; target-quality/strategy gates remain honestly red |
| Themed special-printing audit | 33919245834 | provider-unknown | Scryfall HTTP 429; not evidence of absence or a product regression |
| Liliana NZ$500 whole-deck challenge | 33919245800 | supplementary pass | Useful budget evidence, not promoted to a separate family registry claim |

### Manual deck disposition

- Food and Fellowship no longer accepts the old Great Oak Guardian or Well of Lost Dreams false greens. Great Oak and Well remain in the final deck. The accepted package keeps the Food/lifegain/draw/token backbone; Feasting Hobbit → Hobbit's Sting and Lobelia → The Sackville-Bagginses remain incidental-role watch items, not declared-core losses.
- Necron retains the commander-facing artifact/reanimation spine, including Trazyn the Infinite, Resurrection Orb and Tomb Blade. The Triarch Stalker → Increasing Ambition package has a local artifact-engine watch, but the final deck remains substantively artifact/reanimator dense.
- Squirreled Away retains the principal token/death-payoff spine, including Second Harvest, Poison-Tip Archer, Moldervine Reclamation and Nadier's Nightblade. Rootcast Apprenticeship → Not Dead After All loses an incidental counter mode and is accepted with that watch.
- Scions retains meaningful equipment/attachment support after the three accepted swaps, so the Sram draw role is supportable in the final list.

This replay therefore shows consistent positive controls and honest negative/ceiling behavior from one source, with no previously identified Food false green resurfacing in manual review. It is not a new INTEL-02 checkpoint: the two Marvel target-quality controls remain red by policy, and the themed printing truth control is still provider-unknown.

## Current disposition

Keep the accepted experimental checkpoint at `77a5383fa7490aa91360b8186a4bda890f632157`. Keep BENCH-01 gated pending a future replay with the themed provider available and a policy-level decision on the restricted Marvel ceiling. Stable `main` remains V0.13.0, and PR #29 remains an open draft/unmerged experimental record.
