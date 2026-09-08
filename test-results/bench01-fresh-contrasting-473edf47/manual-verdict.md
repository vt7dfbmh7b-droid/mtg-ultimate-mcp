# BENCH-01 fresh contrasting batch — frozen 473edf47

Date: 2026-09-08  
Product source tested: `473edf473a284b9532aa03747abfa41a1081ca2c`  
Accepted Commander baseline before this batch: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`  
Source frozen within batch: yes  
Commander-intelligence changes between fixtures: none

## Batch purpose

Test three genuinely fresh, contrasting stock-precon problems from one unchanged post-Aura-repair product source:

1. Rakdos group-slug/punisher with unusual commander incentives and explicit natural-language preferences.
2. Dimir graveyard/reanimator control with a compound controlled theme.
3. Bant Clue/artifact value-control with a compound controlled theme.

All stock lists came from exact MTGJSON precon resolution. All executable final lists were inspected in full, not scored only by machine checks.

## Fixture verdicts

### Endless Punishment — Valgavoth, Harrower of Souls

Request: Bracket 4, at most NZ$50/card and NZ$250 total, at most 12 swaps; preserve “group slug punisher opponents lose life” while improving card draw and interaction.

Execution result: `unsupported-theme`; 0 swaps.

The controlled adapter rejected: `group`, `punisher`, `opponents`, `lose`, `life`, and `interaction`. This is a product semantic-taxonomy failure, not a provider, harness, printing, legality, or restricted-pool failure.

Stock/final machine facts (unchanged):

- 100 cards, Commander legal, fully resolved.
- Assessed Bracket 2, not requested Bracket 4.
- Average nonland MV 3.50; early plays 21; fast mana 1.
- Cheap interaction 3; total interaction 12; wipes 2.
- Ramp 14; draw 14; recursion 2; protection 1.
- No verified winning combo.

Manual assessment:

- The stock deck retains its legal Rakdos punisher identity only because no refinement occurred.
- There is no target movement and therefore no target achievement.
- Common Commander archetype language was not understood despite a strong general-purpose model being able to interpret Valgavoth’s “opponents lose life during their turns” incentive and propose coherent cuts/additions.
- Specialist-vs-general-AI verdict: **general-AI clear win**.

### Revenant Recon — Mirko, Obsessive Theorist

Request: Bracket 3, “graveyard and card draw,” at most NZ$50/card and NZ$250 total, at most 12 swaps.

Execution result: `refined`; 7 swaps; estimated spend NZ$74.63; stopped because no more supported swaps were found.

Swaps:

1. Massacre Wurm → Sword of Once and Future
2. Phyrexian Metamorph → The Cruelty of Gix
3. Twilight Prophet → Sword of Light and Shadow
4. Vizier of Many Faces → Lively Dirge
5. Sphinx of the Second Sun → Sword of Fire and Ice
6. Foreboding Steamboat → Increasing Ambition
7. Grave Titan → Padeem, Consul of Innovation

Before → after:

- 100 cards, Commander legal, fully resolved; Mirko preserved.
- Assessed bracket: 2 → 2. Requested Bracket 3 was **not achieved**.
- Average nonland MV: 3.49 → 3.30.
- Early plays: 26 → 27.
- Cheap interaction: 1 → 1; total interaction: 11 → 12.
- Tutors: 0 → 3; recursion: 12 → 17.
- Draw: 37 → 40; protection: 0 → 4.
- Ramp 12 and wipes 2 unchanged.
- No verified winning combo before or after.

Manual whole-deck assessment:

- Legal size, color identity, budget, swap cap, and aggregate compound-theme audit passed.
- The deck still has adequate mana quantity and substantial surveil/reanimation density, but it did not repair the glaring one-card cheap-interaction count or reach the requested bracket.
- The swap package removes several powerful reanimation targets/value engines and a flexible clone: Massacre Wurm, Twilight Prophet, Sphinx of the Second Sun, Grave Titan, Phyrexian Metamorph, and Vizier of Many Faces.
- Three Swords create an unsupported combat/equipment subpackage in a Mirko reanimator deck. Padeem protects a small artifact subset and is a particularly weak replacement for Grave Titan.
- The optimizer labels these as “protection” while ignoring equip costs, creature connectivity, artifact density, and Mirko’s need for high-value creatures with favorable power.
- The Cruelty of Gix and Lively Dirge are coherent additions; Increasing Ambition is defensible but slow. Those wins do not rescue the package.
- Original identity survives at deck level, but replacement quality and role balance are materially worse than the counted metric gains imply.
- Target movement is partial (curve, recursion, nominal protection); target achievement is false.
- Specialist-vs-general-AI verdict: **general-AI clear win**. A strong general AI would preserve premium reanimation bodies, add efficient surveil/discard and stack/removal interaction, and avoid a disconnected three-Sword package.

### Deep Clue Sea — Morska, Undersea Sleuth

Request: Bracket 3, “artifacts and card draw,” at most NZ$50/card and NZ$250 total, at most 12 swaps.

Execution result: `refined`; 8 swaps; estimated spend NZ$67.88; stopped because no more supported swaps were found.

Swaps:

1. Erdwal Illuminator → Sword of Fire and Ice
2. Inspiring Statuary → Tamiyo’s Journal
3. Merchant of Truth → Staff of Compleation
4. Knowledge Is Power → Veil of Summer
5. On the Trail → Shelter
6. Shimmer Dragon → Archmage Ascension
7. Tangletrove Kelp → Padeem, Consul of Innovation
8. Hornet Queen → Tezzeret, Artifice Master

Before → after:

- 100 cards, Commander legal, fully resolved; Morska preserved.
- Assessed bracket: 3 → 3. The deck began at the requested bracket, so this is preservation rather than demonstrated upward achievement.
- Average nonland MV: 3.70 → 3.54.
- Early plays: 19 → 19.
- Cheap interaction: 1 → 1; total interaction: 8 → 10.
- Tutors: 0 → 3; draw: 17 → 22; protection: 0 → 4.
- Ramp: 16 → 17; wipes 3 unchanged.
- No verified winning combo before or after.

Manual whole-deck assessment:

- Legal size, Bant identity, budget, swap cap, and aggregate compound-theme audit passed.
- The mana base remains functional but tapland-heavy; the package makes no mana-quality improvement.
- Tamiyo’s Journal and Tezzeret, Artifice Master are on-plan. Veil of Summer is excellent but situational; Shelter is narrow.
- Erdwal Illuminator, Inspiring Statuary, Knowledge Is Power, Shimmer Dragon, and Tangletrove Kelp are central Clue/artifact payoffs or engines. Removing them reduces the deck’s specific identity and commander-support density.
- Archmage Ascension is famously slow and table-visible without dedicated counter acceleration. Padeem is serviceable but does not compensate for losing Tangletrove Kelp’s Clue conversion engine. Sword of Fire and Ice is powerful yet generic and less synergistic than Erdwal Illuminator.
- The aggregate “Artifacts + Card draw” gate is too permissive: mana rocks and cycling lands count, and matching either side of the OR can conceal loss of the specific Clue engine. Aggregate density is not proof that each requested component improved.
- The deck remains playable and Bracket 3, but the package is a strategy-preservation weakness and does not convincingly improve the requested Clue/artifact plan.
- Specialist-vs-general-AI verdict: **general-AI clear win**. A strong general AI would retain the best repeatable Clue engines, improve efficient interaction and mana, and cut lower-impact generic top-end first.

## Cross-fixture classification

- Harness/infrastructure failures: none in the production MCP path. A local `tsx` IPC launch failed once with EPERM; rerunning the same script through `node --import tsx` completed and does not affect product verdicts.
- Provider/source failures: none.
- Printing uncertainty: none material.
- Legality/constraint failures: none for executable outputs.
- Restricted-pool ceilings: not applicable; all were unrestricted within budget ceilings.
- Target achievement: false for Endless Punishment and Revenant Recon; Deep Clue Sea preserved its existing Bracket 3 but did not prove meaningful target improvement.
- Specialist comparison: three general-AI clear wins.

## Repeated generic weakness and repair threshold

Two unrelated executable strategies independently show the same defect: **replacement-priority and contextual role inference allow abstract role-count gains to outrank commander-specific engine density, card connectivity, and role effectiveness**.

Concrete repeated evidence:

- Sword of Fire and Ice and Padeem were selected in both unrelated decks.
- “Protection” credit did not account for equip/connectivity requirements or artifact density.
- High-impact strategy engines were cut while aggregate theme and role counters still improved.
- Cheap interaction remained at 1 in both supported-theme decks despite requested target pressure.
- Aggregate compound-theme OR coverage can remain green while a strategically essential component degrades.

This crosses the generic-repair threshold. It does not justify a card-name exception, commander exception, fixture label, or simply higher candidate breadth.

## Exact next action

Add production-path regressions for contextual replacement quality:

1. A protection candidate must receive context-sensitive effectiveness, including whether it can protect the commander/engine in this deck without unsupported setup.
2. Replacing a commander-specific engine/payoff must require same-role or same-component compensation, not merely aggregate theme membership.
3. Compound theme evidence must expose per-component before/after movement rather than treating aggregate OR density as sufficient.
4. Cheap-interaction target pressure must not be bypassed by unrelated tutor/protection count gains.

Then implement the smallest generic repair, run focused and full validation, freeze the exact green repair SHA, and replay these affected fixtures plus at least one unchanged control before any baseline acceptance, merge, or promotion.

## Acceptance status

The Aura target-shape product commit `473edf473a284b9532aa03747abfa41a1081ca2c` remains fully validated for its repair and was the exact tested source. This fresh batch does **not** justify promoting it to the accepted Commander baseline, because broader replacement-quality evidence is poor. Stable/current remains V0.13 and PR #29 remains unmerged.
