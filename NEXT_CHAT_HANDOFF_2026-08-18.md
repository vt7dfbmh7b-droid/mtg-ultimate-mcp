# Ultimate MTG — Detailed Next-Chat Handoff — 2026-08-18 NZST

This is the preferred recovery file for the next ChatGPT session. Read this file **before** the older `PROJECT_HANDOFF.md`, then read `ULTIMATE_MTG_SPEC.md`. The older handoff contains valuable foundation history but its top-level head/next-target section is stale relative to this checkpoint.

## 1. Immediate resume instructions

1. Repository: `vt7dfbmh7b-droid/mtg-ultimate-mcp`.
2. Active development branch: `agent/package-probabilities`.
3. Do **not** assume `main` is current development state.
4. Read this file, `PROJECT_HANDOFF.md`, and `ULTIMATE_MTG_SPEC.md`.
5. Inspect the current branch head and recent commits before changing code.
6. The last code implementation head before this documentation-only handoff was:
   - `a300df1a363e51e97219303676204fbc82624969` — `use exhaustive paginated commander discovery`.
7. There may be a later documentation-only head containing this handoff. Compare against `a300df1a...` before assuming behavior changed.
8. Inspect CI/checks for the exact current implementation head before making changes.
9. Stable runtime remains V0.13. Do **not** promote V0.14/V0.15 merely because experimental code/tests are green.
10. Continue with the **Next experiment** in section 10 unless the user explicitly changes direction.

## 2. Repository / release state

- Active branch: `agent/package-probabilities`.
- Draft validation PR: **#2 — `Validate V0.15 experimental Commander controls`**.
- Stable package version: `0.13.0`.
- `src/server-current.ts` deliberately remains V0.13.
- Experimental V0.14/V0.15 services are being hardened behind tests and live controls.
- Do not merge/promote merely because the controls below pass.

The temporary branches `agent/package-probabilities-2` and `agent/package-probabilities-3` are not active continuation branches.

## 3. Exact-head quality status at `a300df1a...`

All four PR checks completed successfully on the same implementation head:

1. **CI** — run `32087274312` — SUCCESS.
2. **FF Najeela High-Bracket-4 Control** — run `32087274318` — SUCCESS.
3. **Final Fantasy Bracket 5 E2E** — run `32087274364` — SUCCESS.
4. **FF Auto-Commander Build Control** — run `32087274389` — SUCCESS.

Important semantic rule: a successful control run means the test completed honestly. It does **not** mean its requested target was achieved. The FF Bracket-5 control passed while correctly reporting that Bracket 5 was **not** achieved.

## 4. Permanent truth hierarchy / user requirement

The user is explicitly concerned about false power/bracket claims. The system must prefer conservative underclaiming over optimistic labels.

The following are hard truth and may never be overridden by a requested bracket, theme, budget, ML score, simulation, combo count, or famous commander name:

- current Commander legality;
- exact 100-card construction;
- color identity and singleton rules;
- banned/legal facts;
- unresolved cards;
- legitimate physical printing existence;
- printing-family restrictions;
- verified combo facts;
- current official bracket criteria.

A requested bracket is a **target**, never an input that forces the output bracket.

A static deck-list test is not by itself proof of Bracket 5/cEDH. Competitive construction, intent, and current metagame evidence are distinct gates.

## 5. Current official Commander policy baseline

Keep current rules refreshed from official Wizards sources when rules/brackets matter.

Verified during this work:

- Current Comprehensive Rules file was effective **2026-08-07**.
- Commander rules are section **903**.
- Current Commander banned list comes from Wizards' current Banned & Restricted page.
- Current five-bracket model remains beta.
- Wizards' October 21, 2025 Commander Brackets update describes:
  - Bracket 4 = Optimized: lethal, consistent, fast, strong engines/interaction/tutors, but **not** the cEDH metagame reserved for Bracket 5.
  - Bracket 5 = cEDH: meticulously designed for the cEDH metagame, optimized for efficiency/consistency, capable of very fast wins/resource domination, tournament-minded, razor-thin margins.

Do not silently treat old remembered rules as current. For live/current rules work, re-verify official sources.

## 6. Bracket assessor anti-false-report architecture

Relevant service: `src/services/bracket-ceiling-v15.ts`.

Important contract:

- `targetBracket` is not used to decide actual power.
- Hard gates must pass first: Commander legal, exact card count, fully resolved, printing policy compliant.
- Bracket-5 construction gates include curve, early play density, fast mana, free interaction, cheap interaction, tutors, verified winning combo, and competitive combo signal.
- Even strong cEDH-like construction is capped below Bracket 5 unless both:
  - `cedhIntent === true`, and
  - `competitiveMetagameEvidence === true`.
- `bracket5CertifiedByThisAssessment` must remain false when those proof requirements are absent.

