# Minh bạch: Cách AI tạo nội dung

> Ghi chú xác nhận về cơ chế **template + inject**. Không mô tả tính năng mới —
> chỉ phản ánh đúng luồng đang chạy trong `lib/ai/run.ts` (`runModule()`).

Panel "Cách AI tạo nội dung" ở trang **Cài đặt** giải thích đúng luồng thật:

1. **Prompt hệ thống theo khuôn mẫu** — `system = GLOBAL_CONTRACT + module.system`
   (`lib/ai/contract.ts`). Bộ khung cố định, AI không tự phá khuôn.
2. **Chèn dữ liệu người dùng** — `user = module.buildUser(input)`.
3. **Bọc & khử lệnh dữ liệu ngoài** — nội dung bên ngoài đi qua
   `lib/ai/sanitize.ts`, bao trong khối `<<DATA>>` (coi là DỮ LIỆU, không phải chỉ thị).
4. **Gọi model ở nhiệt độ thấp** — cho đầu ra có cấu trúc, ổn định.
5. **Kiểm tra bằng zod + sửa một lần** — validate theo schema; sai thì
   `buildRepairPrompt` sửa đúng một lần rồi mới báo lỗi.
6. **Ghi log mỗi lần chạy** — `savePromptRun` lưu vào bảng `PromptRun`.

**Nguyên tắc:** AI là **cộng sự được duyệt**, không phải hộp đen. API key lưu cục
bộ, chỉ dùng phía máy chủ — không gửi ra client.
