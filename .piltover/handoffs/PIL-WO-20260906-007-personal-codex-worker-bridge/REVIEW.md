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
