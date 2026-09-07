# P4 — ADVERSARIAL REVIEW

STATUS: TECHNICALLY_COMPLETE

## MACHINE AUTHENTICATION
Finding: identity uses a public ID plus 256-bit secret. Falsifier: ID alone authenticates. Evidence: verifier-only persistence and invalid-credential tests. Severity: CRITICAL. Resolution: PASS.

## CREDENTIAL STORAGE
Finding: plaintext is returned once and cannot be recovered. Falsifier: DB or Git contains usable material. Evidence: DB assertion and secret scan. Severity: CRITICAL. Resolution: PASS.

## CREDENTIAL REVOCATION
Finding: revoke and expiry are immediate server-clock truth. Falsifier: revoked credential authenticates or rotation races revoke. Evidence: lifecycle tests and transactional compare/update. Severity: CRITICAL. Resolution: PASS.

## AUTHN ≠ AUTHZ
Finding: authentication returns Worker identity only. Falsifier: credential bypasses status, capability, grant, ancestry, or lease. Evidence: application and P3 authority boundaries. Severity: CRITICAL. Resolution: PASS.

## TENANT GRANT
Finding: exact Workspace/Brand grants remain mandatory. Falsifier: capability-only Worker receives envelope. Evidence: execution-envelope negative test and P3 suite. Severity: CRITICAL. Resolution: PASS.

## CAPABILITY
Finding: exact set inclusion is revalidated. Falsifier: missing capability executes. Evidence: envelope and P3 claim logic. Severity: HIGH. Resolution: PASS.

## LEASE
Finding: every execution lookup and authoritative mutation is current-lease-bound. Falsifier: wrong Worker or historical lease succeeds. Evidence: envelope and P3 fencing tests. Severity: CRITICAL. Resolution: PASS.

## EXECUTION ENVELOPE
Finding: only leased task data, opaque references, and repository alias are exposed. Falsifier: arbitrary Run/local path appears. Evidence: strict schema and integration assertions. Severity: CRITICAL. Resolution: PASS.

## ARBITRARY RUN ACCESS
Finding: no generic Run lookup exists for Workers. Falsifier: grant-only enumeration API. Evidence: eight fixed semantic routes. Severity: CRITICAL. Resolution: PASS.

## PATH TRAVERSAL
Finding: remote paths are structurally absent. Falsifier: absolute, traversal, mixed separator, or unknown alias resolves. Evidence: local resolver tests. Severity: CRITICAL. Resolution: PASS.

## WINDOWS JUNCTION/SYMLINK
Finding: final real path is checked, not only lexical path. Falsifier: junction exits root. Evidence: junction test. Severity: HIGH. Resolution: PASS.

## REMOTE SHELL RISK
Finding: network contracts cannot select executable, argv, environment, or shell. Falsifier: raw command property accepted. Evidence: strict body rejection and fixed client routes. Severity: CRITICAL. Resolution: PASS.

## RAW JSON-RPC RISK
Finding: App Server methods are infrastructure-private and fixed. Falsifier: caller supplies method/params. Evidence: semantic CodexRuntimePort and route schemas. Severity: CRITICAL. Resolution: PASS.

## CODEX APPROVAL
Finding: server approval requests fail closed. Falsifier: adapter auto-approves. Evidence: adapter terminates and emits APPROVAL_REQUIRED. Severity: CRITICAL. Resolution: PASS.

## CODEX PROCESS CRASH
Finding: exit/startup/frame/execution failures cannot produce completion. Falsifier: crash maps to COMPLETED. Evidence: bounded adapter state and live proof. Severity: HIGH. Resolution: PASS.

## WORKER CRASH
Finding: P3 lease and Job remain canonical. Falsifier: local memory owns Job. Evidence: stateless polling client and P3 durability regression. Severity: HIGH. Resolution: PASS.

## CONTROL-PLANE RESTART
Finding: reconnect reloads P3 truth. Falsifier: connection state restores authority. Evidence: authenticated reconnect route and P3 reconnect tests. Severity: HIGH. Resolution: PASS.

## CANCELLATION
Finding: local interruption is best-effort while P3 terminal fencing is authoritative. Falsifier: late result overwrites cancellation. Evidence: authority-loss Worker test and P3 cancellation suite. Severity: CRITICAL. Resolution: PASS.

