# P2 Canonical Contract Addendum

## Status

PROPOSED

This addendum is not canonical until the Owner approves it. It defines the minimum physical and
authorization contract needed to resume P2. It does not authorize schema or application changes.

Revision R1 records the Owner decision `CHANGES REQUIRED` and corrects four root causes:

- revocation/readmission privilege reset;
- a distinct Workspace lifecycle capability;
- transitional PromptRun tenant ownership and isolation;
- minimal AuthIdentity cardinality.

## Problem

The canonical package fixes the Organization -> Workspace -> Brand hierarchy, seven role names,
explicit tenant resolution, and deny-by-default behavior. It does not fix the physical identity
mapping, membership and scoped-role representation, permission matrix, inheritance, lifecycle and
delete rules, or the physical MetricObservation model. Those choices affect trust boundaries,
persistent schema, backfill correctness, and authorization outcomes, so Technical Constitution C7
requires an Owner-approved contract before mutation.

## Design Constraints

- Authentication, membership, and authorization remain separate.
- IDs, verified relations, and active state are authority; display names are not.
- A Membership establishes an Organization relationship but grants no capability without a role.
- Authorization is an allow-list union of valid roles at the target and its ancestors. There are no
  implicit grants or explicit deny records in P2.
- All new tenant access is server-authorized. Missing, inactive, unknown, or inconsistent state
  denies access.
- Existing PBOS fields and records remain in place during the additive compatibility window.
- SQLite foreign keys and compound unique constraints are preferred over polymorphic references.
- Important tenant, metric, and membership history is archived or revoked, not cascade-deleted.

## Identity Contract

### Recommended physical model

`UserIdentity` is a new physical security principal and is separate from profile/business metadata.

| Field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. Generated once and persisted. |
| `status` | `ACTIVE` or `DISABLED`; only `ACTIVE` may authorize. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |

Authentication subjects are stored separately so one principal may later link another approved
provider without changing the principal or profile:

| `AuthIdentity` field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. |
| `userIdentityId` | Required FK to `UserIdentity`. |
| `provider` | Normalized provider key; P2 recognizes `supabase` for the current binding. |
| `subject` | Opaque provider-issued authentication subject. Never a display name or email. |
| `createdAt`, `updatedAt` | Timestamps. |

Constraints:

- `UNIQUE(provider, subject)` prevents one auth subject from resolving to two principals.
- No uniqueness constraint applies to `(userIdentityId, provider)`. One principal may have multiple
  subjects from the same provider in a future approved use case; P2 adds no UI or linking workflow
  for that possibility.
- `UserProfile.userIdentityId` is a nullable, unique FK added during compatibility.
- One profile maps to at most one identity, and one identity maps to at most one legacy profile.
- A `UserIdentity` may exist without `UserProfile`; a legacy profile may temporarily exist without an
  authentication subject.
- Multiple `UserProfile` rows must never be merged into one identity by backfill.

### Legacy authentication mapping

- For `UserProfile.id = "local"`, a non-empty `AppState.supabaseUserId` creates one `AuthIdentity`
  with provider `supabase` and that exact subject.
- The binding is not applied to any other profile and is never assigned by a first-row heuristic.
- If the same Supabase subject would map to multiple identities, backfill stops with a conflict.
- A purely local legacy profile receives a `UserIdentity` and tenant graph but no fabricated remote
  auth subject. Existing legacy routes remain compatible; new Piltover server operations require a
  verified actor and therefore fail closed until a real auth subject is linked.
- This contract does not replace Supabase or change the current auth provider.

## Organization Contract

| Field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. |
| `name` | Required display name; never used for authorization. |
| `status` | `ACTIVE` or `ARCHIVED`. |
| `archivedAt` | Nullable; required when status is `ARCHIVED`. |
| `createdAt`, `updatedAt` | Timestamps. |

Organization names are not unique. Bootstrap ownership is represented only by an active
Organization Membership whose `organizationRole` is `OWNER`; no `ownerId` shortcut is stored.
P2 performs no hard Organization deletion. Archival is the only P2 lifecycle mutation.

## Workspace Contract

| Field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. |
| `organizationId` | Required FK to the parent Organization. |
| `name` | Required display name; not an authority key. |
| `status` | `ACTIVE` or `ARCHIVED`. |
| `archivedAt` | Nullable; required when archived. |
| `createdAt`, `updatedAt` | Timestamps. |

Workspace names are not unique. `UNIQUE(id, organizationId)` exists to support same-tenant compound
foreign keys. An active Organization role grants its capabilities to descendant Workspaces. A
Membership without an Organization role grants no Workspace visibility. A WorkspaceRoleBinding
may grant access only to that Workspace and its Brands.

P2 performs no hard Workspace deletion. An archived Organization makes every child Workspace and
Brand effectively archived. An archived Workspace makes every child Brand effectively archived.

## Brand Contract

| Field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. |
| `organizationId` | Required tenant FK, matching the parent Workspace Organization. |
| `workspaceId` | Required FK to the parent Workspace. |
| `name` | Required display name; not an authority key. |
| `status` | `ACTIVE` or `ARCHIVED`. |
| `archivedAt` | Nullable; required when archived. |
| `createdAt`, `updatedAt` | Timestamps. |

Brand names are not unique. A compound FK from `(workspaceId, organizationId)` to Workspace prevents
a Brand from naming a Workspace in another Organization. Compound unique keys on the Brand identity
and ancestry support same-tenant references from scoped bindings and future Brand-owned tables.

