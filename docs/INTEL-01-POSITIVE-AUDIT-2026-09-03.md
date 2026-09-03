# INTEL-01 Positive Full-Table Audit — 2026-09-03

## Scope and provenance

This review covers the generic positive win-package control after it completed against the live providers and the checked-in V15 pipeline. The evidence is tied to one exact executable source; later evidence-writer commits are not treated as new code validation.

| Field | Value |
|---|---|
| Experimental branch | `agent/v15-native-deck-intelligence` |
| Pull request | #29, open and draft; unmerged |
| Executed source | `73eb089d7a0403666c322d961457f93edab675c` |
| Workflow run | `33810727022` — completed successfully |
| Commander | Frodo, Sauron's Bane |
| Requested target | Bracket 4, required bounded package, US$100 per-card cap |
| Selected package | `156-5342`: Bloodletter of Aclazotz + Scourge of the Skyclaves |

## Findings

| Severity | Finding | Evidence | Impact | Disposition |
|---|---|---|---|---|
| High / pass | Bounded package discovery completed with strict full-table closure. | Provider source was `complete`; the selected route was independently assessed as all-opponents, immediate, explicit-cards-only. | The package is a verified multiplayer win route, not an unscoped lethal claim. | Accepted as the INTEL-01 scenario proof. |
| High / pass | Package feasibility and physical-card truth held through construction. | Exact legal printings, per-card cap, independent resolution, Commander legality, exact 100 cards and singleton checks all passed. | No unresolved dependency, printing, budget or legality residue was carried into the finished deck. | Accepted. |
| High / pass | Atomic injection and package protection held. | Both selected seeds were injected exactly once; the selected combo ID survived final provider recognition; setup and exact-access audits were present with no missing pieces. | The builder did not merely discover a package; it carried the package through the real construction and evaluation path. | Accepted. |
| Medium / follow-up | The finished deck retained one recognized full-table route, although discovery exposed six distinct library routes and six fully independent alternatives. | `packageProof.meaningfulAlternateRoutesRetained=false`; final route count `1`; final distinct-library route count `1`; discovery portfolio distinct-library route count `6`. | The control proves one robust route, but it does not prove alternate-route resilience in the final 100-card list. | Keep INTEL-01 pass scoped to package proof; do not claim route-portfolio resilience. Revisit with a generic route-retention control. |
| Informational | The tested source is historical relative to the accepted INTEL-02 checkpoint. | Development checkpoint remains `77a5383fa7490aa91360b8186a4bda890f632157`; positive proof source is `73eb089...`. | The evidence validates the cited source only and does not promote the branch or checkpoint. | Preserve source-key provenance in the validation index. |

## Structural audit result

The control exercised the complete path: commander resolution → targeted plan normalization → bounded package discovery → strict closure and price checks → 100-card construction → independent resolution and legality → hard-truth evaluation → final route recognition → setup/interruption audit → exact card-access audit. The live workflow, persistence step, and current CI run all completed successfully. No stale failure artifact remains beside the persisted result.

The result is a scenario-intelligence pass for discovery, feasibility, injection, protection and final recognition. It is not evidence that the system is broadly intelligent, that every discovered route is retained, or that the accepted INTEL-02 checkpoint can move.

## Prioritized remediation plan

1. **Medium — route portfolio retention.** Add or run a generic control that requires at least two independently verified routes to survive in the final deck when the discovery portfolio offers them. Keep the requirement provider-aware and fail closed on partial data; do not add commander- or card-name-specific exceptions.
2. **Medium — next benchmark.** After this state reconciliation, run the FF-only Counter Blitz benchmark (#32) as the next materially different case. Record whether route retention, target gates, strategy preservation and exact printing/budget truth remain aligned.
3. **Low — provider-window maintenance.** Re-run the positive and restricted controls whenever pagination or policy inputs change. A bounded or unavailable provider window must remain `unknown`, never a negative claim.
4. **Low — checkpoint discipline.** Keep PR #29 experimental and leave `main`/V0.13 unchanged. Promote a new checkpoint only after INTEL-02 controls are mechanically green and manually reviewed together.

