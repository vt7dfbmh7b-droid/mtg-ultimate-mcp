# Stage 2 review — stop before recognition repair

Reviewed 28 September 2026 by the implementing agent. This is not an independent human review or Commander whole-deck acceptance.

**Verdict: bounded Stage 2 software safeguards complete and verified. Unattended-operation readiness is NOT established. Stop before Stage 3.**

## Exact evidence

- Stage 1 publication: `e91b8877aa4823bab03e8b5c616e535307824314`.
- Safeguard implementation: `146eb40040b846beb43274993d1dfdbb73fe55d9`; tree `f36c036efa2520e214fee5b5d863efb0d40b0dcd` matched the locally verified tree exactly.
- [Existing CI 36458755433](https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp/actions/runs/36458755433): success on that exact source, Node 22.23.2; 1157 tests, 1156 passed, zero failed, one skipped. All type checks, state/index checks, recovery smoke check and build passed.
- [Project State Integrity 36458755375](https://github.com/vt7dfbmh7b-droid/mtg-ultimate-mcp/actions/runs/36458755375): success. Writer `464acaa16c5ee9c104cb1840706af8f53391e635` changed only source metadata and the two generated validation views; safeguard source is unchanged.
- Local Node 24.19.0: strict production/scripts/project type checks, state/index checks, recovery check and 31 targeted tests passed (28 new safeguard tests plus three existing integrity tests).
- The earlier Stage 1 CI failure was a historical-evidence registration error, now corrected without modifying its integrity test or adding/changing a workflow. Original historical definitions, summaries and raw evidence remain preserved.

## What passed, and what did not advance

| Dimension | Result and limit |
| --- | --- |
| Engineering | Named-claim evaluator and accepted-state interface checks verified; failure cases block advancement |
| Evidence truth | Hash/provenance/schema checks verified; missing or incompatible evidence is not accepted; hashes do not prove producer honesty |
| Commander deck quality | No new quality acceptance, ranking change, recognition repair or whole-deck benchmark run |
| B4/B5 target achievement | Still failed in preserved evidence; narrow safeguard success does not close these targets |
| Accepted references | Broad `1ef10cec8` and narrow `43e9c1c8` unchanged; policy permits no new promotion contracts |
| Stable/protected state | Main/stable V0.13, PR #29, workflows, immutability guard, policy epoch and schedules untouched |
| Unattended enforcement | Not established; separately trusted policy ownership and run-ownership enforcement remain open |

## Review findings

1. Required failure families are tested: failed quality, absent/corrupt artifact, wrong source, fixture/runtime/input/snapshot mismatch, interrupted persistence and unapproved contract/policy change. Missing whole-deck review blocks acceptance.
2. A valid synthetic narrow repair passes even with an unrelated target unmet. Broad/target claims require target evidence. Scope/source checks prevent reusing a narrow receipt as broad acceptance.
3. Existing `project:update` refuses unsupported checkpoint changes before writing any state surface. Existing `project:validate` catches direct baseline edits. CLI regressions check unchanged bytes on refusal and interrupted persistence. No separate optional-only gate is substituted for these paths.
4. The candidate is limited to acceptance/state tooling, tests and documentation/evidence classification. Only four new acceptance-related files changed under `src/`; no Commander mechanism or ranking implementation changed. Protected-path diff is empty.
5. The same branch can still edit its verifier and pinned policy hash together. This implementation is a procedural/software guard, not a security boundary against an authorised repository writer. No tamper-proof or zero-monitoring claim is justified.
6. Whole-deck review quality, contract adequacy and producer independence remain review responsibilities. Multi-file state writes are not transactional; incomplete state must fail validation. Shared run ownership and scheduled-entry-point verification are deferred to the separately approved unattended stage.

## Next decision

If Justin approves Stage 3, repair only shared restricted-counterspell and land-type-search recognition, with anonymous public-planner regressions, affected and contrasting frozen evidence, symmetric incoming/outgoing handling and complete-deck review. Agree the claim contract before accepting that repair. Do not copy the reference deck, relax targets, broaden into package/ranking repair or resume schedules.

Stage 2 approval does not authorise Stage 3. No background recognition work is running. Read live head and active writers before a later authorised task; this review is a dated source-pinned record.
