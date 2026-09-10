# BENCH-01 manual verdict — ca4c4fa4c3ede1be7bf053919fcc686ae5d11fb0

## Source and replay

- Product source SHA: `ca4c4fa4c3ede1be7bf053919fcc686ae5d11fb0`.
- Exact CI run: `34445226825` — full CI success.
- Frozen replay request commit: `06b8b897b293540ea44d09d7134bdd38539dacb8`.
- Persisted replay evidence commit: `ab08ddba4993368e89b92cc510bb55904b8b9de2`.
- Replay metadata records exact product source `ca4c4fa4...`, `src/**` verified equal to the frozen product SHA, successful execution, and source frozen within batch.
- Review bundle contains the five strategy-anchor/diversification fixtures plus affected Revenant Recon and Deep Clue Sea complete final decks.

## Decision

**REJECT `ca4c4fa4...` as the accepted Commander baseline. Retain its generic candidate-discovery/ranking work as useful engineering progress, but whole-deck strategy preservation is still not good enough.**

The candidate does improve the prior generic-candidate pressure in Revenant Recon: the final Mirko list now has two Swords rather than the three-Sword package seen at `28efcb47...`, and it adds more directly graveyard-aligned cards such as `Lively Dirge` and `Increasing Ambition` while retaining `Massacre Wurm` and `The Cruelty of Gix`.

However, the complete production output exposes a more serious OUT-card preservation failure. The accepted swap list explicitly removes `Animate Dead` for `Curator's Ward`. `Animate Dead` is a core, direct reanimation engine for Mirko's graveyard plan; `Curator's Ward` is generic permanent protection/value and is not remotely an equivalent strategic replacement. This is exactly the kind of replacement-priority failure that aggregate role counts and incoming-card affinity cannot excuse.

Therefore the candidate has not demonstrated whole-deck superiority and cannot replace accepted Commander baseline `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.

## Affected-fixture whole-deck review

### Revenant Recon / Mirko

- Exact 100 cards, Mirko retained as commander, and replay output is legal/resolved.
- High-impact reanimation payload preservation from the earlier repair remains: `Massacre Wurm`, `Grave Titan`, `Overseer of the Damned`, `Doom Whisperer`, `Dream Eater`, `Ravenous Chupacabra` and `Shriekmaw` remain present.
- Direct graveyard/reanimation support also includes `Reanimate`, `Necromancy`, `The Cruelty of Gix`, `Lively Dirge`, `Connive // Concoct`, `Charnel Serenade`, `Otherworldly Gaze`, `Enhanced Surveillance`, `Master of Death` and the surveil package.
- Candidate breadth is better than `28efcb47...`: `Sword of Fire and Ice` is no longer present, while `Lively Dirge` and `Increasing Ambition` appear.
- The remaining generic-value pressure is still visible through `Sword of Once and Future`, `Sword of Light and Shadow`, `Padeem, Consul of Innovation` and `Curator's Ward`.
- The decisive failure is not merely package taste: the serialized accepted swap is `Animate Dead` OUT → `Curator's Ward` IN. This actively removes one of the deck's most important reanimation mechanisms to fill a generic protection deficit.
- Another questionable trade is `Phyrexian Metamorph` OUT → `Sword of Once and Future` IN. That is less severe than losing `Animate Dead`, but it reinforces that structural-role pressure can still override direct commander-plan value.
- `Rise of the Dark Realms` OUT → `Increasing Ambition` is defensible as curve/tutor compression at this power level, while `Vizier of Many Faces` OUT → `Lively Dirge` is directly aligned and useful.
- Overall the deck has moved in the right direction versus `28efcb47...`, but not enough to count as target achievement. A strong Commander builder should not cut `Animate Dead` from this Mirko shell for generic protection.
- Specialist-vs-general-AI verdict improves from the earlier **general-AI clear win** to **general-AI slight win**, not equality or a specialist win. The specialist now shows substantially better graveyard candidate discovery, but replacement preservation still loses on a core engine card.

### Deep Clue Sea / Morska

- Exact 100 cards, Morska retained, legal/resolved replay output.
- Important earlier semantic gains remain intact: `Erdwal Illuminator` and `Inspiring Statuary` both survive, alongside `Academy Manufactor`, `Mechanized Production`, `Kappa Cannoneer`, `Thought Monitor`, `Tamiyo's Journal`, `Transmutation Font` and the Clue/token shell.
- The deck still retains `Padeem, Consul of Innovation` and `Sword of Fire and Ice`, so some generic artifact/combat-value pressure remains, but this package is less disconnected here than in Mirko because the deck genuinely has a large artifact-token engine.
- Existing comparison remains approximately **general-AI slight win**; no evidence here justifies claiming specialist superiority.

## Control-family interpretation

- Quick Draw, Virtue and Valor, Explorers of the Deep, Elven Empire and Animated Army executed successfully from the same frozen source and remain useful contrasting regression controls.
- They are not counted as new specialist-vs-general-AI wins without separate complete comparator evidence.
- Their successful execution does not override the affected-fixture whole-deck strategy-preservation failure.

## Cross-fixture diagnosis

The prior candidate-discovery problem is materially improved, but the remaining generic defect is now more precise:

**OUT-card mechanism importance / replacement preservation can be underweighted when a structural deficit proposes an incoming card with good generic role/affinity evidence.**

The production planner is capable of finding better reanimation candidates, yet can still spend an accepted swap by removing a core engine (`Animate Dead`) for generic protection (`Curator's Ward`). This is stronger evidence than a candidate-discovery complaint because it is visible in the actual serialized OUT/IN production result.

The deficient generic capability is therefore **relative replacement quality with explicit outgoing mechanism importance**, not card discovery and not an Equipment-specific rule.

## Exact next action

1. Reproduce the `Animate Dead`-class loss through the actual `buildSimulationBackedUpgradePlanV07` / precon production path using anonymous Oracle-shaped cards and realistic generated role/strategy summaries.
2. Include a core outgoing commander/request mechanism card, a safer filler cut, and a generic incoming structural-role/protection card; require the planner to choose the safer filler rather than sacrifice the core mechanism.
3. Include a positive control where the outgoing card is genuinely low-mechanism filler so generic protection remains selectable; do not globally suppress protection, Auras or Equipment.
4. Trace the serialized OUT-card mechanism/strategy evidence at the final pairing/cut-ranking layer. A hand-authored pairwise helper test is insufficient if the public planner behaves differently.
5. Only after a faithful failing production regression, implement the smallest generic outgoing-mechanism preservation repair; then require focused + full exact-commit validation, frozen affected/control replay, and complete-deck manual review.
6. Keep accepted baseline `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`, PR #29 unmerged, and stable/current V0.13 unchanged.

## Promotion status

- `ca4c4fa4...`: exact CI green, frozen replay successful, **manual baseline rejection**.
- Proven improvement: broader candidate discovery/ranking and reduced generic Equipment pressure in Revenant Recon.
- Proven unresolved weakness: core outgoing reanimation mechanism can still be cut for generic structural protection/value.
- Accepted Commander baseline: `e17b0a1cba659b229fd6f0b6e2df79c5e464a616`.
- PR #29: not promotion-ready.
- Stable/current V0.13: unchanged.
