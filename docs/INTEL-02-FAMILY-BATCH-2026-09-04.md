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

## Next action

Make one targeted semantic-preservation correction for the observed repeatable draw/resource blind spot, add anonymous regression coverage, then rerun the entire INTEL-02 family from a new frozen source and repeat the manual deck pass. Keep BENCH-01 gated until that family is mechanically green and manually acceptable.
