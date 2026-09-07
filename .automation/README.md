# Autonomous replay requests

Files in this directory are data/control requests, not executable workflow definitions.

## BENCH-01 strategy-anchor replay

To request the existing five-fixture frozen replay without modifying GitHub Actions, create or update:

`.automation/bench01-strategy-anchor-replay.request`

The file must contain exactly one 40-character Git commit SHA (whitespace/newline is ignored). The SHA must identify an already-validated Commander product source whose `src/**` is unchanged at the request commit.

The checked-in replay workflow resolves this request, verifies the commit exists, proves the current `src/**` matches the requested frozen product source, runs the unchanged five-fixture batch, and persists evidence.

Scheduled/autonomous development must never edit `.github/workflows/**` to request a replay. It must also never modify `src/workflow-immutability.test.ts` or advance the workflow policy epoch. Those are interactive repository-maintenance operations only.
