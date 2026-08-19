# Ultimate MTG — New Chat Handoff

_Last refreshed: 2026-08-20 NZST_

This is the shortest recovery path for a fresh ChatGPT conversation. Read `PROJECT_HANDOFF.md` after this file for the detailed checkpoint, then `ULTIMATE_MTG_SPEC.md` and `BASIC_FEATURES.md`.

## Start here in a new chat

Use this exact opening request:

> Continue the Ultimate MTG project in `vt7dfbmh7b-droid/mtg-ultimate-mcp`. Read `NEW_CHAT_HANDOFF.md`, `PROJECT_HANDOFF.md`, `ULTIMATE_MTG_SPEC.md`, and `BASIC_FEATURES.md` first. Check `agent/package-probabilities`, PR #2, the exact current head, and CI before changing code. Continue from the next implementation target. Do not promote `server-current`, do not merge to `main`, and do not treat V0.15 as stable without my explicit approval.

---

## Repository state

Repository:

- `vt7dfbmh7b-droid/mtg-ultimate-mcp`

Active development branch:

- `agent/package-probabilities`

Active validation PR:

- PR #2 — open/draft validation surface only
- base: `main`
- head: `agent/package-probabilities`
- **DO NOT MERGE** without explicit user release approval.

Current implementation candidate:

- `ae113807c609c601de2717c08990f85c0238ee4d`

Exact validation already complete on that implementation object:

- deterministic CI `32296434358`: **PASS**
- Scryfall Card Data Source Live `32296434428`: **PASS**
- TopDeck Learning Source Live `32296434350`: **PASS**
- Commander Live Control Suite `32296434348`: **IN PROGRESS at handoff preparation — verify PASS before folding this docs checkpoint**

A later docs-only checkpoint may sit ahead of the implementation object. Always inspect the diff and current Actions rather than assuming the newest SHA changed runtime code.

Stable boundary remains unchanged:

- package `0.13.0`;
- `src/server-current.ts` remains V0.13;
- V0.14/V0.15 remain experimental;
- `main` remains untouched by this experimental development line.

---

## Milestone just completed — provenance-safe predictor/card-data acquisition

The previous blocker was historical predictor/card data for the 4,395 strict exact Commander TopDeck deck/outcome candidates across 173 accepted events.

That acquisition boundary is now implemented without backdating present-day data.

### Generic historical/current acquisition

New service:

- `src/services/historical-carddata-acquisition-v15.ts`

It supports:

- separately audited pinned archived snapshots with URI/version/effective/publication time/SHA-256;
- provenance cutoff rejection before network access;
- bounded streaming and exact size/hash checks;
- strict data parsing;
- contemporaneous current capture stamped at observation time;
- direct integration into existing provenanced historical feature extraction.

### Source policy

New service:

- `src/services/historical-carddata-source-inventory-v15.ts`

Current policy:

- Scryfall current bulk: forward capture allowed, retrospective backfill blocked, `historicalArchiveVerified: false`.
- MTGJSON current build: native adapter still required, retrospective backfill blocked, `historicalArchiveVerified: false`.

No verified replayable daily historical archive has been registered.

### Scryfall provider contract discovered live

New services/workflow:

- `src/services/scryfall-bulk-carddata-source-v15.ts`
- `src/services/scryfall-forward-carddata-capture-v15.ts`
- `scripts/live-scryfall-carddata-source-v15.ts`
- `.github/workflows/scryfall-carddata-source-live.yml`

The current 2026 Scryfall `default_cards` manifest uses:

- provider `id`;
- `updated_at`;
- provider metadata `uri`;
- `compressed_size`;
- `jsonl_download_uri` on HTTPS `*.scryfall.io` ending `.jsonl.gz`.

An early live control intentionally exposed the obsolete JSON-array assumption; a temporary safe shape probe established the real current provider shape, then was removed after the strict parser was updated.

### Scryfall forward capture is provenance-safe

The current source path:

- requires HTTPS `*.scryfall.io` `.jsonl.gz`;
- enforces manifest compressed size;
- bounds compressed download bytes;
- hashes exact compressed provider bytes before decompression;
- rejects ambiguous HTTP transport auto-decoding;
- bounds gzip output with `maxOutputLength`;
- parses JSON Lines record-by-record with strict UTF-8/JSON/card-shape checks;
- stamps observation/retrieval time at capture;
- never treats provider `updated_at` as proof the data was available before observation.

The live Scryfall workflow validates the small manifest only; it does not download/persist the large card dataset in CI.

Detailed source notes:

- `docs/V0.15_HISTORICAL_CARD_DATA_SOURCES.md`

### Important interpretation

The 4,395 TopDeck candidates are still **not** automatically retrospective ML rows. Current Scryfall/MTGJSON truth cannot be assigned an old cutoff. Rich historical features require either independently valid historical archive evidence or a retained contemporaneous capture that actually existed by the requested cutoff.

ML remains shadow/advisory only.

---

## NEXT IMPLEMENTATION TARGET

### Retained forward capture / content-addressed card-data snapshots

Because no adequate retrospective archive has been verified, continue with a forward evidence pipeline rather than weakening the historical gate.

Next work should:

1. define an immutable retained snapshot manifest;
2. address exact Scryfall `.jsonl.gz` bytes by SHA-256;
3. preserve source/discovery/observation/provider metadata and compressed size;
4. make retained snapshots replay-verifiable and mutation-resistant;
5. resolve the newest trusted capture available no later than a requested cutoff;
6. report explicit unavailable coverage when no capture existed by the cutoff;
7. keep retention/indexing bounded;
8. add a safe recurring capture/retention workflow only after storage semantics are defined;
9. continue searching for a genuine historical archive in parallel;
10. once captures overlap real outcomes, measure usable/rejected/unavailable predictor coverage before fitting any model.

After a trustworthy real corpus exists, seal a genuine future holdout before evaluating neural usefulness.

---

## Hard rules

Never weaken these to create more rows or make a test/model look better:

- Commander legality and dated rules truth;
- exact 100-card construction / command-zone rules;
- singleton/color identity;
- unresolved-card failures;
- exact printing existence/constraints;
- must-include / must-exclude;
- hard budgets;
- verified combo requirements;
- source-outage distinction from verified absence;
- historical no-future-knowledge;
- leakage prevention before normalization/model fitting.

Never reveal the `TOPDECK_API_KEY` secret.

---

## Validation discipline

For material work:

1. check exact head + PR #2 first;
2. isolate material changes where useful;
3. strict TypeScript/build;
4. complete deterministic suite;
5. dedicated provider live control when source shape matters;
6. Commander live regression for Commander/build changes or when the PR path gate requires it;
7. inspect underlying failure artifacts/steps;
8. distinguish provider outage/drift from code failure;
9. never weaken truth gates for CI;
10. fold only with non-force fast-forward when possible;
11. revalidate exact active lineage;
12. refresh handoff docs;
13. keep `main`, stable V0.13 and `server-current` untouched without explicit promotion approval.

After reading these files, always inspect the live repository state because this document may itself be a docs-only commit.