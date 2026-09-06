# P4 — ADVERSARIAL REVIEW

STATUS:
BLOCKED_BEFORE_IMPLEMENTATION

## MACHINE AUTHENTICATION

Finding: canonical semantics are incomplete. Falsifier: Worker ID or registration alone can impersonate a machine. Evidence: package requires authenticated identity but defines no credential lifecycle. Severity: CRITICAL. Resolution: Owner approval of the bounded proposal and ADR-0003.

## CREDENTIAL STORAGE

Finding: no approved server verifier or local secret-storage contract exists. Falsifier: plaintext reaches DB, Git, log, or evidence. Evidence: canonical security model forbids plaintext secrets. Severity: CRITICAL. Resolution: proposed non-recoverable verifier and Owner-only local storage outside Git.

## CREDENTIAL REVOCATION

Finding: P3 can revoke Worker state but has no separate machine credential. Falsifier: revoked credential continues authenticating. Evidence: no credential model exists. Severity: CRITICAL. Resolution: explicit credential lifecycle and mutation-time revalidation.

## AUTHN ≠ AUTHZ

Finding: separation is preserved in the proposal. Falsifier: credential bypasses capability, exact grant, ancestry, or lease. Evidence: P3 ports keep these authorities separate. Severity: CRITICAL. Resolution: all checks remain mandatory and independent.

## TENANT GRANT

Finding: exact Workspace/Brand grants remain authoritative. Falsifier: authenticated Worker without exact grant claims or mutates. Evidence: approved ADR-0002 and P3 registry/queue behavior. Severity: CRITICAL. Resolution: revalidate on every authoritative operation.

## CAPABILITY

Finding: capability is technical ability only. Falsifier: capability string grants tenant access. Evidence: approved P3 contract. Severity: HIGH. Resolution: independent exact set inclusion after authentication.

## LEASE

Finding: execution-envelope and mutation authority must be current-lease-bound. Falsifier: same-tenant Worker reads an unrelated Run. Evidence: P3 opaque lease fencing. Severity: CRITICAL. Resolution: no generic Run access; require matching Worker/job/lease.

## EXECUTION ENVELOPE

Finding: minimum fields are proposed but not implemented. Falsifier: envelope exposes unrelated tenant data or accepts a historical lease. Evidence: package context-minimization rule. Severity: CRITICAL. Resolution: implement only after contract approval.

## ARBITRARY RUN ACCESS

Finding: prohibited structurally by the proposed lease-bound API. Falsifier: `getAnyRun(workerId, runId)` exists. Evidence: no P4 route/code exists. Severity: CRITICAL. Resolution: preserve the boundary in typed tests.

## PATH TRAVERSAL

Finding: remote paths are prohibited; local aliases are proposed. Falsifier: absolute or `..` input resolves. Evidence: no P4 path resolver exists. Severity: CRITICAL. Resolution: canonicalize and contain locally after approval.

## WINDOWS JUNCTION/SYMLINK

Finding: lexical containment alone would be insufficient. Falsifier: approved alias resolves through a junction outside its root. Evidence: Windows target environment. Severity: HIGH. Resolution: final-target containment tests after approval.

## REMOTE SHELL RISK

Finding: no arbitrary command/executable/environment contract is proposed. Falsifier: network payload selects executable or argv. Evidence: proposed typed operations only. Severity: CRITICAL. Resolution: keep structurally absent.

## RAW JSON-RPC RISK

Finding: raw method/params remain infrastructure-private. Falsifier: network or application port accepts an arbitrary method name. Evidence: package CodexRuntimePort rule. Severity: CRITICAL. Resolution: semantic port only after approval.

## CODEX APPROVAL

Finding: consequential auto-approval is forbidden; exact behavior remains fail-closed. Falsifier: adapter approves every server request. Evidence: Owner gates and package approval model. Severity: CRITICAL. Resolution: bounded POC must avoid dangerous approval or pause safely.

## CODEX PROCESS CRASH

Finding: not yet tested. Falsifier: crash marks Run completed. Evidence: no adapter exists. Severity: HIGH. Resolution: failure-path test after gates.

## WORKER CRASH

Finding: P3 durability already preserves leased Jobs; P4 recovery is pending. Falsifier: restart trusts local lease state. Evidence: P3 reconnect contract. Severity: HIGH. Resolution: server truth wins.

## CONTROL-PLANE RESTART

Finding: transport recovery is pending selection. Falsifier: connection memory becomes authority. Evidence: P3 state is SQL canonical. Severity: HIGH. Resolution: selected transport must call P3 reconnect.

## CANCELLATION

Finding: local interrupt remains best-effort; P3 rejection is canonical. Falsifier: late Codex result overwrites cancellation. Evidence: P3 terminal fencing. Severity: CRITICAL. Resolution: preserve P3 truth and test after approval.

## RECONNECT

Finding: machine credential must be revalidated on reconnect. Falsifier: offline cached identity restores authority after revoke. Evidence: proposed contract. Severity: CRITICAL. Resolution: fresh request authentication plus P3 reconciliation.

## SECRET LEAK

Finding: no credential has been created. Falsifier: real credential appears in diff/log/event. Evidence: contract-only diff. Severity: CRITICAL. Resolution: staged-diff and repository secret scans remain required.

## DEPENDENCY SECURITY

Finding: BLOCKER. Falsifier: expose Worker route on direct production Next.js 15.3.4 while critical React Flight RCE is present. Evidence: fresh `npm audit --json`, 27 total advisories including 2 critical; npm recommends Next 15.5.25. Severity: CRITICAL. Resolution: Owner-approved targeted Next update and full regression before route exposure.

## P5 SCOPE LEAK

Finding: role/context/permission references remain opaque. Falsifier: P4 resolves or compiles them. Evidence: proposal contains no P5 implementation. Severity: HIGH. Resolution: defer to P5.

## OVERENGINEERING

Finding: proposal chooses one transport and no new dependency; stronger auth remains an alternative. Falsifier: broker, generic RPC, multi-runtime SDK, or VPS appears. Evidence: contract-only diff. Severity: MEDIUM. Resolution: retain minimum route.

## CONCLUSION

The machine-authentication/core-protocol decision and the reachable Next.js critical advisory independently block P4 implementation. No schema, migration, dependency, application, Worker, network route, or Codex adapter change is allowed before the Owner resolves both gates.
