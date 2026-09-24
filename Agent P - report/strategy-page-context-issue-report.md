---
report_type: piltover_issue_context_report
schema_version: 1
created_at: 2026-09-21T01:36:00+07:00
repository_alias: personal-brand-os
repository_path_windows: 'F:\Codex\Personal Brand OS'
repository_path_wsl: '/mnt/f/Codex/Personal Brand OS'
surface: STRATEGY
route: /strategy
status: resolved_and_verified
confidence: high
mutation_scope: implementation_authorized_by_owner
---

# Báo cáo issue — Strategy đã mở khóa nhưng chưa có active strategy

## 1. Tóm tắt

Tại surface **STRATEGY** (`/strategy`), trạng thái hiện tại cho thấy bước **Khán giả & Trụ cột đã được duyệt**, nhưng hệ thống **chưa có chiến lược đang hoạt động**:

- `activeGoalId`: `goal-default`
- `audienceApprovedAt`: `2026-07-12T04:56:05.984Z`
- `activeStrategyId`: `null`

Đây chưa đủ bằng chứng để kết luận là lỗi dữ liệu hay lỗi chức năng. Theo implementation hiện tại, trạng thái này có thể là trạng thái hợp lệ ngay sau khi duyệt audience/pillars và trước khi người dùng tạo chiến lược lần đầu. Tuy nhiên, nếu giao diện không hiển thị rõ CTA để tạo chiến lược, tạo thất bại, hoặc vẫn thể hiện như đã có strategy, thì đây là issue cần xử lý.

## 2. Context được cung cấp

### Facebook Page

- Internal ID: `cmu9x1yml00007kh4krow006r`
- Page ID: `1401514016373434`
- Page name: `Test pbos`
- Brand ID: `null`

### Brand context

- Company: **Khiết Tâm Đường**
- Field: Chăm sóc sức khỏe chủ động và đều đặn theo tinh thần Đông phương, được tổ chức bằng tiêu chuẩn dịch vụ hiện đại.
- Positioning: KHIẾT TÂM ĐƯỜNG là không gian chăm sóc sức khỏe Đông phương có chiều sâu, kết hợp sự lắng nghe, kỹ thuật phù hợp, không gian có chủ đích và tiêu chuẩn dịch vụ hiện đại để mỗi khách được chăm sóc như một con người cụ thể, rõ giới hạn và không bị ép mua.
- Brand words: `chỉn chu`, `chính trực`, `ấm áp`
- USP: `Y viện Đông Y`
- Region/category: `Y tế`

### Strategy state

```json
{
  "activeGoalId": "goal-default",
  "activeStrategyId": null,
  "audienceApprovedAt": "2026-07-12T04:56:05.984Z"
}
```

## 3. Hành vi quan sát được từ mã nguồn

### Route gate

File: `app/(dashboard)/strategy/page.tsx`

- Trang Strategy gọi `getStrategyData()`.
- Nếu `approvedAt` không tồn tại, trang bị khóa và hướng người dùng về `/audience-pillars`.
- Nếu `approvedAt` tồn tại, trang render `StrategyWizard`.
- Việc mở khóa **không phụ thuộc** vào `activeStrategyId`.

Với context hiện tại, `/strategy` phải render `StrategyWizard`, vì `audienceApprovedAt` đã có giá trị.

### Data loading

File: `app/(dashboard)/strategy/actions.ts`

`getStrategyData()` thực hiện:

1. Đọc `BrandDNA`, singleton `AppState`, và danh sách framework.
2. Lấy goal/personas/pillars theo `activeGoalId`.
3. Chỉ truy vấn `StrategyVersion` khi `activeStrategyId` có giá trị.
4. Trả `strategy: null` nếu `activeStrategyId` là `null`.

Do đó, context hiện tại sẽ đưa `initialStrategy={null}` vào `StrategyWizard`.

### Strategy generation

Cũng trong `app/(dashboard)/strategy/actions.ts`, `generateStrategy()` kiểm tra:

- Audience/pillars đã được duyệt.
- Có active goal.
- Goal tồn tại.
- Có ít nhất một persona.
- Có ít nhất một content pillar đang active.

Sau khi generation và persistence thành công, tầng versioning dự kiến cập nhật `AppState.activeStrategyId` (tham chiếu: `lib/strategy-engine/versioning.ts`).

## 4. Phân loại issue khả dĩ

### Trường hợp A — Trạng thái hợp lệ, chưa generate lần đầu

Đây là khả năng cao nếu người dùng vừa duyệt audience/pillars nhưng chưa bấm tạo chiến lược. Khi đó:

- `audienceApprovedAt != null` là đúng.
- `activeStrategyId == null` là đúng.
- `StrategyWizard` cần hiển thị trạng thái khởi tạo và CTA rõ ràng để generate.