`BrandDNA` is retained. P2 adds nullable transitional `organizationId` and `brandId` fields, backfills
them, and requires `brandId` to be unique because the legacy table contains one current DNA record
per legacy owner. `BrandDNA.userId` and all content fields remain unchanged. Immutable
`BrandDNAVersion` adoption and removal of legacy ownership are later expand-migrate-contract steps.

P2 adds nullable transitional `organizationId` and `brandId` columns to every directly Brand-scoped
legacy model listed in the backfill section, plus the applicable tenant-filter indexes. User-owned
ContentTemplate and Framework rows receive the same columns; global rows keep both null.
FacebookAccount receives nullable `organizationId` and `brandId`, and adds tenant-local uniqueness on
`(brandId, pageId)` while retaining `(ownerRef, pageId)` for legacy compatibility. Derived descendants
do not receive redundant Brand columns when their parent relation is the enforced ownership path.
No transitional column becomes required until a later verified zero-unmapped migration.

## Membership Contract

| Field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. |
| `userIdentityId` | Required FK to `UserIdentity`. |
| `organizationId` | Required FK to Organization. |
| `organizationRole` | Nullable canonical role. `OWNER` is valid only here. |
| `status` | `ACTIVE`, `SUSPENDED`, or `REVOKED`. |
| `createdAt`, `updatedAt` | Timestamps. |

Constraints and lifecycle:

- `UNIQUE(userIdentityId, organizationId)` preserves one durable membership history per actor and
  Organization.
- `UNIQUE(id, organizationId)` supports same-Organization compound references.
- Only `ACTIVE` membership can authorize. `SUSPENDED` and `REVOKED` always deny.
- Legal ordinary transitions are `ACTIVE -> SUSPENDED|REVOKED`, `SUSPENDED -> ACTIVE|REVOKED`, and
  `SUSPENDED -> ACTIVE`. `REVOKED -> ACTIVE` is prohibited as a status toggle.
- Suspension is a temporary access pause. `SUSPENDED -> ACTIVE` preserves the Organization role and
  active scoped bindings, so their grants may become effective again.
- Revocation removes the relationship's effective authorization state. The revocation transaction
  sets `organizationRole` to null and changes every active WorkspaceRoleBinding and BrandRoleBinding
  owned by the Membership to `REVOKED` before the Membership becomes `REVOKED`.
- A revoked Membership may return only through the atomic `READMISSION` operation. An authorized
  assigner must verify the same Organization, set `organizationRole` to null, revoke every scoped
  binding again as a fail-safe, and only then set the Membership to `ACTIVE`. Readmission restores no
  business capability; every role requires a fresh, separately authorized assignment.
- `organizationRole = null` is valid and supports a Brand- or Workspace-only member without granting
  Organization-wide capabilities.
- Role changes and lifecycle transitions require the role-assignment rules below and a durable audit
  record when the P2 implementation provides the mutation path.

Required lifecycle cases:

- A revoked former `MANAGER` with an old `EDITOR` Brand binding has null Organization role, no active
  scoped binding, and no effective capability immediately after readmission.
- A suspended `MANAGER` may recover the preserved `MANAGER` grants after authorized reactivation.

## Role Binding Contract

### Selected model: Membership role plus scope-specific bindings

`WorkspaceRoleBinding` fields:

- `id`, `membershipId`, `organizationId`, `workspaceId`, `role`, `status`, `createdAt`, `updatedAt`.
- `status` is `ACTIVE` or `REVOKED`.
- `UNIQUE(membershipId, workspaceId)` allows one durable role row at that scope.
- Compound FKs prove that Membership and Workspace share `organizationId`.

`BrandRoleBinding` fields:

- `id`, `membershipId`, `organizationId`, `workspaceId`, `brandId`, `role`, `status`, `createdAt`,
  `updatedAt`.
- `status` is `ACTIVE` or `REVOKED`.
- `UNIQUE(membershipId, brandId)` allows one durable role row at that scope.
- Compound FKs prove that Membership and Brand share Organization and Workspace ancestry.

`OWNER` is invalid in either scoped binding and is enforced by boundary validation plus a SQLite
`CHECK` constraint. Scoped bindings may use `ADMIN`, `MANAGER`, `EDITOR`, `VIEWER`, `APPROVER`, or
`AGENT_OPERATOR`. Revocation retains and updates the same row. RE-GRANT is a fresh assignment that
must name and authorize the new role; it never restores the historical role implicitly.

This scope-specific representation is intentionally preferred over one generic polymorphic
RoleBinding. Two small tables cost less than losing foreign-key proof of tenant ancestry in SQLite.

## Role Scope and Inheritance

Roles are positive grants. P2 has no explicit deny binding and no policy DSL.

1. Organization scope considers only the active Membership's non-null `organizationRole`.
2. Workspace scope considers that Organization role plus an active binding for the exact Workspace.
3. Brand scope considers those roles plus an active binding for the exact Brand.
4. Effective capabilities are the union of capabilities allowed by the considered roles.
5. A lower-scope role can add capabilities but cannot remove an inherited capability.
6. A scoped binding never grants a capability on an ancestor or sibling scope.
7. Membership alone does not grant discovery or visibility. Accessible-scope listings are derived
   from valid Organization roles and exact active scoped bindings.
8. Archived target or ancestor scope permits read capabilities and the exact applicable lifecycle
   recovery action only; other mutations deny. A child cannot become effectively active while any
   ancestor remains archived.

One actor holds at most one role at each scope. Role composition occurs only through the documented
ancestor union, so conflicting same-scope bindings cannot exist.

## Capability Vocabulary

The proposed canonical P2 vocabulary contains 24 action capabilities:

