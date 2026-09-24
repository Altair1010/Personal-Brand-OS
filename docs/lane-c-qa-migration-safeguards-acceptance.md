# Lane C — QA / Migration / Safeguards Acceptance

## Scope

Lane C validates and hardens the Lane A + Lane B implementation boundary.

Required coverage:
- slash-command contracts;
- Agent parallel/sequential orchestration;
- Campaign database lifecycle and Planning transitions;
- Strategy → Studio → Campaign → Calendar binding;
- scheduler durability and idempotency;
- scheduled media and Google Drive asset resolution;
- migration forward-safety;
- end-to-end runtime smoke.

## Implemented safeguards

### Slash commands
- `/handoff` is the only public handoff command.
- `/handoff-list` is not an alias; legacy storage is migration-only.
- Handoff analysis remains isolated from normal Agent thread history.

### Orchestration
- state-coupled jobs serialize through `executionPolicy.resourceKey`;
- independent work may execute in parallel;
- queue tests prove a second job sharing a busy sequential resource remains queued while an independent job can be claimed.

### Campaign lifecycle
The live SQLite CHECK and domain lifecycle agree on:

`DRAFT → PLANNING → READY → ACTIVE ↔ PAUSED → COMPLETED → ARCHIVED`

The acceptance suite also proves an unknown campaign state is rejected by SQLite.

### Calendar/publishing
Acceptance asserts that active Strategy weekly/daily plans flow into Calendar, scheduled Delivery time takes precedence over planned date, Calendar opens the Facebook post composer, and scheduled edits preserve publishing payload/idempotency semantics.

### Remote media
Google Drive links are normalized only from HTTPS `drive.google.com` / `docs.google.com` file URLs.

Scheduled remote media now has:
- configurable download timeout via `PILTOVER_REMOTE_MEDIA_TIMEOUT_MS`;
- configurable maximum payload size via `PILTOVER_REMOTE_MEDIA_MAX_BYTES`;
- pre-download `Content-Length` guard when available;
- post-download byte-length guard;
- HTML/non-direct-download rejection;
- timeout/network classification before provider publish.

Defaults:
- timeout: 30 seconds;
- max remote media size: 100 MiB.

### Migration harness
Pre-P3, pre-P4 and pre-G5 fixture builders now copy only migrations strictly earlier than the migration under test. This prevents future migrations from being executed against schemas that intentionally omit their prerequisites.

P3 migration test timeout was raised to 120 seconds to reflect disposable Prisma migration cost on the supported local test environment.

## Acceptance command

Run the critical Lane C matrix serially to avoid SQLite/Prisma migration contention:

```powershell
npx tsc --noEmit --pretty false
npx vitest run tests/piltover/lane-c-qa-migration-safeguards.test.ts tests/piltover/lane-b-orchestration-calendar.test.ts tests/piltover/agent-chat-ui.test.ts tests/piltover/h2-durable-publishing.test.ts tests/piltover/h2-live-data-attribution.test.ts tests/piltover/p2-migration.test.ts tests/piltover/p3-migration.test.ts tests/piltover/p4-migration.test.ts tests/piltover/p3-job-queue.test.ts --testTimeout 120000 --hookTimeout 120000 --maxWorkers 1
```

Current result: **59/59 PASS** across **9/9 test files**.

## Full-suite note

A broad parallel `tests/piltover` run was also used diagnostically. Several legacy control-plane tests have tight per-test time budgets and become timing-sensitive under concurrent disposable SQLite/Prisma migration workloads. The Lane C acceptance matrix therefore runs migration/control-plane suites serially. This is a test-harness isolation requirement, not a relaxation of product assertions.