## RECONNECT
Finding: every reconnect request reauthenticates and P3 revalidates Worker/grant/lease. Falsifier: offline cached credential restores access. Evidence: fixed route plus P3 negative cases. Severity: CRITICAL. Resolution: PASS.

## SECRET LEAK
Finding: Worker credential is absent from events, child environment, audit metadata, Git, and logs. Falsifier: staged diff contains usable secret. Evidence: event minimization and final secret scan. Severity: CRITICAL. Resolution: PASS.

## DEPENDENCY SECURITY
Finding: blocking Next.js RCE is absent on 15.5.25; production audit has no critical finding. Falsifier: vulnerable Next remains resolved or P4-reachable Critical/High remains. Evidence: `npm ls`, fresh all/production audits, build and full regression. Severity: CRITICAL. Resolution: PASS with recorded non-reachable debt.

## P5 SCOPE LEAK
Finding: role/context/permission references remain opaque. Falsifier: resolver/compiler appears. Evidence: diff scope. Severity: HIGH. Resolution: PASS.

## OVERENGINEERING
Finding: one SQL credential model, one HTTPS polling transport, standard library crypto/process APIs, and no new dependency. Falsifier: broker, WebSocket, SDK, VPS, or second auth system. Evidence: dependency and diff review. Severity: MEDIUM. Resolution: PASS.

## FIVE-AXIS CODE REVIEW

- Correctness: PASS after credential temporal-race, event identity, lease-renewal starvation, and bounded-process findings were corrected and re-tested.
- Readability: PASS; semantic application ports isolate infrastructure details.
- Architecture: PASS; P1 module-boundary suite is green after application dependency direction was corrected.
- Security: PASS for the default-disabled P4 boundary; auth, exact grant, capability, lease, local path, secret, body, and process constraints are independent.
- Performance: PASS for initial one-Owner scale; polling and SQL operations are bounded, with no speculative broker.

## CONCLUSION

P4 is TECHNICALLY_COMPLETE on its phase branch. Canonicalization remains PENDING OWNER GATE. P5 has not started.

## G5 MACHINE IDENTITY AUTHORITY CLOSURE

### Authentication lane

Finding: each credential record still binds to exactly one Worker, stores only a verifier, and returns only an authenticated Worker principal. Tenant grants, capabilities, and leases were not copied into authentication. Resolution: PASS after targeted and full regression.

### Governance lane

Finding: R1 authorized issue/revoke from one caller-selected target, allowing an A-only actor to control a global identity with an active B grant. Resolution: whole-Worker enumeration now requires P2 `agent.manage` for every ACTIVE exact Workspace and Brand grant inside the credential transaction. Zero-active-grant tenant governance fails closed. Targeted cross-tenant issue/revoke and local grant isolation falsifiers PASS; full regression PASS.

### Rotation lane

Finding: R1 self-rotation calculated `now + lifetime`, allowing repeated bearer rotation to extend compromise indefinitely. Resolution: each human issuance creates an immutable `familyExpiresAt`; replacements inherit it and use `min(now + requested lifetime, familyExpiresAt)`. Authentication checks both record and family expiry. Repeated-rotation and stolen-bearer falsifiers PASS; full regression PASS.

### Tenant authorization lane

Finding: credentials remain global identity only. Tenant execution still requires P3 exact active grant, active ancestry, capability coverage, and current lease. Local tenant removal revokes the exact grant and does not revoke global identity or unrelated grants. Resolution: targeted PASS; P3 regression PASS.

### Concurrency lane

Finding: a grant-set snapshot followed by credential mutation outside one transaction would permit a stale authorization commit. Resolution: Worker resolution, active-grant enumeration, every exact-scope authorization decision, and credential mutation use one explicit SQLite Serializable Prisma transaction. Concurrent writers serialize or abort. A grant added after issuance remains an explicit authorization by that tenant's administrator. No distributed lock was added. Resolution: implementation review and full regression PASS.

SQLite takes a database write lock for the forward table-rebuild migration. Production execution was neither authorized nor performed. If later authorized, it requires a controlled maintenance window and verified backup. Migration tests verify row preservation, fail-closed family-expiry backfill, indexes, foreign keys, and idempotent deployment.

### Revocation semantics

