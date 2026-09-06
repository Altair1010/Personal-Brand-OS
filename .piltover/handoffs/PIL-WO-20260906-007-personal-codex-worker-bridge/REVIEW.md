# P4 — ADVERSARIAL REVIEW

STATUS:
GATE_RESOLUTION_PASS

## MACHINE AUTHENTICATION

Finding: the machine identity contract is now approved. Falsifier: Worker ID or registration alone can impersonate a machine. Evidence: approved proposal and ADR-0003 require a public lookup ID plus random 256-bit bearer secret and verifier-only persistence. Severity: CRITICAL. Resolution: implement credential validation before every Worker mutation.

## CREDENTIAL STORAGE

Finding: approved persistence is non-recoverable. Falsifier: plaintext reaches DB, Git, log, or evidence. Evidence: ADR-0003 stores only SHA-256 verifier/lifecycle facts and permits one-time issuance only. Severity: CRITICAL. Resolution: enforce through schema/service tests and secret scans.

## CREDENTIAL REVOCATION

Finding: immediate revocation and server-clock expiry are approved but not yet implemented. Falsifier: revoked or expired credential continues authenticating. Evidence: approved 90-day maximum and 10-minute rotation overlap. Severity: CRITICAL. Resolution: implementation must fail closed and preserve Job durability.

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

Finding: PASS for the P4 Worker boundary. Falsifier: critical React Flight RCE remains or regression appears after patch. Evidence: exact Next.js 15.5.25 upgrade, fresh audit with the RCE absent, P1/P2/P3 and full 237-test regression PASS, production build PASS. Severity: CRITICAL. Resolution: retain remaining non-P4-reachable package/build debt and reassess before packaging/release.

## P5 SCOPE LEAK

Finding: role/context/permission references remain opaque. Falsifier: P4 resolves or compiles them. Evidence: proposal contains no P5 implementation. Severity: HIGH. Resolution: defer to P5.

## OVERENGINEERING

Finding: proposal chooses one transport and no new dependency; stronger auth remains an alternative. Falsifier: broker, generic RPC, multi-runtime SDK, or VPS appears. Evidence: contract-only diff. Severity: MEDIUM. Resolution: retain minimum route.

## GATE RESOLUTION LANES

- Credential: PASS — DB plaintext cannot authenticate; credential ID is not secret; Worker binding, expiry, revoke, and bounded overlap remain mandatory implementation checks.
- Transport: PASS — one Worker-initiated HTTPS polling transport; no inbound workstation dependency or parallel transport.
- Framework security: PASS — Next 15.5.25 builds and regresses; the blocking RCE is absent.
- Authority: PASS — authentication remains identity only and cannot replace tenant grant, capability, ancestry, or lease.

## CONCLUSION

The P4 security/contract entry gate is PASS. Bounded implementation may resume in the same Work Order. No Worker route, schema, runtime, or Codex adapter was introduced during gate resolution.
