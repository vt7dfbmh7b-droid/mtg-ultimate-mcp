# Stage 1 evidence inventory

**Historical Stage 1 inventory, published at e91b8877aa4823bab03e8b5c616e535307824314.** Preparation itself ran no software tests or benchmarks. Checksums establish file identity, not Commander quality. The preparation-time descriptions below are retained as history; current authority/status is in START-HERE.md. Historical summary registrations now live in test-results/bench01-stage1-records/historical-controls.json rather than the automated-writer registry.

## Already committed upstream

- Remote base: `34109290ba41693d9184ec21768fa65079302409` on the active recovery branch.
- Existing source-8606761c B5 result: `test-results/bench01-batch-a/counter-blitz/result.json` at that commit, with accompanying traces/logs.
- Existing CI [36311443690](https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp/actions/runs/36311443690) and Batch A [36311443685](https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp/actions/runs/36311443685) completed before this preparation. B5 quality targets remain failed.
- Historical narrow-repair verdict: `test-results/bench01-manual-verdicts/43e9c1c80dadfea4d53ed1a2affebd90131e362f.md`. It is not a new source-8606761c whole-deck acceptance.

## Prepared for publication

Directory: `test-results/bench01-bracket4-comparison/8606761c4d2e29cebb980bb06520b6aced459a1b/`.

It preserves 12 original evidence files, using gzip for larger JSON/JSONL files, plus a summary, preservation manifest and README:

- final B4 result, first pass and raw MCP result;
- provider HTTP capture and both process traces;
- stock/final deck lists and existing trial log;
- original anonymous reproducer as `.mjs.txt` and its saved output;
- the exact retained Scryfall manifest.

The manifest records original/stored SHA-256 and byte lengths. Decompression recovers the original bytes. No saved reproduction was executed. Its imports still name the original local worktree; it is preserved provenance, not a newly portable regression test.

Metadata under `test-results/bench01-stage1-records/` indexes existing observations. Execution/hard-truth observations are pass; both target-achievement rows are fail. This is not new validation or new acceptance.

## Recovered retained inputs

Artifact `10928372716`, run `36308429245`, source `4be988f0cd99015fb9e18207ae574158bf402f73`, was still available. The exact original artifact was recovered without acquiring a new snapshot.

| Item | Recorded and recovered identity |
| --- | --- |
| ZIP | 80,895,729 bytes; SHA-256 `35056e7815de9d49066fe29c22a61fb97434666fc32c9278d6b16fd09d571dba` |
| Compressed card data | 78,232,047 bytes; SHA-256 `d64aabfa50914fa4571479db29ea262af84b9a80eb0e34a251b168908556b7a4` |
| Manifest fingerprint | `01c73ca9a486e5fd7eee75cc740242e8345ec31eaacb8533ba2d569667fb6613` |
| Stock deck SHA-256 | `de5141f786f996dec4a9058fc4eafdf39a0e11d99f7eaf6214a65eae637237e3` |
| Evaluation time | `2026-09-12T08:30:39.498Z` |

Recovered archive: `/workspace/scratch/aa6cf5803176/counter-blitz-4be988f-evidence-recovered.zip`.

Recovered inputs: `/workspace/scratch/aa6cf5803176/counter-blitz-recovered-inputs/`, containing `scryfall-default-cards-retained.jsonl.gz` and `scryfall-retained-snapshot-manifest-v15.json`.

The manifest also names pinned OCI reference `ghcr.io/vt7dfbmh7b-droid/mtg-ultimate-mcp-carddata@sha256:2407618a9f3f4195665cd7db785458d1986ceefa78b11d80cf9df8815a6e4d09`. OCI retrieval was not attempted. The large raw snapshot is not added to Git; the existing artifact/OCI references and manifest identify it.

The GitHub artifact expires `2026-10-27T09:30:56Z`. Scratch and expiring artifacts are not permanent storage. Publishing the small B4 evidence package and deciding raw-input retention remain follow-up items. No remote publication or retention settings changed.

## Unusable older local copies — do not reuse

- `/workspace/scratch/aa6cf5803176/counter-blitz-4be988f-evidence.zip`: 18,977,792 bytes; unreadable ZIP; SHA-256 `87564b899d730d80d56bbf178dabf8a0c7210f9e7b3f159079c3453ffa15f0bb`.
- `/workspace/scratch/aa6cf5803176/counter-blitz-frozen-inputs/scryfall-raw/scryfall-default-cards-retained.jsonl.gz`: 56,136,704 bytes; differs from manifest; SHA-256 `d6df8494af23d8f43c7bd0af800fbc45b557d02be5d2da1284559ba3efe9e13b`.

These files were left untouched. Their present condition does not invalidate already completed recorded runs; future replay from those paths would be unsupported.

## Review limits

Stage 1 inspected saved JSON, source, documents, Git state and archive integrity. It did not run builds, test suites, planner reproductions, benchmarks, live card queries, deployment or schedules. Document rendering is not software validation. No new manual full-deck acceptance is granted. Recheck branch head and writers before any later publication; a push may start existing CI.
