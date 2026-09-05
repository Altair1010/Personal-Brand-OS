# Piltover

## Piltover là gì?

Piltover là hệ điều hành marketing cốt lõi đang được phát triển từ tài sản hiện có của Personal
Brand OS. Các năng lực PBOS về chiến lược thương hiệu và nội dung trở thành các capability được
di chuyển vào Piltover, thay vì bị bỏ đi hoặc viết lại từ đầu.

## Vì sao đường dẫn và lịch sử vẫn mang tên PBOS?

Lineage của repository là:

```text
Personal Brand OS → Marketing Content Studio concept → Piltover
```

Tên repository/path và các commit cũ được giữ để bảo toàn lịch sử Git và khả năng truy vết. Tên sản
phẩm canonical hiện tại là **Piltover**; tài liệu PBOS cũ không tự động là kiến trúc Piltover.

## Chiến lược migration

- Bảo toàn lịch sử Git và tính năng đang hoạt động.
- Migration theo seam, có adapter tương thích khi cần; không rewrite-from-zero.
- Modular monolith trước; chỉ thêm hạ tầng khi có bằng chứng và quyết định được duyệt.
- Phase và công việc hiện tại được xác định bởi active Work Order, không bởi state/TODO ở root.
- UI production được hoãn đến P13.

## Technical authority

Canonical package:
[`docs/Piltover-Master-Technical-Package-v1.0.0/`](docs/Piltover-Master-Technical-Package-v1.0.0/README_FIRST.md)

Điểm vào quan trọng:

- [`SOURCE_OF_TRUTH.md`](docs/Piltover-Master-Technical-Package-v1.0.0/00_META/SOURCE_OF_TRUTH.md)
- [`TECHNICAL_CONSTITUTION.md`](docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/TECHNICAL_CONSTITUTION.md)
- [`OWNER_GATES.md`](docs/Piltover-Master-Technical-Package-v1.0.0/01_GOVERNANCE/OWNER_GATES.md)
- [`12_PHASES/`](docs/Piltover-Master-Technical-Package-v1.0.0/12_PHASES/)
- [`.piltover/handoffs/`](.piltover/handoffs/)

Không preload toàn bộ package. Bắt đầu từ `AGENTS.md`, active Work Order, active phase, rồi chỉ mở
spec và code liên quan trực tiếp.

## Development workflow

```text
AGENTS.md
  → active Work Order
  → active phase + relevant spec
  → relevant code
  → implementation
  → proportional verification
  → RESULT/evidence
  → STOP when DONE
```

Không giả định một phase đang active nếu chưa có Work Order được duyệt. Không suy ra live integration
PASS từ mock, tài liệu cũ, hay test count lịch sử.

## Local development

Các command hiện có trong repository:

```powershell
npm install
node node_modules/tsx/dist/cli.mjs prisma/seed.ts
npm run dev
```

Verification commands:

```powershell
npm test
npm run build
```

Chỉ chạy verification phù hợp với thay đổi hiện tại. API key, Supabase, Facebook và các integration
thật cần cấu hình riêng; không commit secret và không coi build/mock test là chứng nhận live.

## Boundaries

- Không bắt đầu phase kế tiếp khi phase hiện tại đã DONE.
- Không push, merge, deploy, publish, hoặc thực hiện external/destructive action nếu chưa có gate phù hợp.
- Không coi tài liệu PBOS legacy là source of truth của Piltover.
- Không thêm VPS, microservice, vector database, hoặc agent swarm nếu chưa chứng minh nhu cầu.