Credential revocation is record-specific. Revoking an old rotated record does not disable the replacement and makes no family-wide claim. `Worker` disable/revoke is the existing whole-machine-identity kill switch. Exact tenant grant revoke is the local tenant isolation operation.

### Stolen credential threat model

An attacker holding only a valid bearer secret may authenticate and self-rotate while the record and family remain valid. The attacker cannot extend the family horizon, create a fresh family without a human P2 identity governing every active grant, change capabilities, change or revoke grants, or gain tenant authority absent an explicit active P3 grant. After family expiry, every credential in that family fails authentication.

### G5 conclusion

Five independent lanes PASS: authentication, governance, rotation, tenant authorization, and concurrency. The live Codex proof PASS, all required regressions PASS, and P4 remains a technically complete phase candidate pending the separate Owner canonicalization gate. P5 has not started.

## P4 PHASE RELEASE REVIEW

### Reverse-graph conclusion

The reviewed integrated phase has one safe authority chain: remotely verified P4 code establishes
global Worker identity; P3 exact grants establish tenant authority; capabilities establish technical
eligibility; the current lease fences each attempt; the local immutable alias resolves filesystem
authority; and the fixed Codex adapter owns runtime authority. No credential, route, envelope, or
runtime shortcut collapses these layers. P5 remains blocked because P4 is not canonical.

### Axis A — Correctness: PASS

All phase terminal transitions remain owned by P3. Live runs reached `COMPLETED` through real App
Server protocol state, and targeted tests denied stale, wrong-Worker, revoked, expired, cancelled,
and authority-lost mutations. Late results cannot replace newer canonical state.

### Axis B — Security: PASS

Whole-Worker governance and immutable family expiry close the G5 cross-tenant and stolen-bearer
defects. Exact grant, capability, lease, bounded body, strict schemas, final-real-path containment,
no-shell execution, private fixed JSON-RPC, approval fail-closed, event/result secret rejection, and
child-environment credential stripping remain independent. Fresh tracked-file and live-log signature
scans found no real secret. The production audit contains zero critical advisories and no reviewed
Critical/High path is materially reachable through the P4 Worker boundary.

### Axis C — Durability: PASS

Disconnect, restart, reclaim, grant loss, Worker disable, credential revoke, lease expiry, and
cancellation defer to P3 persisted state and lease fencing. The Worker reconnects by querying server
truth; connection or process memory cannot restore authority.

### Axis D — Operability: PASS

Credential authentication/rotation, heartbeat, polling, lease renewal, reconnect, bounded Codex
execution, result submission, shutdown, and cleanup are deterministic at the verified one-Owner
scale. Two consecutive real runs completed inside independent 240-second process deadlines with zero
matching App Server or fixture orphan after each run. The historical long-running symptom was not
reproduced and therefore was not patched.

One non-product anomaly was isolated during verification: concurrent P2 and P3 Prisma-heavy test
processes caused a P2 fixture setup hook to exceed ten seconds. The same backup file passed alone,
and the entire P2 suite passed without timeout changes when executed with one Vitest worker. Root
cause: verification-harness resource contention. Smallest correction: serialize that regression
lane. Failure transfer: none to runtime or product state.

### Axis E — Architecture: PASS

The phase remains a modular-monolith P4 bridge: outbound HTTPS polling, a semantic runtime port,
one local resolver, one credential model, no broker, no WebSocket, no inbound workstation port, no
generic remote execution, no second authorization system, and no P5 resolver/compiler/orchestrator.
The exact phase diff contains no unexplained PBOS feature mutation.

### Migration review

The G5 table rebuild copies every pre-existing credential column, restores all four foreign keys,
the primary key, unique successor constraint, and both lookup indexes, and preserves rotation IDs.
Clone `foreign_key_check` returned no rows. Connected legacy chains receive the minimum evidenced
expiry; no record expiry or family authority is extended. The current development clone had no
credential rows, so invalidation was zero. A future populated database may require re-enrollment
after fail-closed shortening. SQLite write locking requires a verified backup and coordinated
maintenance window; no production migration was performed.

### Final finding

No Critical or required release blocker remains. P4-G6 is PASS and may be integrated by strict
fast-forward into the P4 phase branch. Master canonicalization remains an explicit Owner gate;
`CANONICAL_DONE` must not be set and P5 must not start.