### Trường hợp B — Generation đã được yêu cầu nhưng thất bại

Có thể xảy ra nếu:

- Goal `goal-default` không tồn tại hoặc không phù hợp tenant hiện tại.
- Không có persona được lưu cho `goal-default`.
- Không có pillar active cho `goal-default`.
- AI run thất bại hoặc không hoàn tất.
- Persistence/versioning thất bại trước khi cập nhật `activeStrategyId`.

Dấu hiệu cần tìm: error toast/UI, AgentRun thất bại, không có Strategy/StrategyVersion mới, hoặc log server có exception.

### Trường hợp C — Strategy đã được tạo nhưng AppState không trỏ tới nó

Nếu database có Strategy/StrategyVersion phù hợp nhưng `AppState.activeStrategyId` vẫn `null`, có thể có lỗi ở transaction/persistence, dữ liệu migration cũ, hoặc đường chạy khác không gọi versioning chuẩn.

### Trường hợp D — Scope dữ liệu Page/Brand không nhất quán

Context có Facebook Page nhưng `brandId: null`, trong khi Strategy data loader hiện đọc local singleton/user constants. Cần xác minh app hiện tại có chủ ý dùng mô hình single-user/local hay đã bắt đầu scope theo Page/Brand. Nếu UI chọn page cụ thể nhưng Strategy vẫn đọc singleton toàn cục, có nguy cơ lấy hoặc ghi strategy không đúng context.

## 5. Kỳ vọng hợp lý

Khi audience/pillars đã được duyệt và chưa có active strategy:

1. Trang `/strategy` mở được.
2. Wizard hiển thị đầy đủ brand, goal, personas, pillars và frameworks.
3. UI thông báo rõ rằng chưa có chiến lược hiện hành.
4. Có CTA tạo chiến lược 30 ngày.
5. Khi tạo thành công:
   - Có Strategy và StrategyVersion được persist.
   - Có đủ weekly/daily plan theo contract sản phẩm.
   - `AppState.activeStrategyId` được cập nhật.
   - Refresh trang vẫn tải đúng strategy vừa tạo.
6. Nếu thiếu dữ liệu hoặc generation lỗi, UI trả lỗi cụ thể và không tạo trạng thái nửa vời.

## 6. Các bước tái hiện đề xuất

1. Khởi chạy ứng dụng với database hiện tại.
2. Mở Facebook Page `Test pbos` nếu sản phẩm có page selector.
3. Truy cập `/strategy`.
4. Xác nhận trang không bị gate bởi audience approval.
5. Kiểm tra trạng thái ban đầu của `StrategyWizard` khi `initialStrategy` là `null`.
6. Bấm CTA generate strategy đúng một lần.
7. Ghi lại:
   - Thông báo UI.
   - Network/server response.
   - AI/agent run ID và trạng thái.
   - Bản ghi Strategy/StrategyVersion/WeeklyPlan/DailyPlan mới.
   - Giá trị `AppState.activeStrategyId` sau khi hoàn tất.
8. Refresh `/strategy` và xác nhận dữ liệu được hydrate lại.

## 7. Truy vấn/kiểm tra dữ liệu cần thực hiện

Không chỉnh DB trước khi chụp bằng chứng. Kiểm tra tối thiểu:

- Singleton `AppState` và ba field state nêu trên.
- Goal có ID `goal-default`.
- AudienceSegment theo `userId` và `goalId=goal-default`.
- ContentPillar active theo cùng scope.
- Strategy và StrategyVersion gần nhất.
- WeeklyPlan và DailyPlan thuộc version gần nhất.
- AgentRun/Job liên quan lần generate gần nhất, nếu schema/runtime có lưu.

Cần đặc biệt đối chiếu timestamp để xác định `activeStrategyId` chưa từng được set, bị reset, hay strategy tồn tại nhưng mất liên kết.

## 8. Acceptance criteria cho bản sửa (nếu xác nhận có lỗi)

- [ ] Trạng thái `approved audience + no active strategy` được biểu diễn rõ ràng, không phải màn hình trống.
- [ ] CTA generate hoạt động từ trạng thái này.
- [ ] Failure reason được hiển thị cụ thể khi thiếu goal/persona/pillar hoặc AI run lỗi.
- [ ] Generation thành công cập nhật `activeStrategyId` đúng một cách atomic hoặc có recovery rõ ràng.
- [ ] Reload trang tải đúng strategy/version hiện hành.
- [ ] Không tự động gắn strategy của Page/Brand khác.
- [ ] Có test cho trạng thái `audienceApprovedAt != null && activeStrategyId == null`.
- [ ] Có test cho generation success và persistence failure.
- [ ] Không làm thay đổi dữ liệu unrelated hoặc lịch sử version cũ.