| Family | Capabilities | Protected consequence |
|---|---|---|
| Organization | `organization.read`, `organization.manage`, `organization.lifecycle.manage`, `organization.ownership.transfer` | Tenant metadata, governance, archive/reactivation, ownership transfer. |
| Authorization | `rbac.manage` | Membership and role mutation, subject to assignment ceilings. |
| Workspace | `workspace.read`, `workspace.manage`, `workspace.lifecycle.manage` | Workspace data, structure, and archive/reactivation. |
| Brand | `brand.read`, `brand.manage`, `brand.lifecycle.manage` | Brand data/settings and archive/reactivation. |
| Content | `content.read`, `content.write`, `content.approve`, `content.publish` | Content access, mutation, approval, and external publication boundary. |
| Work | `work.read`, `work.manage` | Task visibility and mutation. |
| Agents | `agent.run`, `agent.manage` | Running/observing agents versus changing agent definitions/policy. |
| Integrations | `integration.read`, `integration.manage` | Connection metadata versus connection/secret-reference governance. |
| Learning | `metrics.read`, `learning.manage` | Metric access versus learning/proposal mutation. |
| Audit | `audit.read` | Security/consequential audit visibility. |

Capabilities protect server actions, not pages or button visibility. `content.publish` never replaces
the separate G3 payload-bound approval required for an external action. No capability returns
plaintext secrets.

Capability-to-target applicability is part of boundary validation:

| Capability family | Valid target scope |
|---|---|
| `organization.*` | Organization only |
| `rbac.manage` | Organization, Workspace, or Brand role operation, subject to assignment ceilings |
| `workspace.*` | Workspace only |
| `brand.*`, `content.*`, `integration.*`, `metrics.*`, `learning.*` | Brand only |
| `work.*`, `agent.*` | Workspace or Brand |
| `audit.read` | Organization, with optional narrower tenant filters |

A capability requested against an inapplicable scope denies before role evaluation.

## Role-Permission Matrix

Every `ALLOW` applies only when the role is valid at the requested scope under the inheritance
algorithm. All unlisted or unknown capabilities are `DENY`.

| Capability | OWNER | ADMIN | MANAGER | EDITOR | VIEWER | APPROVER | AGENT_OPERATOR |
|---|---|---|---|---|---|---|---|
| `organization.read` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `organization.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `organization.lifecycle.manage` | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY |
| `organization.ownership.transfer` | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY |
| `rbac.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `workspace.read` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `workspace.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `workspace.lifecycle.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `brand.read` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `brand.manage` | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| `brand.lifecycle.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `content.read` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `content.write` | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY |
| `content.approve` | ALLOW | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY |
| `content.publish` | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| `work.read` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `work.manage` | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| `agent.run` | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | ALLOW |
| `agent.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `integration.read` | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| `integration.manage` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| `metrics.read` | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| `learning.manage` | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| `audit.read` | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |

`APPROVER` can approve but cannot edit or publish. `AGENT_OPERATOR` can run and observe an agent at
its assigned scope but cannot change agents, content, approvals, integrations, or RBAC.

## Privilege Escalation Rules

- Only an active Organization `OWNER` may assign or revoke `OWNER` or `ADMIN` Organization roles.
- An Organization `ADMIN` may assign or revoke only `MANAGER`, `EDITOR`, `VIEWER`, `APPROVER`, and
  `AGENT_OPERATOR` roles in its Organization and descendants.
- A scoped `ADMIN` may assign or revoke those same five non-governance roles only at its exact scope
  or a descendant scope. It cannot create another `ADMIN`.
- No other role may assign roles or change Membership lifecycle.
- `OWNER` is never valid at Workspace or Brand scope.
- The target Membership must be active and belong to the same Organization as every assigned scope.
- An actor cannot grant a role outside its assignment whitelist, even when `rbac.manage` is allowed.
- An Organization `ADMIN` may suspend or revoke only a Membership whose Organization role is null
  or one of its five assignable non-governance roles. It cannot change an `OWNER` or `ADMIN`
  Membership lifecycle. Scoped ADMIN never changes Membership lifecycle.
- An Organization `OWNER` may readmit any revoked Membership in the same Organization. An
  Organization `ADMIN` may readmit a revoked Membership only into the mandatory zero-role,
  zero-binding state; it cannot use readmission to grant a role. Scoped ADMIN cannot readmit.
- An actor cannot elevate its own role. Self-revocation or self-demotion is allowed only for an
  Organization Owner and only when another active Organization Owner remains.
- Suspending, revoking, or demoting an Organization Owner is denied if it would leave zero active
  Memberships whose Organization role is `OWNER`.
- Ownership transfer is a G2/G4 consequential operation, is payload-bound, and must create the new
  Owner before the old Owner is removed or demoted.

## Lifecycle State-Machine Contract

Lifecycle transitions preserve data. Whether grants survive is explicit:

