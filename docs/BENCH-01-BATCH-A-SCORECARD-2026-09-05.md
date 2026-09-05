# BENCH-01 Batch A Scorecard — 2026-09-05

## Purpose

Batch A is the first adversarial specialist-vs-strong-general-AI comparison for the V0.15 experimental Commander intelligence. The product runtime is frozen at `5829b37b686255ba35d419b37be17095e54fb696`; specialist evidence was executed from the harness/docs-only descendant `da0eede5ae2173cd75495385338678dfc4ced873`. No `src/**` intelligence change was made during this batch.

The independent general-AI baselines were locked before specialist result inspection. The final corrected comparison source is `6264e7f0fcf59c8bfb64bda2baebc8d8e625b8c0`; the persisted evidence commit is its bot descendant. The Liliana V1 99-card failure remains retained, and V2 only corrected the card count by adding one Swamp plus a non-strategic front-face lookup alias for Malakir Rebirth // Malakir Mire.

A target bracket is treated as a target, not evidence that the target was achieved.

## Fixture 1 — Counter Blitz / Tidus / FINAL FANTASY-only

### Constraints

- Exact Counter Blitz stock lineage.
- Tidus, Yuna's Guardian remains commander.
- Physical FINAL FANTASY-family printings only.
- Maximum 20 swaps.
- Preserve counters/proliferate and meaningful combat.
- Add dense countermagic and compact combo access.
- Bracket 5 is an assessed target, not a declared result.

### Specialist result

- Exact 100: pass.
- Commander legal: pass.
- FINAL FANTASY printing policy: pass.
- Refinement status: `unsupported-theme`.
- Swaps: 0.
- Assessed bracket: 3.
- Average nonland mana value: 3.03.
- Early plays: 24.
- Fast mana: 1.
- Cheap interaction: 3.
- Free interaction: 0.
- Tutor count: 0.
- Counterspell count: 1.
- Counter engine count: 52.
- Proliferate count: 4.
- Combat references: 12.
- Verified included combo evidence: stock Gatta and Luzzu + Hardened Scales + Walking Ballista route.

The decisive failure is instruction interpretation: the compound request `+1/+1 counters proliferate countermagic combat` was rejected as an unsupported free-form theme, so the specialist did not attempt a legal upgrade despite the requested subplans being individually meaningful and the stock deck already supporting several of them.

### Locked general-AI result

- Exact 100: pass.
- Commander legal: pass.
- FINAL FANTASY printing policy: pass.
- Fixed swaps: 18.
- Assessed bracket: 3.
- Average nonland mana value: 2.69.
- Early plays: 29.
- Fast mana: 1.
- Cheap interaction: 7.
- Protection: 3.
- Counterspell count: 8.
- Counter engine count: 39.
- Proliferate count: 3.
- Combat references: 12.
- Creature count: 27.
- Verified combo evidence includes Gatta and Luzzu + Hardened Scales + Walking Ballista, Gatta and Luzzu + The Earth Crystal + Walking Ballista, and The Destined White Mage + Walking Ballista.

The general-AI list materially improves the requested deck while preserving hard truth and the hybrid identity. It still assesses as Bracket 3 and therefore does **not** achieve the Bracket-5 target.

### Counter Blitz score

| Dimension | Specialist | General AI | Winner |
| --- | --- | --- | --- |
| Exact 100 / legality / FF-only truth | Pass | Pass | Tie |
| Compound instruction adherence | Rejected request; 0 swaps | Executed 18-swap plan | General AI |
| Counters/proliferate/combat preservation | Preserved only because stock was unchanged | Preserved after upgrade | General AI |
| Dense countermagic | 1 counterspell | 8 counterspells | General AI |
| Curve / early-game improvement | 3.03 MV / 24 early | 2.69 MV / 29 early | General AI |
| Compact combo access | Stock route only | Three verified routes, including White Mage + Ballista | General AI |
| Honest target reporting | Bracket 3 | Bracket 3 | Tie |

**Fixture verdict: decisive general-AI win.**

The specialist's fail-closed handling is preferable to silently misinterpreting a constraint, but a Commander-specialist system cannot outperform general AI if normal multi-part Commander instructions force a no-op.

## Fixture 2 — Liliana / NZ$500 / zero tribal credit

### Constraints

- Fixed commander: Liliana, Heretical Healer // Liliana, Defiant Necromancer.
- Hard NZ$500 whole-deck cap.
- Creature-type optimization disabled.
- Aristocrats/sacrifice plus graveyard/reanimation identity.
- Exact 100, Commander legality, full resolution and budget truth are hard gates.
- Bracket 5 is an assessed target, not a declared result.

### Specialist result

