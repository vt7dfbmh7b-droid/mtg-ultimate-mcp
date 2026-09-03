# FF32 Scions & Spellcraft Audit — 2026-09-03

This is an isolated validation record for PR #32 (`agent/scions-spellcraft-ff-only-validation`). It is not a promotion or release decision. The stable `main` / V0.13 boundary and PR #29 remain unchanged.

## Exact evidence

| Item | Value |
|---|---|
| Executed source | `a079090a464fc60a90dacdf886fe9bed4fdce494` |
| Workflow | [Scions & Spellcraft FF-Only Precon Validation](https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp/actions/runs/33813323027) |
| Persisted evidence commit | `d136fe2` (`test-results: persist Scions FF-only validation`) |
| Ordinary CI | [run 33813323011](https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp/actions/runs/33813323011), passed |
| Control result | Failed the intelligence gate; build, direct mechanic tests and evidence persistence passed |
| Policy | Final Fantasy printings, exact Commander legality/100 cards, no new infinite combo, preserve Y'shtola noncreature-spell control/drain plan |

The workflow hardening in the same isolated branch is validated independently: it uses a non-cancelling concurrency group, corrects the metadata to `target_bracket=4` and `strategy=yshtola-spells-control-drain`, cleans stale root artifacts before execution, and retries latest-head evidence persistence up to eight times. The run persisted `run-metadata.txt`, `candidate-audit.json`, the raw result and a failure file. There is no persisted `result.json`, so a prior success cannot be mistaken for this failure.

## Observed behavior

The refinement accepted five swaps across four rounds because each individual pairing was marked locally preserved and the package improved the selected Bracket-4 construction gates. The final package remained legal and exact-sized, but its aggregate strategy signal regressed:

| Metric | Stock | Refined | Delta |
|---|---:|---:|---:|
| Cards | 100 | 100 | 0 |
| Spells-control affinity | 425 | 421 | **-4** |
| Y'shtola trigger spells | 29 | 27 | **-2** |
| Spells-control support cards | 46 | 46 | 0 |
| Average nonland mana value | 3.38 | 3.29 | -0.09 |
| Early plays | 20 | 22 | +2 |
| Fast mana | 1 | 3 | +2 |
| Tutors | 0 | 1 | +1 |
| Board wipes | 3 | 3 | 0 |
| Persistent colored sources | 7 | 6 | -1 (at the floor) |
| Assessed bracket | 2 | 3 | +1 |

The accepted swaps were `Sage's Nouliths → Brainstorm`, `Talisman of Dominance → Dark Ritual`, `Thought Vessel → Diabolic Intent`, `Eye of Nidhogg → An Offer You Can't Refuse`, and `Reaper's Scythe → Silence`. The last two were individually labelled preserved because both incoming cards matched the broad `spells-control` archetype, but their affinity scores were lower (8→5 and 8→7) and the package-wide loss accumulated. The first three swaps also consumed mana-rock or other structural roles that were not represented in the coarse spells-control total.

The final assertion therefore failed with:

```text
AssertionError: Scions refinement must not reduce whole-deck affinity with Y'shtola's spells-control plan
```

This is not a transport, build, provider, legality or persistence failure. The action gate correctly surfaced a behavioral defect in cumulative package acceptance.

## Finding and severity

**Medium/high — cumulative strategy-retention gap (open).** The per-swap preservation guard can accept a sequence of locally acceptable substitutions whose aggregate package reduces a substantive command-zone strategy's affinity and trigger density. This can hollow out a deck's identity while every individual swap reports `preserved` and the construction metrics improve.

Scope is currently branch-local: the evidence was generated from PR #32 source `a079090...`, which is not the accepted INTEL-02 checkpoint and is not the active branch head. It must be reproduced against the current executable active source before it is treated as a regression in the candidate architecture. Until then, it is a confirmed benchmark failure and blocks a uniform INTEL-02 claim for this family; it has no stable-runtime impact.

## Required remediation

1. Re-run the same FF32 scenario from one current active executable SHA (not from the isolated PR's older lineage) and retain exact before/after metadata.
2. Add a generic package-level strategy non-regression gate for substantive command-zone strategies. At minimum, the gate must account for cumulative affinity and trigger/support density, while preserving the existing per-swap component-family checks.
3. Keep the gate fail-closed when strategy evidence is incomplete; do not lower the assertion, exempt a named card, or add a Y'shtola-specific path.
4. Add anonymous deterministic coverage for a five-swap cumulative loss where every local pairing is non-negative or broadly matched but the package total falls. Preserve lower-bracket behavior and exact printing/legality/budget checks.
5. Re-run FF32 and the dependent Necron, Squirreled Away, Food and Fellowship, Middle-earth, and Marvel controls. Only a clean current-source family result may inform a future checkpoint review; PR #29 remains draft/unmerged.

## Residual-reference check

- `failure.txt` is present only under `test-results/scions-spellcraft-ff-only/` for this run.
- `result.json` is absent from that directory, eliminating stale-success ambiguity.
- The corrected `target_bracket=4` and strategy identifier appear in the persisted metadata and workflow, with no old `target_bracket=3` / `ysh-tola` metadata in the active FF32 workflow.
- No change was made to `main`, `server-current` V0.13, the accepted checkpoint `77a5383...`, or PR #29's merge state.