| State machine | Transition | Authorized executor | Grants after transition | Child/data effect | Resurrection rule |
|---|---|---|---|---|---|
| UserIdentity | `ACTIVE -> DISABLED` | Platform security operation under G4; no tenant role may execute it | Stored Membership and binding rows remain but authorize nothing | Data survives | None while disabled. |
| UserIdentity | `DISABLED -> ACTIVE` | Owner-approved G4 identity recovery after external subject re-verification | Stored grants may become effective again | Data survives | Intentional recovery; approval must report the grants that will return. |
| Membership | `ACTIVE -> SUSPENDED` | Organization OWNER, or Organization ADMIN within its target ceiling | Organization role and scoped bindings survive but authorize nothing | Data survives | `SUSPENDED -> ACTIVE` intentionally restores preserved grants. |
| Membership | `SUSPENDED -> ACTIVE` | Same lifecycle authority that could suspend the target | Preserved grants become effective | Data survives | Allowed pause/resume behavior. |
| Membership | `ACTIVE|SUSPENDED -> REVOKED` | Organization OWNER, or Organization ADMIN within its target ceiling | Organization role cleared; every scoped binding revoked atomically | Data survives | No grant can return through a status toggle. |
| Membership | `REVOKED -> READMISSION -> ACTIVE` | Organization OWNER, or Organization ADMIN into zero-grant state | Organization role null and all scoped bindings revoked before ACTIVE | Data survives | Zero-grant only; fresh assignment is mandatory. |
| RoleBinding | `ACTIVE -> REVOKED` | Actor allowed by `rbac.manage`, assignment ceiling, and exact scope | Binding authorizes nothing | Row survives | Membership suspension/reactivation cannot revive it. |
| RoleBinding | `REVOKED -> RE-GRANT` | Fresh role assignment under `rbac.manage`, assignment ceiling, active Membership, and exact scope | Only the newly specified role becomes active | Row survives and is updated | Historical role is never restored implicitly. |
| Organization | `ACTIVE -> ARCHIVED` | Active Organization OWNER with `organization.lifecycle.manage`; G2 approval | Grants remain stored but only read/recovery rules apply | Descendants become effectively archived; data survives | No mutation grant is effective while archived. |
| Organization | `ARCHIVED -> ACTIVE` | Active Organization OWNER with `organization.lifecycle.manage`; G2 approval | Stored grants and independently active descendants may become effective | Archived descendants remain archived by their own state | Intentional recovery; approval reports returning access. |
| Workspace | `ACTIVE -> ARCHIVED` | Effective OWNER or ADMIN with `workspace.lifecycle.manage` on that Workspace | Grants remain stored but only read/recovery rules apply | Brands become effectively archived; data survives | No mutation grant is effective while archived. |
| Workspace | `ARCHIVED -> ACTIVE` | Effective OWNER or ADMIN with `workspace.lifecycle.manage`; Organization must be active | Stored grants may become effective; individually archived Brands remain archived | Data survives | Intentional recovery, never ancestor bypass. |
| Brand | `ACTIVE -> ARCHIVED` | Effective OWNER or ADMIN with `brand.lifecycle.manage` on that Brand | Grants remain stored but only read/recovery rules apply | Brand data survives | No mutation grant is effective while archived. |
| Brand | `ARCHIVED -> ACTIVE` | Effective OWNER or ADMIN with `brand.lifecycle.manage`; Organization and Workspace must be active | Stored Brand grants may become effective | Data survives | Intentional recovery, never ancestor bypass. |

An effective Workspace `ADMIN` inherits `brand.lifecycle.manage` to descendant Brands and may archive
or reactivate them. A Brand `ADMIN` has no ancestor authority and cannot use
`workspace.lifecycle.manage`. An Organization `ADMIN` may recover an archived Workspace but cannot
recover an archived Organization. The final active Organization OWNER cannot be suspended, revoked,
or demoted. P2 exposes no tenant-role operation to disable or re-enable a UserIdentity.

Role downgrade and removal do not silently delete explicit descendant bindings. After an
Organization role is lowered or cleared, independently active scoped bindings continue to grant
only their exact scopes. The mutation must calculate and surface the post-change effective scopes to
the authorized caller and audit record. Revoking the Membership, by contrast, clears all bindings.

## Tenant Authorization Algorithm

```text
authorize(actorSubject, target, capability):
    if capability is not in the canonical capability registry: DENY
    if capability is not applicable to target.type: DENY

    identity = resolve exact (provider, subject)
    if identity is missing or identity.status != ACTIVE: DENY

    ancestry = resolve target Organization, optional Workspace, optional Brand from server data
    if ancestry is missing, inconsistent, or supplied IDs do not match: DENY

    membership = find by (identity.id, ancestry.organizationId)
    if membership is missing or membership.status != ACTIVE: DENY

    if Organization, Workspace, or Brand lifecycle makes target inaccessible:
        allow only an applicable read capability or authorized lifecycle recovery
        otherwise DENY

    roles = empty set
    if membership.organizationRole is not null: add it
    if target includes Workspace:
        add active WorkspaceRoleBinding for exact (membership, Workspace), if present
    if target includes Brand:
        verify Brand belongs to the resolved Workspace and Organization
        add active BrandRoleBinding for exact (membership, Brand), if present

    if capability is allowed by no role in roles: DENY
    if operation is role mutation: apply assignment whitelist and last-owner invariant
    if operation is Membership revocation: atomically clear organizationRole and revoke all bindings
    if operation is Membership readmission: atomically enforce zero role and zero active bindings
    if operation is external/destructive: require its separate valid Owner Gate approval
    ALLOW
```

Foreign Organization, Workspace, or Brand IDs are rejected before role evaluation. Unknown roles,
duplicate bindings, inactive bindings, invalid ancestry, and missing tenant context deny without
falling back to AppState, a first row, or another accessible tenant.

## PromptRun Transitional Ownership Contract

PromptRun is tenant-sensitive execution evidence because `input`, `rawOutput`, and `parsedOutput`
may contain Brand business data. It is not equivalent to a shared PromptTemplate or system
AIModelConfig.

P2 adds nullable transitional `organizationId` and `brandId` fields to PromptRun. The fields are
both null or both non-null. When non-null, a compound FK to Brand proves that the Brand belongs to
the same Organization. New Piltover tenant-aware writes must supply the exact validated tenant at
creation; they may not create an unscoped run and infer authority later.

