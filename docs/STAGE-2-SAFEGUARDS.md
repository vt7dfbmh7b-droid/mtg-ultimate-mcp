# Stage 2 safeguards — bounded implementation and review

## Authority and status

Justin approved Stage 1 publication and bounded Stage 2 safeguards, necessary tests and existing CI. Stop after Stage 2 review, before recognition repair. Stage 1 was published at `e91b8877aa4823bab03e8b5c616e535307824314`; its existing integrity writer completed at `a38bb72f6abf9e3336d2cc16ec39bf88a0e73d84`.

Current status: implemented locally, local verification passed; exact-commit CI and final review pending. This document is not a new Commander-quality acceptance. Stable V0.13, broad baseline `1ef10cec8`, narrow checkpoint `43e9c1c8`, PR #29, protected workflows/guard/epoch and paused schedules remain unchanged.

## Implemented path

`src/acceptance-gate.ts` reads a receipt referencing a contract and whole-deck review, both by path and SHA-256. Contracts are strict, versioned and allowlisted by exact hash in separately loaded policy. Contracts bind claim ID, source SHA, evaluator revision, fixture, exact runtime identity, input and snapshot hashes, required observations and full-deck evidence. Artifacts may be JSON, gzip JSON or text. Hashes are checked before parsing; escaping paths and symlinks are refused.

The evaluator returns pass, fail or unknown plus separate engineering, truth, deck-quality and target observations. Any failed required observation/provenance rejects the claim. Missing, malformed, mismatched-hash or incomplete evidence produces unknown and blocks acceptance; known failure dominates unknown. No boolean coercion or editable PASS summary substitutes for required artifact observations.

Every contract requires engineering, truth and deck-quality observations. Broad/target claims additionally require target observations. A narrow claim may leave unrelated targets unclaimed (reported unknown, not pass). A complete-deck review must cover every exact artifact, the source, contract and claim; include a hashed narrative; and explicitly accept. Agent review remains labelled agent review, not independent human review. Software cannot establish whether a prose review is strategically sound.

`src/acceptance-state.ts` pins `acceptance-policy.json` by SHA-256 and retains existing accepted anchors. New checkpoint, broad-baseline or newly validated-milestone claims require passing receipts with matching claim/source/scope. Stable-field changes are refused under this policy. `scripts/project-state-lib.ts` invokes this check in both existing `project:update` (before any write) and `project:validate` (including existing CI). Hand-editing accepted-state fields is therefore checked too. A corrupt policy blocks validation even when no baseline changes.

The initial policy approves **no new promotion contracts**. Stage 2 establishes the interface and tests; it does not pre-approve a future recognition repair. `scripts/evaluate-acceptance.ts <receipt.json>` is a read-only diagnostic entry point; pass exits 0, fail/unknown exit 1. It loads the pinned policy, never policy supplied inside the receipt. Existing metadata index remains informational, not promotion authority.

## Historical registry correction

Stage 1 CI `36456549050` passed type checks, state/index/recovery checks and build, then reported 1127 test passes, one failure and one skip. The failure was `every registered evidence writer regenerates and stages derived validation state`: historical B4/B5 manual summaries have no automated writer.

The four historical definitions are preserved unchanged in `test-results/bench01-stage1-records/historical-controls.json`, with their original summaries and source artifacts retained. They are removed only from the automated-writer registry/index, which returns to its nine original controls. No workflow, assertion, test exclusion or policy epoch is changed to conceal the failure. B4/B5 target failures remain explicit in project state and recovery documents.

## Verification performed locally

- Node 24.19.0; dependencies installed with lifecycle scripts disabled. Existing CI uses Node 22.23.2 and remains the exact-source verification authority.
- Production TypeScript build passed. Automation/E2E scripts were compiled with the existing strict configuration into ignored temporary build output.
- Project-state and validation-index checks passed through the compiled existing scripts; generated documents and index are synchronized.
- 28 new gate/CLI tests and three unchanged repository-integrity tests passed (31 total).
- Coverage: valid narrow acceptance with unmet target; rejected engineering/truth/quality; missing contract/artifact/deck/review; source/fixture/runtime/input/snapshot mismatch; absent observations; corrupted/interrupted persistence; changed policy/contract; review coverage/source/decision; path escape; gzip; unsupported state promotion; direct state edits; before-write refusal with state bytes unchanged.
- One adapter regression consumes the preserved B4 raw result and still reports target failure. It does not rerun a benchmark or retroactively certify missing historical provenance/review.

The earlier local tsx CLI could not open its IPC socket. Local tests run compiled JavaScript under Node; CLI regressions use Node's supported tsx loader without a CLI IPC socket. No permission, workflow or runtime-pin change was made. Normal existing CI still runs its original commands.

## Trust and persistence limits — do not overclaim

The pinned hash prevents unnoticed policy-only edits and unknown contracts through these interfaces. A writer able to edit both verifier and hash can still weaken them. Existing CI executes candidate-branch code; it is **not** separately trusted promotion authority. Before claiming unattended enforcement, separately authorized maintenance must establish trusted policy ownership, required checks and acceptance authority outside candidate control. This stage does not configure repository protections.

Evidence hashes establish bytes, not the honesty or independence of their producer. Contract adequacy and whole-deck review remain substantive review responsibilities. No zero-regression guarantee is made. Existing project-state/generated-document writes are not a multi-file transaction; interruption leaves invalid/stale state that validation must reject, not a silently accepted checkpoint. No new atomic shared-run lock or schedule execution was built; Stage 4 remains paused.

## Final-review checklist

1. Exact candidate CI succeeds using unchanged workflows; inspect counts and failures rather than status alone.
2. Project State Integrity writer finishes; inspect its diff and final live head before further writes.
3. Protected files, accepted anchors and Commander recognition/ranking code remain unchanged.
4. Preserve exact CI/source references and distinguish software gate success from product quality.
5. Stop here. Recognition repair needs Stage 3 approval; unattended operation needs separate maintenance and Stage 4 approval.
