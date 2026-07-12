// Vietnamese help strings for form fields, keyed by a stable field key.
// Wired into forms via <LabelWithHelp help={HELP_TEXT.key} />.
// Keep this a simple flat const map, grouped by form.

export const HELP_TEXT = {
  // Brand DNA (components/brand/BrandDnaForm.tsx)
  brandThreeWords:
    "Ba từ khoá cô đọng nhất mô tả thương hiệu của bạn — dùng làm kim chỉ nam cho giọng điệu và nội dung.",
  brandWhoAmI:
    "Giới thiệu ngắn gọn bạn là ai và vai trò của bạn trong lĩnh vực này.",
  brandDifferentiation:
    "Điều khiến bạn khác biệt so với đối thủ — lý do khách hàng chọn bạn.",

  // Goal (components/forms/GoalForm.tsx)
  goalName: "Tên ngắn gọn, dễ nhớ để nhận diện mục tiêu này.",
  goalType:
    "Loại mục tiêu định hướng chiến lược, ví dụ: xây dựng thương hiệu hoặc bán hàng.",
  goalMainMessage:
    "Thông điệp xuyên suốt bạn muốn khán giả ghi nhớ trong suốt chiến dịch.",

  // Persona (components/audience/PersonaEditor.tsx)
  personaName: "Đặt tên gợi nhớ cho nhóm khán giả này để dễ tham chiếu về sau.",
  personaPain:
    "Vấn đề, khó khăn cụ thể mà nhóm khán giả này đang gặp phải và muốn giải quyết.",
  personaFalseBelief:
    "Niềm tin sai lầm khiến họ mắc kẹt — điều bạn cần đính chính qua nội dung.",
  personaFear:
    "Nỗi sợ sâu bên trong khiến họ chần chừ, chưa dám hành động.",
  personaDesire:
    "Kết quả, trạng thái mơ ước họ muốn đạt được — đích đến của hành trình.",
  personaLanguage:
    "Cách họ tự mô tả vấn đề (từ ngữ, giọng điệu) — dùng lại để nội dung thấy 'trúng'.",
  personaContentAngle:
    "Góc tiếp cận nội dung phù hợp nhất với nhóm này (ví dụ: câu chuyện, số liệu, phản biện).",
  personaCta:
    "Lời kêu gọi hành động phù hợp với mức độ sẵn sàng của nhóm này.",
  personaOffer:
    "Sản phẩm/dịch vụ hoặc bước tiếp theo bạn muốn dẫn nhóm này tới.",

  // Pillar (components/audience/PillarBoard.tsx)
  pillarName: "Tên trụ cột nội dung — một chủ đề lớn xuyên suốt.",
  pillarRatio:
    "Tỷ trọng tương đối của trụ cột này. Hệ thống tự chuẩn hoá tổng các trụ cột về 100.",
  pillarDescription:
    "Mô tả ngắn phạm vi trụ cột: nói về gì, phục vụ mục tiêu nào.",
  pillarObjectiveMix:
    "Phân bổ 6 mục tiêu cố định trong trụ cột này — chỉ chỉnh giá trị, không thêm mục tiêu mới.",

  // Draft editor (components/content/DraftEditor.tsx)
  draftTone:
    "Giọng điệu mong muốn cho bài viết, ví dụ: gần gũi, chuyên gia, truyền cảm hứng.",
  draftLength: "Độ dài mong muốn của bài, ví dụ: ngắn, trung bình, dài.",

  // AI model config (components/settings/AiModelConfigForm.tsx)
  aiApiKey:
    "Khoá API của nhà cung cấp. Được lưu an toàn phía máy chủ và không hiển thị lại sau khi lưu.",
  aiTemperature:
    "Mức độ ngẫu nhiên của đầu ra: thấp cho câu trả lời ổn định, cao cho nội dung sáng tạo hơn.",
} as const;

export type HelpTextKey = keyof typeof HELP_TEXT;