Legacy backfill examines every tenant-bearing consumer of each PromptRun:

```text
PromptRun <- StrategyVersion <- Strategy
PromptRun <- ContentDraft
PromptRun <- PerformanceInsight
```

Each consumer resolves through its post-P2 Organization/Brand ownership path. If all consumers with
a provable tenant resolve to exactly one `(organizationId, brandId)`, and no consumer has an
unresolved tenant path, that exact pair is backfilled. If no tenant-bearing consumer proves an owner,
both fields remain null and the migration report classifies the row `LEGACY_UNSCOPED`. If any
consumer is unresolved or consumers resolve to different tenants, both fields remain null, the
migration report classifies the row `OWNERSHIP_CONFLICT`, and P2 blocks unsafe exposure and
constraint tightening until the conflict is resolved. The classification is migration evidence, not
a new permanent status column.

Ordinary new Piltover tenant APIs require exact non-null PromptRun ownership matching the authorized
tenant. They never return null-scoped or conflicting rows. Unresolved legacy runs remain reachable
only through explicitly preserved legacy compatibility paths until that seam is migrated. Backfill
never selects a first consumer, first Brand, AppState tenant, or current active Brand.

The current PBOS strategy path's global "most recent PromptRun" lookup is legacy compatibility
behavior only. No new tenant-aware seam may use it; new scoped attribution must use the exact run ID
and exact tenant predicates. P2 R1 records this boundary without rewriting that application path.

PromptTemplate remains global/system reference data only where its contents are intentionally
shared. AIModelConfig remains system/provider configuration in P2; its secret-bearing fields are
never returned through tenant business APIs or backup output. Neither classification permits a
global tenant-aware PromptRun query.

## MetricObservation Contract

### Selected value model

Use one normalized row per metric key, observation time, and source record, with typed numeric or
text storage. This preserves queryability without a wide provider-specific schema.

| Field | Contract |
|---|---|
| `id` | Globally unique stable string primary key. |
| `organizationId` | Required tenant FK. |
| `brandId` | Required authoritative tenant/content owner FK. |
| `legacyPostId` | Nullable compatibility FK to Post; never the authoritative tenant owner. |
| `metricKey` | Stable lower-snake-case metric identity. |
| `valueKind` | `NUMERIC` or `TEXT`. |
| `numericValue` | Nullable number; present only for `NUMERIC`. |
| `textValue` | Nullable text; present only for `TEXT`. |
| `observedAt` | Time the metric fact was observed; legacy value is `capturedAt`. |
| `source` | Required normalized source string; preserves the legacy source. |
| `sourceRecordId` | Required opaque source record or idempotency-operation identifier. |
| `dedupeKey` | Required stable hash input identity, unique within Brand. |
| `provenance` | Optional JSON-safe provider/evidence metadata; never a secret. |
| `createdAt`, `updatedAt` | Timestamps. |

Brand is the P2 authoritative owner. `legacyPostId` is optional so the model is not permanently
bound to Post. When Publication is introduced in its canonical phase, an additive `publicationId`
relation may be added and validated before the Post bridge is contracted.

A SQLite `CHECK` requires exactly one of `numericValue` and `textValue` and requires it to match
`valueKind`. `UNIQUE(brandId, dedupeKey)` prevents retry duplicates. The dedupe identity is:

```text
metric-observation:v1
| organizationId | brandId | measured-owner-reference
| metricKey | observedAt UTC | source | sourceRecordId
```

The stored `dedupeKey` is the SHA-256 digest of that canonical UTF-8 string. For legacy backfill,
the measured owner reference is `legacy-post:<postId>` and `sourceRecordId` is the MetricSnapshot ID.
Value is deliberately excluded, so a changed value does not disguise a duplicate source fact.
Different source record/operation IDs permit legitimate repeated observations at the same time.

P2 backfills these canonical metric keys only when the source value is non-null:
`reach`, `engagement`, `comments`, `shares`, `saves`, `inbox_note`, and `conversion_note`. The first
five are numeric; the final two are qualitative text observations. Unknown metric keys fail boundary
validation until explicitly registered. A separate MetricDefinition table is deferred because P2
has no current mutation consumer requiring database-managed definitions.

## MetricSnapshot Migration Map

`MetricSnapshot` remains readable and is not deleted or rewritten.

| Legacy field | Classification | P2 mapping |
|---|---|---|
| `id` | PROVENANCE | `sourceRecordId`; also included in provenance. |
| `postId` | OWNER BRIDGE | `legacyPostId`; Post ownership must match `brandId`. |
| `capturedAt` | DIRECT | `observedAt` for every emitted metric row. |
| `daysSincePost` | DERIVED METADATA | Preserved in `provenance.legacy.daysSincePost`; not recomputed. |
| `reach` | DIRECT METRIC | Numeric `reach` row when non-null. |
| `engagement` | DIRECT METRIC | Numeric `engagement` row when non-null. |
| `comments` | DIRECT METRIC | Numeric `comments` row when non-null. |
| `shares` | DIRECT METRIC | Numeric `shares` row when non-null. |
| `saves` | DIRECT METRIC | Numeric `saves` row when non-null. |
| `inboxNote` | QUALITATIVE OBSERVATION | Text `inbox_note` row when non-null; also retained in MetricSnapshot. |
| `conversionNote` | QUALITATIVE OBSERVATION | Text `conversion_note` row when non-null; also retained in MetricSnapshot. |
| `source` | DIRECT | Copied exactly to `source`; normalized comparison may use a separate boundary mapping. |
| `postUrl` | PROVENANCE | Preserved in `provenance.legacy.postUrl`. |
| `fbRawResponse` | PROVENANCE | Preserved in `provenance.legacy.fbRawResponse`; secrets must be excluded. |
| `fetchedAt` | PROVENANCE | Preserved in `provenance.legacy.fetchedAt`. |