This is intentional. The plugin must be willing to answer: **"No, this deck is not Bracket 5."**

## 7. Permanent calibration controls now in place

### A. Frozen FF-only Najeela High-Bracket-4 control

Files/workflow include:

- `testdata/ff-najeela-powerful-baseline.txt`
- `scripts/e2e-ff-najeela-bracket4-v15.ts`
- `.github/workflows/ff-najeela-bracket4-control.yml`
- `src/services/efficient-win-plan-v15.ts`

This control proves that the system can recognize a strong **non-infinite combat engine** rather than reducing deck power to combo count.

Najeela's commander-centric evidence is semantic, not name-based. The verifier requires actual Oracle characteristics such as:

- cheap commander;
- attacks creating additional tapped-and-attacking bodies;
- untapping attackers;
- granting an additional combat;
- repeatable combat activation;
- no explicit once-per-turn/combat cap.

Adversarial tests prove:

- the name `Najeela` with incomplete Oracle semantics cannot manufacture the evidence;
- a six-mana lookalike cannot pass the cheap-command-zone proof;
- real Najeela evidence plus a deliberately weak 99 cannot lift the deck above Bracket 3;
- optimized construction + proven Najeela combat plan can support Bracket 4 but never substitutes for B5 competitive evidence.

The high-B4 control also runs a shadow assessment with Game Changers forced to zero. It must still return Bracket 4, preventing a Game-Changer-count shortcut.

The control's stricter **high Bracket 4** definition is internal, not an official sixth bracket: all measured B5 speed/mana/interaction/tutor construction gates must pass, while only the cEDH win-package construction gates remain failed.

Frozen Najeela baseline observed metrics:

- assessed Bracket 4;
- average nonland MV: **2.29**;
- early plays: **47**;
- fast mana: **4**;
- free interaction: **2**;
- cheap interaction: **11**;
- protection: **11**;
- tutors: **12**;
- current Game Changers: Cyclonic Rift, Rhystic Study;
- no verified win-oriented combo;
- no Ruthless/strategic/R competitive combo signal.

### B. FF-only Bracket-5 target control

File/workflow includes:

- `scripts/e2e-ff-bracket5.ts`
- `.github/workflows/ff-bracket5-e2e.yml` (or current equivalent workflow path).

Critical semantics were corrected earlier:

- **CONTROL PASS** = a legal FF-only deck was built/verified and honestly classified.
- **TARGET ACHIEVED** = a separate boolean.

Latest exact-head result from run `32087274364`:

- Commander: Najeela, the Blade-Blossom (FCA 42).
- 100 cards.
- Commander legal: true.
- FF printing policy: pass.
- Game Changers: Cyclonic Rift, Rhystic Study.
- Build status: `built-but-competitive-signals-incomplete`.
- cEDH readiness: `not-yet-strong-competitive-construction-signals`.
- Spellbook tag: P.
- complete combos: 0.
- win-oriented combos: 0.
- Ruthless combos: 0.
- strategically relevant combos: 0.
- land count: 31.
- average nonland MV: 2.29.
- early plays: 47.
- fast mana: 4.
- cheap interaction: 11.
- protection: 11.
- tutors: 12.
- free interaction: 2.
- efficient Najeela non-combo win evidence: true.
- honest assessed bracket: **4**.
- assessed band: `bracket-4-optimized-range`.
- Bracket-5 target achieved: **false**.

Failed B5 construction thresholds were exactly:

1. verified win-oriented combo;
2. competitive combo signal.

Independent current competitive-metagame evidence was also false, so a B5 claim would have been invalid even if the static construction were closer.

Restriction analysis correctly says these shortfalls were **observed under** the FF-only constraint; it does not falsely claim the restriction alone causally proves every failure.

### C. Unrestricted cEDH control

Keep the unrestricted Kinnan cEDH control as the positive competitive benchmark. It exists to distinguish a restricted-card-pool ceiling from a generic builder weakness.

Do not weaken this control to make restricted decks look better.

## 8. Blind FF auto-commander experiment — completed

The user specifically asked to test what the system can build with **Final Fantasy-only cards without suggesting a commander**.

New components include:

- `src/services/auto-commander-selection-v15.ts`
- `src/services/scryfall-paginated-search-v15.ts`
- tests for deterministic commander scoring/Partner handling and bounded Scryfall pagination;
- `scripts/e2e-ff-auto-commander-v15.ts`
- `.github/workflows/ff-auto-commander-control.yml`.

### Important failed first attempt — do not erase this history

The first blind run appeared to choose Thrasios + Tymna and produced a Bracket-3 shell. That result was **not accepted as a fair final answer** because investigation showed commander discovery was only seeing a bounded first slice of Scryfall results.

The initial sampled run found only 73 eligible commander cards and did not even consider Najeela. That was a discovery coverage bug, not evidence that the evaluator preferred Thrasios/Tymna over Najeela.

