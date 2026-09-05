# BENCH-01 Batch A — Liliana general-AI baseline correction V2

Date: 2026-09-05

## Why a V2 exists

The original independent Liliana baseline was locked before specialist-result review, but its card-count assertion exposed a clerical mistake: the written list contains **99 cards**, not 100. That V1 failure is retained as benchmark evidence and is not silently rewritten.

## Count-only correction

V2 changes exactly one quantity:

- `Swamp`: **19 → 20**

No nonland card, engine, tutor, combo, interaction piece, payoff, recursion card or utility land changes. The correction is therefore not tailored to anything learned from the specialist result; it only supplies the missing hundredth card using the least strategic possible change.

All other anti-leak and hard-truth rules from `docs/BENCH-01-BATCH-A-LILIANA-BASELINE-LOCK-2026-09-05.md` remain in force. V1 remains historical evidence; V2 is the mechanically valid comparison candidate if it also passes legality, exact-printing price and NZ$500 whole-deck budget checks.