Legacy null means unknown/not observed. Null never creates an observation and never becomes zero.
A snapshot with no non-null canonical observation remains fully recoverable from MetricSnapshot and emits
zero observations. Backfill may emit up to seven rows per snapshot because the approved normalized
model defines one row per non-null metric.

## Deletion / Cascade Semantics

P2 exposes archive/disable/revoke operations, not hard-delete APIs.

| Relationship | FK behavior | P2 lifecycle rule |
|---|---|---|
| UserIdentity -> AuthIdentity | RESTRICT | Disable identity; do not cascade subjects. |
| UserIdentity -> UserProfile | RESTRICT | Retain profile and identity mapping. |
| UserIdentity -> Membership | RESTRICT | Revoke Membership before any future controlled purge. |
| Organization -> Membership | RESTRICT | Archive Organization; retain membership history. |
| Organization -> Workspace | RESTRICT | Archive Organization; children become effectively archived. |
| Workspace -> Brand | RESTRICT | Archive Workspace; Brands become effectively archived. |
| Brand -> Brand-owned data | RESTRICT | Archive Brand; retain content, metrics, and evidence. |
| Brand -> scoped PromptRun | RESTRICT | Retain tenant-sensitive AI execution evidence. |
| Membership -> scoped bindings | RESTRICT | Revoke bindings or Membership; retain rows. |
| Workspace/Brand -> scoped bindings | RESTRICT | Archive scope; bindings remain non-authorizing. |
| Post -> MetricObservation compatibility link | SET NULL | Preserve observations when a legacy Post is removed. |

Any future physical purge is a separate G4 design with export/backup, dependency ordering, audit,
and recovery. It is not part of P2.

## Legacy Backfill Contract

Tenant-graph backfill runs in a transaction per legacy `UserProfile` and never selects a
first/default tenant.

1. Validate preconditions: no cross-user legacy relation, duplicate Supabase subject, or ambiguous
   Facebook owner mapping. A violation stops before affected writes.
2. Create or reuse exactly one `UserIdentity` linked through `UserProfile.userIdentityId`.
3. For profile `local` only, create/reuse the exact Supabase auth subject from AppState when present.
4. Create/reuse one Organization, Workspace, Brand, and active OWNER Membership for that identity.
5. Persist the generated globally unique UserIdentity ID immediately through the unique profile link.
   Derive the graph IDs with SHA-256 over canonical UTF-8 inputs using the persisted identity ID:
   `organization|<identityId>`, `workspace|<identityId>`, `brand|<identityId>`, and
   `membership|<identityId>|<organizationId>`, each with a type prefix and 24-byte hex payload.
   Retry resolves by those IDs, the profile link, and Membership `(userIdentityId, organizationId)`;
   names are never keys. No new hashing dependency is required.
6. Backfill direct Organization/Brand scope on legacy rows whose `userId` equals that profile ID.
7. Validate and backfill derived descendants through their already-scoped parent.

Only after every profile graph and affected consumer row has been scoped or reported does a separate
PromptRun pass inspect the complete cross-profile consumer set. Each PromptRun is handled in its own
transaction: backfill one unanimously proven tenant, or report `LEGACY_UNSCOPED` or
`OWNERSHIP_CONFLICT` without tenant assignment. This ordering prevents an early profile pass from
claiming a run before a conflicting consumer is visible. MetricObservation emission follows the
completed ownership passes and uses the documented dedupe key.

Display names are deterministic and mutable:

- Organization: `<profile.name> Organization`
- Workspace: `<profile.name> Workspace`
- Brand: non-empty `BrandDNA.companyName`, otherwise `<profile.name> Brand`

Name collisions are harmless because IDs and relations are authoritative.

Legacy classification for P2:

| Classification | Models/rule |
|---|---|
| Direct Brand scope | `BrandDNA`, `Goal`, `AudienceSegment`, `ContentPillar`, `Strategy`, `ContentIdea`, `ContentDraft`, `Post`, `PerformanceInsight`, `ExportHistory`. |
| Conditional Brand scope | User-owned `ContentTemplate` and `Framework`; rows with null `userId` remain global reference data. |
| Provider connection | `FacebookAccount` maps only when `ownerRef` exactly equals a profile ID, or equals `local` with profile `local`; otherwise quarantine/block use and report. |
| Derived through parent | `StrategyVersion`, `WeeklyPlan`, `DailyPlan`, and `MetricSnapshot`. Cross-owner parent/child relations stop backfill. |
| Global/system | `ContentObjective`, global templates/frameworks, `PromptTemplate`, `AIModelConfig`. |
| Conditional tenant evidence | `PromptRun` receives Organization/Brand scope only from unanimous, complete consumer ownership proof; otherwise it is `LEGACY_UNSCOPED` or `OWNERSHIP_CONFLICT` and unavailable to tenant-aware APIs. |
| Legacy compatibility | `AppState` remains non-authoritative and unavailable to new tenant-aware data paths. |

Every direct Brand-scoped row receives that profile graph's exact `organizationId` and `brandId`.
Derived rows are accepted only when their parent chain resolves to the same graph. FacebookAccount is
scoped only by the exact owner rule above. Any mismatch or unmapped tenant-bound row is reported and
blocks constraint tightening; it is never reassigned to another accessible tenant.

## Hidden Data-Scope Audit

