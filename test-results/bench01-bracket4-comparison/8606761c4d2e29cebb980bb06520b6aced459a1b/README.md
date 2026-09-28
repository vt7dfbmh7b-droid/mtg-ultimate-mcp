# Existing Bracket 4 comparison evidence

Preserved outputs from the source-8606761c local capture/replay completed before the planning pause. No benchmark or reproduction was run to prepare this directory.

Read `summary.json` for recorded measurements and `preservation-manifest.json` for hashes, input references and provenance. Gzip files retain the original decompressed bytes. `role-detection-repro.mjs.txt` is an archival copy, not permission to execute it.

Recorded result: legal exact 100, eligible FF printings, 15 swaps, engine-assessed B3 against B4, countermagic 6/8, protection 7/8, route pieces present. The inherited 20-swap assertion fails too. Recorded two-process equality is true with no network fallback. Quality is incomplete; this is not a new accepted baseline.

B4 used Node 24.19.0 locally; CI uses Node 22.23.2. The retained data is dated 12 September 2026. Existing role counts have known false negatives. No perfectly runtime-matched comparison, corrected functional truth or independent bracket certification is claimed.

See `docs/STAGE-1-EVIDENCE.md` for existing B5 evidence, recovered retained inputs, unusable old copies and storage limitations. This directory is prepared for later approved publication. Tests, pushes and schedules remain paused.
