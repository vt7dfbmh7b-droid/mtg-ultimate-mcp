# MTG Ultimate MCP

An MCP-powered Magic: The Gathering / Commander knowledge, rules, deck-building, upgrade, precon, exact-printing, pricing, combo, probability, simulation, and evidence service.

The goal is an **MTG brain for AI clients**: enforce hard game/card truth first, then use simulations, research, tournament evidence, and experimental learning only where they are appropriate.

## Development recovery

Long-running project state is repository-backed rather than chat-backed.

- `project-state.json` is the authoritative machine-readable current development state.
- `docs/PROJECT-STATE.md` is the generated human snapshot.
- `validation-index.json` / `docs/VALIDATION-STATE.md` consolidate registered validation evidence and flag stale source lineages.
- `PROJECT_HANDOFF.md` is a short generated compatibility entry point.
- `docs/PROJECT-MANAGEMENT.md` defines the fresh-chat recovery/update protocol.
- `ULTIMATE_MTG_SPEC.md` remains the north-star product/engineering specification.

A fresh development session should read project state and validation state first, inspect the live active-branch head/PR, then continue from the active milestone and next actions instead of reconstructing old chats. `npm run project:resume` produces the same deterministic repo-only recovery brief locally/CI.

## Release state

**Stable runtime remains V0.13.**

- `package.json` remains `0.13.0`.
- `src/server-current.ts` deliberately returns the V0.13 server.
- V0.14/V0.15 code on development branches is experimental and is not stable merely because it exists or passes tests.
- No project-state, benchmark, model, workflow, or handoff can authorize stable promotion automatically.

Current active development is recorded in `project-state.json`. PM-01/PM-02 established and validated the repo-first recovery layer; Commander-intelligence development has resumed on `agent/v15-native-deck-intelligence` / PR #29 with INTEL-02 as the active milestone. The older `agent/package-probabilities` line remains the recorded fully validated executable experimental baseline/recovery surface until newer V0.15 deck-intelligence work earns its own validation claim.

## Hard truth hierarchy

Learning, tournament prevalence, optimization, simulation, popularity, or a requested power level may never override:

- Commander legality;
- exact card/command-zone count;
- color identity and singleton rules;
- unresolved-card failures;
- current banned/legal facts;
- exact physical-printing existence and requested printing/finish restrictions;
- must-include/exclude constraints;
- hard budgets when requested;
- known rules facts;
- verified combo requirements and full-table win closure.

Provider unavailability is not evidence of absence. Historical evidence must also be temporally valid: later data cannot be backdated into an earlier predictor state.

## Stable V0.13 user surface

V0.13 makes **New Zealand dollars (NZD) the primary pricing and budget currency**.

Pricing policy:

1. Prefer a directly checked New Zealand listing for the exact physical printing when a supported research path actually checked one.
2. TCGfind NZ / NZ retailers are the preferred local shopping lane.
3. Otherwise use the exact Scryfall physical printing's USD reference price and convert it to NZD.
4. Keep USD as a labelled reference value, not the primary NZ user price.
5. Never imply a converted reference includes NZ shipping or is a guaranteed landed price.

Current stable tools include:

| Tool | Purpose |
| --- | --- |
| `pricing_policy_v13` | Explain current NZD pricing/FX behavior. |
| `price_card_nzd_v13` | Price a named card or exact printing with NZ$ first. |
| `refine_commander_deck_v13` | Iteratively refine a Commander deck under NZD budgets. |
| `refine_precon_v13` | Refine an exact stock precon. |
| `build_and_refine_commander_deck_v13` | Build and refine from scratch. |

`BASIC_FEATURES.md` maps ordinary user intents to the preferred stable tool surface while retaining historical tool compatibility.

## Commander and printing foundations

The project distinguishes **Oracle identity** from **physical printing identity**. Rules/synergy use Oracle identity; theme, shopping, price, finish, and printing restrictions use exact set/collector/finish identity.

The hard Commander layer validates commander eligibility/configuration, exact 100-card construction, combined color identity, singleton/basic/card-specific copy exceptions, and current Commander legality. Fully resolved illegal decks are blocked from advanced workflows.