| Model/family | Classification | R1 rule |
|---|---|---|
| PromptRun | TENANT-SENSITIVE or LEGACY-UNSCOPED/OWNERSHIP_CONFLICT | Scope only by complete consumer proof; exact scope required for new tenant APIs. |
| AppState | LEGACY-UNSCOPED | May retain legacy active-record references but is never tenant authority or readable through new tenant APIs. |
| PromptTemplate, ContentObjective, global ContentTemplate/Framework rows | GLOBAL BY DESIGN | Shared reference content only; no tenant input/output may be stored there. |
| AIModelConfig | GLOBAL BY DESIGN, SECRET-BEARING | System/provider configuration; exclude secrets from backup and tenant APIs. |
| User-owned ContentTemplate/Framework | CONDITIONAL | Exact profile tenant scope; null-user rows remain global. |
| StrategyVersion, WeeklyPlan, DailyPlan, MetricSnapshot | DERIVED TENANT-SENSITIVE | Ownership derives only through validated parents. |

No additional critical globally readable business-payload model was found in the current Prisma
schema. Direct user-owned business models, FacebookAccount, PerformanceInsight, and ExportHistory
are already covered by the Brand-scoping contract. This bounded audit does not authorize migrating
their application seams in P2.

Transitional scope columns are additive and nullable during compatibility. Backfill must verify counts,
IDs, relations, and unmapped-row count before any later migration makes a field required. There is no
rollback that deletes newly created canonical data; recovery is a forward fix or code rollback while
the additive tables remain intact.

## Backup / Restore Impact

P2 implementation must add these tables to the explicit backup envelope:

- `UserIdentity`
- `AuthIdentity`
- `Organization`
- `Membership`
- `Workspace`
- `WorkspaceRoleBinding`
- `Brand`
- `BrandRoleBinding`
- `MetricObservation`

The existing PromptRun entry remains in the envelope, and version 2 preserves nullable
`organizationId` and `brandId` for scoped runs. A version-1 upgrade applies the same
complete-consumer ownership proof before any PromptRun becomes visible to tenant-aware code.

Restore parent order is:

```text
UserIdentity -> AuthIdentity
UserIdentity + Organization -> Membership
Organization -> Workspace -> Brand
Membership + Workspace -> WorkspaceRoleBinding
Membership + Brand -> BrandRoleBinding
UserIdentity -> UserProfile
Brand/UserProfile -> scoped legacy rows
Brand + PromptTemplate -> PromptRun
PromptRun + scoped legacy parents -> StrategyVersion/ContentDraft/PerformanceInsight
Post + MetricSnapshot + Brand -> MetricObservation
```

The envelope version advances. Import remains able to accept a version-1 legacy envelope, restore its
legacy rows, and then run the same idempotent P2 backfill. Secret stripping remains unchanged and must
also reject secret material in PromptRun payload metadata and MetricObservation provenance. Raw
PromptRun business payload remains protected tenant data, not a secret-stripping substitute.
Round-trip tests must cover version 2 and the version-1 upgrade path.

## SQLite / Prisma Feasibility

- All primary relations use normal or compound foreign keys supported by Prisma and SQLite.
- Compound uniqueness on Membership and scope ancestry supplies valid Prisma relation targets.
- Scope-specific binding tables avoid unsupported polymorphic foreign keys and null-sensitive generic
  uniqueness.
- `CHECK` constraints for scoped-role exclusion and typed metric values require reviewed raw SQL in
  the generated forward migration because Prisma schema does not express them fully.
- Last-owner safety, lifecycle coupling, role-assignment ceilings, and transitional Post/Brand
  ownership equality require transactional application validation plus negative tests; they are not
  claimed as database-only constraints.
- PromptRun's nullable Organization/Brand pair and same-Brand ancestry use a reviewed SQLite CHECK
  plus compound FK. Complete-consumer agreement and ownership-conflict detection remain backfill
  logic with migration evidence and negative tests.
- Adding nullable scope fields is additive. SQLite may table-copy existing models when relations or
  constraints are introduced; generated SQL must be reviewed column-for-column against all legacy
  fields before acceptance.
- Table sizes and concurrent write rate are not known. P2 migration tests establish correctness on
  disposable databases, not a production duration or zero-downtime claim.

## Migration Safety

Implementation follows expand -> migrate -> contract:

1. Create canonical tables and nullable legacy links in a forward migration.
2. Preserve all shipped tables, columns, IDs, and existing unique keys.
3. Validate legacy ownership preconditions before backfill.
4. Backfill profile graphs, then run the complete-consumer PromptRun ownership pass, transactionally
   and idempotently.
5. Verify counts, IDs, text, nulls, foreign relations, tenant isolation, and metric dedupe.
6. Extend backup/restore and test version-1 and version-2 envelopes.
7. Keep legacy reads/writes operational; do not switch all application seams in P2.
8. Tighten nullable constraints only in a later migration after zero-unmapped evidence.

No destructive migration is required by this proposal. Reversal is a code rollback or forward
corrective migration; canonical tables are retained to avoid losing writes made after adoption.

## Alternative Matrix

`HIGH` means strong fit or favorable outcome; `LOW` means weak fit or unfavorable outcome.

### Identity model

| Option | Security | Migration fit | Simplicity | Extensibility | SQLite fit | Reversibility | PBOS compatibility |
|---|---|---|---|---|---|---|---|
| A. Separate UserIdentity + AuthIdentity + retained UserProfile | HIGH | HIGH | MEDIUM | HIGH | HIGH | HIGH | HIGH |
| B. Reuse UserProfile as auth identity | LOW | HIGH | HIGH | LOW | HIGH | MEDIUM | HIGH |