Two attempted fixes intentionally failed closed:

- exact-MV buckets exposed `cmc=3` reaching the 50-card query ceiling;
- MV + multicolor partitions still exposed `cmc=3 is:multicolored` reaching the 50-card ceiling.

These failures were useful because the system refused to claim exhaustive discovery when it could not prove it.

### Final discovery fix

The final implementation uses a bounded paginated Scryfall search helper that:

- follows all pages within explicit page/card caps;
- detects malformed pagination;
- rejects loops;
- rejects foreign next-page URLs;
- fails closed if safety bounds are exceeded;
- queries actual allowed FF family set codes;
- separately exact-resolves curated special/Secret Lair printings by set + collector number;
- does not use an unrelated Oracle printing as proof that a themed printing is eligible.

Commander **names do not award power points**. Names are only deterministic tie-breakers. Scoring is based on generic properties such as color access, command-zone efficiency, roles, and Oracle-text signals.

Unrestricted Partner pairs can be discovered; restricted `Partner with`, Doctor's companion, Friends forever, Background-style relationships are not incorrectly treated as free generic Partner pairings.

### Final fair blind result

Run: `32087274389` — SUCCESS on `a300df1a...`.

Input constraint was only:

> FINAL FANTASY physical printings only.

No commander name was supplied to the selector.

The exhaustive bounded scan found **213 eligible commander cards**.

Top autonomous ranking:

1. **Najeela, the Blade-Blossom — score 104**
   - five-color access;
   - MV 3;
   - extra combat;
   - untap engine;
   - token production;
   - haste;
   - repeatable-combat Oracle text;
   - attack-trigger engine.
2. Terra, Magical Adept // Esper Terra — 86.
3. The Wandering Minstrel — 78.
4. Thrasios, Triton Hero + Tymna the Weaver — 77.
5. Cloud, Ex-SOLDIER — 69.
6. Tidus, Yuna's Guardian — 69.
7. Bruse Tarl + Thrasios — 68.
8. Kraum + Tymna — 67.
9. Thrasios + Vial Smasher — 66.
10. Banon, the Returners' Leader — 64.

The build comparison lane selected:

- Najeela, the Blade-Blossom;
- Terra, Magical Adept // Esper Terra;
- Thrasios + Tymna.

Najeela completed successfully and built a **new autonomous 100-card list**, not merely the frozen calibration fixture.

Autonomous Najeela result:

- honest assessed bracket: **4**;
- band: `bracket-4-optimized-range`;
- B5 construction gates passed: **6/8**;
- winning combos: 0;
- commander-centric efficient win plan: true;
- land count: 31;
- average nonland MV: **2.03**;
- early plays: **52**;
- fast mana: **6**;
- cheap interaction: **11**;
- protection: **10**;
- tutors: **11**;
- free interaction: **2**;
- Game Changers: Cyclonic Rift, Rhystic Study.

The only failed B5 construction gates were again:

- verified winning combo;
- competitive combo signal.

This is an encouraging result because the system independently rediscovered the same commander and general high-B4 ceiling without being told `Najeela`.

### Important limitation of the blind comparison

Terra and Thrasios/Tymna both hit operation/network timeouts during their full build attempts in the final run.

Therefore do **not** say that completed Najeela definitively beat completed Terra and completed Thrasios/Tymna decks. The valid claim is narrower:

- exhaustive bounded candidate discovery ranked Najeela #1;
- Najeela's full build completed;
- the completed Najeela build independently assessed Bracket 4;
- two comparison builds timed out and remain unresolved comparisons.

## 9. Why this checkpoint matters

The bracket/deck system has now demonstrated all of the following at once:

- it can underclaim rather than falsely label FF Najeela as B5;
- it recognizes a real non-infinite commander-centric combat win plan;
- it does not allow a commander name alone to manufacture power evidence;
- it does not allow a strong commander to rescue a deliberately weak 99;
- it can scan a themed printing pool without a supplied commander;
- it fails closed when discovery coverage is incomplete;
- after full discovery, it independently ranks Najeela first;
- it constructs a new FF-only Najeela list and independently assesses it at Bracket 4;
- the stable runtime remains unchanged while experimental intelligence is tested.

## 10. NEXT EXPERIMENT — user's explicitly chosen next step

The next user-requested test is **more neutral** than the previous blind test.

Exact spirit of the prompt:

> **Build me a Final Fantasy-only Commander deck.**

Do **not** supply:

- a commander;
- a requested bracket;
- "strongest";
- "cEDH";
- "optimized";
- a combo requirement;
- a budget unless the user adds one;
- a preferred strategy unless the user adds one.

### Goal

Test whether the system can independently decide:

1. which commander(s) are appropriate;
2. what strategy/archetype the deck should use;
3. what win conditions/routes naturally fit that commander and FF card pool;
4. how much ramp/draw/interaction/protection/tutoring the chosen strategy actually needs;
5. whether combo, combat, value, aristocrats, counters, reanimation, equipment, control, etc. should be primary/secondary routes;
6. what **actual** bracket the finished deck belongs to after construction;
7. why it landed at that level;
8. whether the FF-only restriction materially constrains the result.

### Critical experimental rule

This new neutral experiment must **not reuse `targetBracket=5` internally** merely because the existing cEDH builder is convenient. Doing that would contaminate the experiment by steering the deck toward competitive construction.

The next implementation should create/route through a neutral intent path where power target is absent. The builder should choose strategy first and assess bracket **after** the deck is built.

### Suggested implementation shape

A reasonable next control could be named something like:

- `scripts/e2e-ff-neutral-build-v15.ts`
- `.github/workflows/ff-neutral-build-control.yml`

But do not hard-code these names if a cleaner architecture is found.

Suggested stages:

1. Resolve the FF physical-printing policy.
2. Exhaustively/boundedly discover eligible commanders using the new pagination-safe selector.
3. Derive commander strategy/archetype signals from card text and available FF card pool.
4. Select a small, diverse candidate set without assuming high power is always better.
5. Build complete legal 100-card decks under **no bracket target**.
6. Verify exact printings and Commander legality.
7. Independently identify actual win routes and Commander Spellbook combos if any.
8. Independently assess bracket ceiling after construction.
9. Report why that commander/strategy was chosen and what alternative candidates looked plausible.
10. Keep comparison-build timeouts visible rather than converting them into losses.

### What would count as a good result

A good result is **not necessarily Bracket 4 or 5**.

Success means the system makes a coherent independent deck-building decision from a neutral user request, produces a legal FF-only 100-card deck, explains the strategy/win routes, and honestly reports its resulting bracket.

If the neutral builder chooses a lower-power but coherent synergistic deck, that can be correct. The experiment is specifically testing whether the system understands user intent and deck identity without power steering.

## 11. Broader foundation retained from older handoff

Do not lose the existing completed foundations documented in `PROJECT_HANDOFF.md`, including:

- exact BigInt hypergeometric probability engine;
- overlap-aware package math;
- commander-zone exact availability;
- exact turn/access curves;
- simulation-vs-exact calibration;
- quarantine-first learning corpus;
- deterministic temporal partitioning;
- training-only normalization;
- content-addressed corpus manifests;
- historical card-data provenance/fingerprints;
- historical Commander legality gates;
- TopDeck bounded ingestion and conservative cross-source linkage;
- neural model remaining shadow-only.

The current Commander/deck-building work should extend those guarantees, not bypass them.

## 12. Quality gates for the next chat

Before calling the neutral-build milestone complete:

- inspect exact branch head first;
- dependency install succeeds;
- strict TypeScript build succeeds;
- complete deterministic automated tests succeed;
- live FF neutral-build control is separate from deterministic CI;
- exact FF physical-printing policy is enforced;
- Commander legality and 100-card count are independently rechecked;
- no commander name is secretly injected;
- no bracket target is secretly injected;
- no famous-commander name bonus is introduced;
- strategy inference is semantic/auditable;
- any build timeout remains an unresolved comparison, not a defeat;
- final bracket is assessed after construction;
- B5 is never claimed without the existing independent evidence requirements;
- frozen Najeela high-B4 control and unrestricted cEDH control do not regress;
- stable `server-current` remains V0.13 unless the user explicitly decides to promote a release.

## 13. User preferences relevant to this project

- Wants an "ultimate" MTG/Commander system, not a superficial deck recommender.
- Strong preference for independent testing and evidence.
- Wants current rules/brackets kept up to date.
- Does not want false Bracket-5 reports.
- Wants exact physical-printing restrictions honored, especially FINAL FANTASY-only builds.
- Likes multiple meaningful win routes; do not automatically collapse FF decks into one infinite combo when combat/value routes matter.
- Exact math should be preserved even if a test fixture is wrong; fix bad fixtures rather than corrupt correct calculations.
- The user's real collection and speculative FF-only Bracket-5 experiments are separate concepts.

## 14. Compact resume sentence for a new chat

If the new session needs a one-line orientation:

> Continue `vt7dfbmh7b-droid/mtg-ultimate-mcp` on `agent/package-probabilities`; read `NEXT_CHAT_HANDOFF_2026-08-18.md` first. The exact implementation head `a300df1a...` had CI + Najeela high-B4 + FF B5-target + blind auto-commander controls all green. The blind FF scan covered 213 eligible commanders and independently chose/built Najeela at honest Bracket 4. Next test: neutral prompt `Build me a Final Fantasy-only Commander deck` with **no commander and no power/bracket target**, then infer strategy and assess bracket only after construction.