## 9. Mức độ ưu tiên đề xuất

- **P1** nếu người dùng không thể tạo chiến lược hoặc generation thành công giả nhưng không persist.
- **P2** nếu chức năng hoạt động nhưng trạng thái empty/CTA gây hiểu nhầm.
- **P1/P0 data-integrity** nếu xác nhận Strategy bị scope sai giữa Page/Brand hoặc ghi đè dữ liệu context khác.

## 10. File mã nguồn liên quan

- `app/(dashboard)/strategy/page.tsx`
- `app/(dashboard)/strategy/actions.ts`
- `components/strategy/StrategyWizard.tsx`
- `lib/strategy-engine/versioning.ts`
- `prisma/schema.prisma`
- `app/api/agent/sidebar/route.ts`
- `app/(dashboard)/audience-pillars/actions.ts`

## 11. Non-goals của báo cáo

- Không sửa source code.
- Không thay đổi database.
- Không chạy generation thật.
- Không khẳng định root cause khi chưa có runtime/database evidence.
- Không coi page context được cung cấp là bằng chứng rằng generation đã từng thành công.

## 12. Kết luận

Bằng chứng hiện có xác nhận một **state transition chưa hoàn tất**: audience/pillars đã được duyệt nhưng chưa có active strategy. Implementation cho phép trạng thái này và sẽ render wizard với `initialStrategy = null`. Bước điều tra tiếp theo cần xác định đây là trạng thái trước lần generate đầu tiên, lỗi UI empty state, lỗi generation, lỗi persistence, hay lỗi scope giữa Page/Brand và singleton AppState. Không nên sửa `activeStrategyId` thủ công trước khi kiểm tra dữ liệu và run history.

## 13. Resolution — 2026-09-21

### Root cause confirmed

The latest pre-fix Strategy Agent run could reach `COMPLETED` without producing the canonical payload expected by `syncStrategyAgentResult()`. The worker only validated generic JSON for `STRATEGY_PLAN_30D`, while the persistence path required the D.4/D.6 contract: `{ tier1, weeklyOutputs }` with canonical `strategyOutputSchema` and five `weeklyPlanOutputSchema` values. As a result, an Agent run could be terminal-success at the Control Plane while no `Strategy` / `StrategyVersion` was persisted and `AppState.activeStrategyId` stayed null.

An earlier independent failure was also confirmed: the first Strategy run exceeded the old 16 KiB worker result-body ceiling and terminated with `VALIDATION_BODY_TOO_LARGE`. That transport limit had already been raised to 256 KiB before this resolution.

The Facebook Page `Test pbos` also had `organizationId=null` and `brandId=null`, confirming the Page/Brand scope drift described in section 4D.

### Fixes applied

- Worker now validates `STRATEGY_PLAN_30D` against the canonical Strategy + Weekly Plan schemas and uses the existing one-repair path if output is invalid.
- Strategy dispatch now sends explicit `StrategyPlanResult/v2` contract guidance and uses a v2 idempotency key, preventing reuse of the old malformed completed run.
- Strategy progress now treats `FAILED` and `CANCELLED` as terminal states and surfaces the terminal error instead of polling indefinitely.
- Strategy sync now uses `safeParse` and returns a concrete contract error instead of throwing an unhandled parse exception.
- Existing Facebook Page scope was repaired to the active Organization/Brand; future Facebook connections already persist that scope.

### Runtime verification

A new canonical run was executed after restarting the OpenClaw worker:

- Run: `agent-run-9ed93e623d74bd11f66190dde8319d47`
- Status: `COMPLETED`
- Artifact top-level keys: `tier1`, `weeklyOutputs`
- Weekly outputs: 5
- Daily plan counts: `7, 7, 7, 7, 2` = 30 days

The result was persisted successfully before the local out-of-request `revalidatePath` test harness warning:

- `AppState.activeStrategyId = cmua7ggfg00017kvs5cab93pv`
- Strategy rows: 1 active strategy for `goal-default`
- StrategyVersion: v1
- WeeklyPlan rows: 5
- DailyPlan rows: 30
- Organization/Brand ancestry matches the current tenant.

The original issue state `audienceApprovedAt != null && activeStrategyId == null` is therefore resolved for the current database.

### Verification gates

- TypeScript: `npx tsc --noEmit` — PASS.
- Focused tests: 4 files / 13 tests — PASS.
- OpenClaw content-ratio Agent smoke run — COMPLETED and returned a normalized 100% ratio.
- Strategy v2 Agent runtime — COMPLETED and persisted 5 weeks / 30 days.