Recommendation: A. It prevents profile metadata from becoming an authentication authority and lets
offline profiles exist without fabricated subjects.

### Role model

| Option | Security | Migration fit | Simplicity | Extensibility | SQLite fit | Reversibility | PBOS compatibility |
|---|---|---|---|---|---|---|---|
| A. Membership Organization role + Workspace/Brand binding tables | HIGH | HIGH | MEDIUM | MEDIUM | HIGH | HIGH | HIGH |
| B. All roles in one generic scoped RoleBinding | MEDIUM | MEDIUM | LOW | HIGH | LOW | MEDIUM | MEDIUM |

Recommendation: A. It adds two small tables but preserves real tenant foreign keys and auditable
one-role-per-scope uniqueness.

### Metric model

| Option | Security | Migration fit | Simplicity | Extensibility | SQLite fit | Reversibility | PBOS compatibility |
|---|---|---|---|---|---|---|---|
| A. Wide snapshot-like observation | HIGH | HIGH | HIGH | LOW | HIGH | HIGH | HIGH |
| B. Normalized untyped key/value | HIGH | MEDIUM | MEDIUM | HIGH | HIGH | HIGH | MEDIUM |
| C. Normalized typed numeric/text observation | HIGH | HIGH | MEDIUM | HIGH | MEDIUM | HIGH | HIGH |

Recommendation: C. It preserves legacy numeric facts, supports later metrics without columns, and
keeps text out of numeric queries; one small SQL check is an acceptable SQLite cost.

## Alternatives Rejected

- Reusing `UserProfile` as identity conflates authentication with mutable profile data.
- A generic polymorphic RoleBinding cannot provide the same SQLite FK proof across three scope types.
- Membership-only roles cannot represent different effective Brand roles without broad grants.
- Explicit deny rules, multiple roles per scope, custom roles, groups, ABAC, and policy DSLs add
  conflict semantics without a P2 consumer.
- Wide MetricObservation repeats the legacy limitation whenever a provider adds a metric.
- Binding MetricObservation permanently and exclusively to Post contradicts the Publication target.
- Hard cascade deletion conflicts with audit, recovery, and metric-history requirements.

## Temporal Security Red-Team

| Attack/transition | Before | During | After |
|---|---|---|---|
| Revoke then attempt status reactivation | Active assigned grants | Revocation clears Organization role and revokes all scoped bindings atomically | Ordinary `REVOKED -> ACTIVE` is denied; READMISSION ends active with zero grants. |
| Suspend then reactivate | Active assigned grants | All capabilities deny while suspended; grants remain stored | Authorized reactivation intentionally restores preserved grants. |
| Archive parent then reactivate child | Child grants effective while ancestry active | Archived parent makes every descendant mutation ineffective | Child recovery while parent remains archived denies; parent recovery may restore only descendants whose own state is active. |
| Revoke binding then change Membership state | Binding contributes its scoped role | Revoked binding contributes nothing | Suspension/reactivation or readmission cannot reactivate it; RE-GRANT requires a fresh role assignment. |
| Readmission with stale scoped rows | Revoked Membership may retain historical rows | Readmission re-revokes all scoped rows and clears Organization role before ACTIVE | Effective capability set is empty until fresh assignment. |
| Downgrade Organization role with descendant binding | Ancestor and explicit descendant grants form a union | Mutation computes and exposes the post-change exact scopes | Descendant binding deliberately survives; only its exact scoped capabilities remain. |
| Remove Organization role while scoped grants remain | Ancestor plus scoped grants effective | Organization role becomes null; Membership remains active | No Organization visibility; exact active scoped bindings remain effective and auditable. |
| Transfer ownership | At least one active OWNER | New OWNER is committed before old OWNER demotion in one transaction | At least one active OWNER remains; old Owner retains only the explicitly selected lower role or none. |
| Suspend final Owner | One active OWNER | Last-owner invariant is rechecked in the mutation transaction | Operation denies; Organization never becomes ownerless. |
| Disable then re-enable identity | Membership grants effective | Disabled identity denies all tenant capabilities | G4 recovery may intentionally restore stored grants only after subject re-verification and disclosure of returning access. |

These outcomes distinguish preserved pause/recovery state from destructive authorization removal.
Only Membership revocation and scoped-binding revocation destroy effective grant state. Tenant
archival, Membership suspension, and identity disable preserve data and grants for an explicitly
authorized recovery path; their recovery operations must expose the access that will return.

## Red-Team Resolution

- Cross-Organization access is stopped by exact Membership lookup and compound same-tenant FKs.
- Workspace and Brand bindings cannot point across Organization ancestry.
- Scoped roles never grant ancestor or sibling access.
- `AGENT_OPERATOR` cannot edit, approve, publish, manage integrations, or manage RBAC.
- `APPROVER` cannot edit or publish.
- ADMIN cannot create OWNER/ADMIN peers or promote itself.
- The last active Organization OWNER cannot be suspended, revoked, or demoted.
- Revoked Membership or binding never authorizes; Membership readmission starts with zero grants.
- Workspace lifecycle requires its own capability; Brand bindings cannot authorize an ancestor.
- Tenant-aware PromptRun reads require exact proven Organization and Brand ownership.
- Each profile gets its own identity and tenant graph; no first-row or global Organization fallback exists.
- Metric retry identity excludes value, includes source fact identity, and permits legitimate repeats
  through distinct source record/operation IDs.
- Null metrics emit no rows, and tenant archival cannot cascade-delete historical content or metrics.

## Open Questions

NONE for proposal review. Owner approval, rejection, or requested changes remain required before this
contract is canonical or any P2 implementation begins.