Commander precons are sourced from maintained MTGJSON data rather than a frozen manual product list. Exact stock quantity, set, collector number, and foil/nonfoil state are retained where supplied.

## Experimental V0.15

The experimental branches contain broader Commander building, exact probability, win-package verification, tutor access/value/replacement analysis, prospective tournament evidence, shadow learning infrastructure, and ongoing native deck-intelligence work.

The promotion experiment is deliberately narrow:

- learned output is advisory/shadow-only;
- promotion-grade projection is explicitly `manaEfficiency` + `interactionEfficiency` unless a future precommitment changes the contract **before** observing future outcomes;
- the claim scope is TopDeck event-top-cut prediction from strict prospective tournament evidence, **not universal Commander deck strength**;
- a genuine future seal freezes training evidence, normalizer, model parameters, success criteria, exact repository revision, dependency lockfile, Node version, and evaluator contract;
- future holdout build/evaluation must run against that exact sealed revision;
- even strong evidence can only reach `eligible-for-human-review`; it cannot promote stable automatically.

Production future sealing requires a substantially sized/balanced training corpus and explicit event/pilot identities. Future evaluation additionally has precommitted absolute discrimination floors, transparent/prevalence baseline gates, calibration limits, and diversity requirements.

## Reproducible development

Supported runtime compatibility remains Node.js **20+** unless a specific deployment says otherwise.

The reproducible development/CI baseline is stricter:

- Node.js `22.23.2` from `.node-version`;
- npm lockfile committed;
- use `npm ci`, not `npm install`, for a reproducible checkout;
- GitHub-hosted workflows use `ubuntu-24.04` and full-SHA action pins;
- Docker uses an exact Node/Alpine image digest and runs the final process as the unprivileged `node` user.

Local setup:

```bash
npm ci
cp .env.example .env
npm run dev
```

Normal deterministic checks:

```bash
npm run check
```

Project-state / recovery checks:

```bash
npm run project:typecheck
npm run project:validate
npm run validation:validate
npm run project:resume
```

Regenerate state-derived artifacts after intentional state/result changes:

```bash
npm run project:handoff
npm run validation:index
```

Live dependency smoke:

```bash
npm run test:live
```

Real precon E2E:

```bash
npm run test:e2e
```

## Manual GitHub workflows

GitHub requires a `workflow_dispatch` workflow to exist on the default branch before it can be manually dispatched. The default branch therefore contains **registration stubs only** for the historical experimental manual workflows.

Use `project-state.json` to determine the active development branch before dispatching development-specific controls. Older registered V0.15 workflows may still intentionally target `agent/package-probabilities`; running a registration stub directly on `main` intentionally fails rather than pretending the stable default branch contains the experimental runtime.

A separate default-branch `Dependency Security Audit` runs weekly and checks the locked dependency graph for high/critical npm advisories. It is intentionally separate from deterministic CI because registry/advisory availability is external.

## Privacy-sensitive evidence

Exact tournament/player/deck evidence used by the promotion pipeline is kept in private GHCR evidence packages. Public Actions artifacts contain only privacy-safe audits/hashes/aggregate metrics. Local private-evidence filenames and working directories are ignored by Git so a manual run is less likely to accidentally commit sensitive payloads into this public repository.

## Multi-source evidence

Evidence classes remain separate. Typical sources include Wizards, Scryfall, Commander Spellbook, MTGJSON, TopDeck.gg, EDHTop16, Playgroup.gg, EDHREC, public deck databases/primers, DeckCheck, and NZ/international market sources. Shared upstream lineage is not counted as independent corroboration merely because it appears on multiple hosts.

## Architecture

The stable MCP constructor uses central version/config identity and `src/server-current.ts` as the stable runtime boundary. Historical numbered server modules remain for compatibility/regression rather than being deleted in a risky rewrite.

The preferred engineering loop is:

> **hard truth → research/cross-check → build → verify → exact maths/simulate → test → observe → learn → retest**

For current development branch, checkpoint state, active milestone, validation status, blockers and exact next work, read `project-state.json`, `docs/PROJECT-STATE.md` and `validation-index.json` before changing anything.
