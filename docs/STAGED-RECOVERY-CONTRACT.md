# Staged recovery contract

Prepared 28 September 2026 from Justin's planning pause and Stage 1 request. This is a proposed repository update, not an authorization to run later stages.

## Authority and stage mapping

The longer review plan uses P0–P6 for technical work packages. The user-facing authorization stages below control execution. P0 checkpoint reconciliation corresponds to Stage 1 preparation; the new acceptance safeguards precede the first product repair. Do not mistake a roadmap entry for current permission.

| Stage | Scope | Exit condition | Current status |
| --- | --- | --- | --- |
| 1 — Handoff preparation | START HERE, coordinated proposed state/documents, existing evidence preservation | Package is internally consistent and reviewable; publication limits are explicit | Prepared locally; publication and software validation pending |
| 2 — Safeguards | Structured acceptance evaluator and checks on accepted-baseline transitions through approved interfaces | Authorized failure cases block advancement, a valid narrow claim can pass, accepted state is preserved | Not implemented; execution approval required |
| 3 — Recognition repair | Restricted spell counters and land-type searches across discovery, planner, metrics and explanation | Authorized regressions, affected/contrasting controls and complete-deck review support narrow acceptance | Not implemented; execution approval required |
| 4 — Unattended operation | Actual scheduled entry point, shared run ownership and recovery | Safeguards verified through that entry point and schedule resumption explicitly authorized | Paused |

Stage 2 approval does not authorize main/stable promotion, PR #29 merging, protected workflow/guard/policy-epoch edits, changing repository permissions or restarting schedules. If any are necessary, prepare a concrete maintenance proposal and stop that operation for approval.

## Immediate next task after Stage 1 review

The next decision is whether to authorize publication of the reviewed handoff package and the bounded Stage 2 work, including its necessary tests. No push is allowed during the current no-testing pause: existing CI may run on a push. Do not use skip flags or temporary workflows to evade that boundary.

Before publication, inspect current head and active writers again. Review this complete diff against the then-current branch. Preserve the broad accepted baseline and the existing narrow accepted repair. Do not publish blindly if the source changed.

## Stage 2 task definition

**Problem:** execution success and state-document consistency can coexist with failed deck-quality targets. Recorded results need a separate acceptance decision for a named claim.

**Minimum deliverable:** a small evaluator that reads existing structured artifacts, checks provenance and an explicit contract, and returns pass, fail or unknown. Both fail and unknown block advancement of that claim. A narrow repair can pass while an unrelated B4/B5 target remains failed.

**Bindings:** claim ID, product source, evaluator/contract revision, fixture, runtime, input/snapshot hashes, required observations and whole-deck review reference. Do not trust only an editable summary saying success. Keep engineering completion separate from truth, deck quality and target achievement.

**Transition rules:** candidate work does not change the broad accepted baseline or stable runtime. Changes to accepted status need the required evidence and recorded complete-deck review. A candidate cannot silently weaken its own acceptance policy. Server-side protection and trusted promotion authority must be established through separately approved maintenance before claiming unattended enforcement.

**Future verification, not run in Stage 1:** failed quality, missing artifact, wrong source, incompatible snapshot/runtime, interrupted persistence and unapproved policy changes must block acceptance. A valid narrow repair must not be blocked merely because the original B5 target remains unmet. Shared-run ownership and overlapping-writer cases are required before Stage 4; inspect existing interfaces before choosing an implementation.

**Scope boundary:** extend existing state/validation machinery; do not build a new automation platform or modify Commander ranking as part of this gate.

## Stage 3 task definition

Repair the confirmed generic wording failures first. Use anonymous positive and negative examples through the public planner. Distinguish qualified spell counters from counter placement and “cannot be countered” text; distinguish land-type search to battlefield from search to hand, replacement-only land movement and unsupported color access.

Correct evidence must reach incoming and outgoing cards, queries, metrics and explanations. The defect is missing role information, not a permanent ban on cutting any named card. No card-name, commander-name or benchmark-specific workaround.

Later conditional-ability, contextual-tutor, package-selection and bracket-calibration work is a roadmap. Do not start it without a bounded task justified by evidence. Do not change bracket thresholds merely to produce a pass.

## Product requirements retained

Start from untouched Counter Blitz stock with Tidus, Bant legality, exact 100 cards and verified eligible physical FF printings. Preserve counters, proliferate, countermagic, combat, protection and the requested White Mage/Ballista route. The historical/supplied Tidus list is comparison-only and must never seed generation.

Keep the original B5 challenge and current assertions intact. B4 is a separately recorded comparison/practical proposed milestone. Existing role totals contain known recognition defects; an engine B3 label is not independent bracket certification. Do not claim FF pool exhaustion without a complete eligible-candidate and rejection audit. Do not introduce a new Tidus budget or borrow Liliana's NZ$500 constraint.

## Operating rules after execution is authorized

One bounded task and one branch-writing operation at a time. Reuse matching completed evidence. An actual shared owner/expected-head check is needed for unattended mutation; a read-only preflight alone is not an atomic lock. A stale heartbeat does not permit a second writer until the first operation's status is resolved.

Retry a classified transient provider failure only within an explicit limit. Do not repeatedly rerun deterministic failures. After two unsuccessful substantive repairs to the same hypothesis, stop for a design review. Preserve rejected work and evidence; never reset the accepted reference merely to hide a failure.

Use existing immutable workflows. Freeze product source and inputs within comparisons. A changed evaluator requires fair re-auditing of incumbent and candidate so changed measurements are not mistaken for changed deck strength. Unknown evidence stays unknown.

At repair checkpoints, review the entire final deck and meaningful rejected alternatives. Agent review is not an independent human review. New strategic mistakes can escape automated checks; no zero-regression guarantee is made.

## Reports

Every completion report states the named claim, exact evidence, engineering/truth/deck-quality/target outcomes, open issues and the next authorized action. Justin should see meaningful checkpoints and exceptions, not repeated approvals for routine steps inside an approved stage. Never claim background progress unless an actual authorized operation is running.