- Exact 100: pass.
- Commander legal: pass.
- Audited exact-printing total: **NZ$443.21 / NZ$500**.
- Budget headroom: NZ$56.79.
- Readiness: `strong-competitive-construction-signals`.
- Honest assessed bracket: **4**, `high-bracket-4-cedh-construction-candidate`.
- Lands: 30.
- Average nonland mana value: **1.81**.
- Early plays: **58**.
- Fast mana: **3**.
- Cheap interaction: **11**.
- Protection: **5**.
- Tutors: **5**.
- Free interaction: **2**.
- Verified win-oriented combos: **3**.
- Winning combo cores: 1.
- Core engine: Warren Soultrader + Gravecrawler with Blood Artist / Zulaport Cutthroat / Ayara payoff variants.

### Locked general-AI V2 result

- Exact 100: pass after the count-only V2 correction.
- Commander legal: pass.
- Audited exact-printing total: **NZ$960.79 / NZ$500**.
- Budget overage: **NZ$460.79**.
- Readiness: `strong-competitive-construction-signals`.
- Assessed bracket: **4**, `bracket-4-optimized-range`.
- Average nonland mana value: **2.51**.
- Early plays: **38**.
- Fast mana: **3**.
- Cheap interaction: **6**.
- Free interaction: **1**.
- Tutors: **5**.
- Verified win-oriented combos: **16**.
- Independent winning combo cores: **4**.

The locked general-AI list has substantially greater raw combo diversity, but it violates the fixture's central hard constraint by almost doubling the allowed deck budget. The verifier intentionally records that as a comparison loss instead of mutating the locked list after seeing the specialist result.

### Liliana score

| Dimension | Specialist | General AI | Winner |
| --- | --- | --- | --- |
| Exact 100 / legality | Pass | Pass | Tie |
| NZ$500 hard budget | NZ$443.21 — pass | NZ$960.79 — fail | Specialist |
| Primary strategy coherence | Strong aristocrats + graveyard/reanimation | Strong aristocrats + graveyard/reanimation | Tie |
| Curve | 1.81 MV | 2.51 MV | Specialist |
| Early-game density | 58 | 38 | Specialist |
| Cheap interaction | 11 | 6 | Specialist |
| Free interaction | 2 | 1 | Specialist |
| Fast mana | 3 | 3 | Tie |
| Tutors | 5 | 5 | Tie |
| Raw verified win routes | 3 / 1 core | 16 / 4 cores | General AI |
| Honest assessed bracket | 4 | 4 | Tie |

**Fixture verdict: decisive specialist win.**

The general-AI deck is stronger in raw combo redundancy, but it is not a valid answer to the requested task because it fails the whole-deck budget. The specialist also posts stronger curve, early-play, and interaction metrics while remaining below budget.

## Batch A aggregate

**Fixture record: Specialist 1 — General AI 1.**

This is not promotion-grade evidence and does not establish that V0.15 consistently outperforms strong general-purpose AI.

What Batch A does establish:

1. Hard truth is strong in both specialist fixtures: exact card count, Commander legality, printing policy and budget auditing behave conservatively.
2. The Liliana whole-budget path is a meaningful specialist advantage: it produces a strong, coherent, Bracket-4-quality deck under the requested NZ$500 cap while the independently locked general-AI deck fails the cap badly.
3. Compound natural-language constraint interpretation is a major current weakness. Counter Blitz becomes a no-op even though an independent general-AI plan can materially improve the exact same deck without violating hard truth.
4. Target honesty is working: neither Counter list is falsely promoted to Bracket 5, and both Liliana lists remain honestly assessed as Bracket 4.

## Watch items — not yet product fixes

- **Compound request representation:** determine whether Counter's `unsupported-theme` result generalizes to an unseen multi-plan fixture before changing product code.
- **Counter tutor/access accounting:** the locked Counter list contains Ranger-Captain of Eos, Delivery Moogle and Search for Dagger, while aggregate `tutorCount` remains 0 despite role evidence containing creature/narrow tutoring. Audit after the frozen benchmark batch rather than patching it now.
- **Liliana land quality:** the specialist list contains Secluded Courtyard, Unclaimed Territory and Path of Ancestry while creature-type optimization is disabled. Treat as a manual quality watch item until an independent test shows whether this is a recurring non-tribal land-selection problem.
- **Counter practical cost:** the eligible FINAL FANTASY Force of Negation printing selected by the baseline is extremely expensive. Counter had no budget cap, so this is not a hard failure, but future practical benchmarks should include a budget/per-card constraint where appropriate.

## Next action

Do **not** patch Counter yet. Start BENCH-01 Batch B from the same frozen product runtime with at least one unseen compound/multi-plan deck. Prefer a fixture whose natural plan combines typal/combat with recursion or another independent axis so it tests whether normal multi-part Commander language fails beyond Counter Blitz. Only after the unseen batch should a generalized product repair be considered.

Stable/current remains V0.13. No checkpoint promotion or merge is authorized by this scorecard.
