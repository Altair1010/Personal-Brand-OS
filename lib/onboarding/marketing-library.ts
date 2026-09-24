export type FunnelStage =
  | "awareness"
  | "engagement"
  | "consideration"
  | "conversion"
  | "retention"
  | "loyalty";

export type MarketingObjective = {
  key: string;
  label: string;
  stage: FunnelStage;
  popularity: number;
  description: string;
};

export type KpiDefinition = {
  key: string;
  label: string;
  unit: string;
  objectives: string[];
  popularity: number;
};

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  awareness: "Nhận diện",
  engagement: "Tương tác",
  consideration: "Cân nhắc",
  conversion: "Chuyển đổi",
  retention: "Giữ chân",
  loyalty: "Trung thành",
};

export const MARKETING_OBJECTIVES: MarketingObjective[] = [
  { key: "branding", label: "Xây dựng thương hiệu", stage: "awareness", popularity: 101, description: "Củng cố nền tảng định vị, nhận biết và ghi nhớ thương hiệu." },
  { key: "brand_awareness", label: "Tăng nhận diện thương hiệu", stage: "awareness", popularity: 100, description: "Mở rộng số người biết và ghi nhớ thương hiệu." },
  { key: "reach_growth", label: "Mở rộng độ phủ / reach", stage: "awareness", popularity: 96, description: "Tăng số người duy nhất nhìn thấy nội dung." },
  { key: "share_of_voice", label: "Tăng thị phần thảo luận", stage: "awareness", popularity: 72, description: "Tăng mức hiện diện của thương hiệu trong thảo luận ngành." },
  { key: "video_awareness", label: "Tăng lượt xem video", stage: "awareness", popularity: 82, description: "Tăng mức tiếp xúc qua nội dung video." },
  { key: "engagement_growth", label: "Tăng tương tác nội dung", stage: "engagement", popularity: 98, description: "Tăng reaction, comment, share, save." },
  { key: "community_growth", label: "Phát triển cộng đồng", stage: "engagement", popularity: 84, description: "Tăng thành viên và mức tham gia cộng đồng." },
  { key: "conversation_growth", label: "Tăng hội thoại / tin nhắn", stage: "engagement", popularity: 90, description: "Khuyến khích khách hàng bắt đầu trao đổi với thương hiệu." },
  { key: "content_consumption", label: "Tăng mức tiêu thụ nội dung", stage: "engagement", popularity: 76, description: "Tăng thời gian xem/đọc và mức hoàn thành nội dung." },
  { key: "traffic", label: "Tăng traffic website/landing page", stage: "consideration", popularity: 94, description: "Đưa người dùng có quan tâm sang tài sản số của thương hiệu." },
  { key: "lead_generation", label: "Tạo khách hàng tiềm năng", stage: "consideration", popularity: 99, description: "Thu thập lead đủ điều kiện để nuôi dưỡng hoặc bán hàng." },
  { key: "consideration", label: "Tăng mức cân nhắc thương hiệu", stage: "consideration", popularity: 88, description: "Củng cố lý do chọn và niềm tin trước quyết định." },
  { key: "appointment_intent", label: "Tăng nhu cầu đặt lịch / tư vấn", stage: "consideration", popularity: 86, description: "Tăng hành động thể hiện ý định trao đổi hoặc đặt lịch." },
  { key: "sales", label: "Tăng doanh số", stage: "conversion", popularity: 100, description: "Tăng giá trị giao dịch trực tiếp." },
  { key: "orders", label: "Tăng số đơn hàng", stage: "conversion", popularity: 97, description: "Tăng số giao dịch hoàn tất." },
  { key: "conversion_rate", label: "Tăng tỷ lệ chuyển đổi", stage: "conversion", popularity: 95, description: "Tăng tỷ lệ người thực hiện hành động mục tiêu." },
  { key: "booking", label: "Tăng lượt đặt lịch", stage: "conversion", popularity: 91, description: "Tăng số lịch hẹn hoặc phiên tư vấn được đặt." },
  { key: "repeat_purchase", label: "Tăng mua lại / sử dụng lại", stage: "retention", popularity: 88, description: "Tăng số khách quay lại mua hoặc sử dụng dịch vụ." },
  { key: "retention", label: "Tăng tỷ lệ giữ chân", stage: "retention", popularity: 90, description: "Giảm rời bỏ và kéo dài quan hệ khách hàng." },
  { key: "reactivation", label: "Kích hoạt lại khách hàng cũ", stage: "retention", popularity: 74, description: "Đưa khách không hoạt động quay lại." },
  { key: "customer_value", label: "Tăng giá trị vòng đời khách hàng", stage: "retention", popularity: 80, description: "Tăng LTV thông qua trải nghiệm và mua lặp lại." },
  { key: "referral", label: "Tăng giới thiệu / referral", stage: "loyalty", popularity: 82, description: "Khuyến khích khách hàng giới thiệu người mới." },
  { key: "advocacy", label: "Tăng khách hàng ủng hộ thương hiệu", stage: "loyalty", popularity: 76, description: "Phát triển khách hàng thành người ủng hộ tự nhiên." },
  { key: "loyalty", label: "Tăng trung thành thương hiệu", stage: "loyalty", popularity: 84, description: "Tăng gắn bó dài hạn và ưu tiên lựa chọn thương hiệu." },
];

export const KPI_LIBRARY: KpiDefinition[] = [
  { key: "reach", label: "Reach", unit: "người", objectives: ["branding","brand_awareness","reach_growth"], popularity: 100 },
  { key: "impressions", label: "Impressions", unit: "lượt", objectives: ["branding","brand_awareness","reach_growth","share_of_voice"], popularity: 96 },
  { key: "video_views", label: "Lượt xem video", unit: "lượt", objectives: ["video_awareness","content_consumption"], popularity: 94 },
  { key: "view_through_rate", label: "Tỷ lệ xem hết", unit: "%", objectives: ["video_awareness","content_consumption"], popularity: 76 },
  { key: "engagement", label: "Tổng tương tác", unit: "lượt", objectives: ["engagement_growth","community_growth"], popularity: 98 },
  { key: "engagement_rate", label: "Tỷ lệ tương tác", unit: "%", objectives: ["engagement_growth","community_growth"], popularity: 99 },
  { key: "comments", label: "Bình luận", unit: "lượt", objectives: ["engagement_growth","conversation_growth"], popularity: 82 },
  { key: "shares", label: "Chia sẻ", unit: "lượt", objectives: ["engagement_growth","brand_awareness"], popularity: 84 },
  { key: "saves", label: "Lưu bài", unit: "lượt", objectives: ["engagement_growth","consideration"], popularity: 86 },
  { key: "messages", label: "Tin nhắn mới", unit: "tin nhắn", objectives: ["conversation_growth","lead_generation","appointment_intent"], popularity: 92 },
  { key: "follower", label: "Follower mới", unit: "người", objectives: ["branding","brand_awareness","community_growth"], popularity: 91 },
  { key: "followers", label: "Follower mới (chuẩn mới)", unit: "người", objectives: ["branding","brand_awareness","community_growth"], popularity: 90 },
  { key: "community_members", label: "Thành viên cộng đồng mới", unit: "người", objectives: ["community_growth"], popularity: 70 },
  { key: "link_clicks", label: "Link clicks", unit: "lượt", objectives: ["traffic","consideration"], popularity: 93 },
  { key: "ctr", label: "CTR", unit: "%", objectives: ["traffic","consideration","lead_generation"], popularity: 91 },
  { key: "sessions", label: "Website sessions", unit: "lượt", objectives: ["traffic"], popularity: 87 },
  { key: "leads", label: "Lead", unit: "người", objectives: ["lead_generation","consideration"], popularity: 100 },
  { key: "qualified_leads", label: "Lead đủ điều kiện", unit: "người", objectives: ["lead_generation"], popularity: 90 },
  { key: "appointments", label: "Lịch hẹn", unit: "lượt", objectives: ["appointment_intent","booking"], popularity: 96 },
  { key: "conversion_rate", label: "Tỷ lệ chuyển đổi", unit: "%", objectives: ["conversion_rate","sales","orders","booking"], popularity: 100 },
  { key: "orders", label: "Đơn hàng", unit: "đơn hàng", objectives: ["orders","sales"], popularity: 99 },
  { key: "revenue", label: "Doanh thu", unit: "VNĐ", objectives: ["sales","orders","customer_value"], popularity: 100 },
  { key: "cost_per_lead", label: "Chi phí / lead", unit: "VNĐ", objectives: ["lead_generation"], popularity: 89 },
  { key: "cost_per_order", label: "Chi phí / đơn hàng", unit: "VNĐ", objectives: ["orders","sales"], popularity: 88 },
  { key: "roas", label: "ROAS", unit: "%", objectives: ["sales","orders"], popularity: 93 },
  { key: "repeat_rate", label: "Tỷ lệ quay lại", unit: "%", objectives: ["repeat_purchase","retention"], popularity: 92 },
  { key: "retention_rate", label: "Retention rate", unit: "%", objectives: ["retention"], popularity: 94 },
  { key: "reactivated_customers", label: "Khách được kích hoạt lại", unit: "người", objectives: ["reactivation"], popularity: 80 },
  { key: "ltv", label: "Giá trị vòng đời khách hàng", unit: "VNĐ", objectives: ["customer_value","loyalty"], popularity: 83 },
  { key: "referrals", label: "Lượt giới thiệu", unit: "lượt", objectives: ["referral","advocacy"], popularity: 88 },
  { key: "nps", label: "NPS", unit: "%", objectives: ["loyalty","advocacy"], popularity: 79 },
  { key: "response_time", label: "Thời gian phản hồi trung bình", unit: "ngày", objectives: ["retention","conversation_growth"], popularity: 62 },
];

export function objectiveByKey(key: string | undefined) {
  return MARKETING_OBJECTIVES.find((item) => item.key === key);
}

export function kpisForObjective(objectiveKey?: string) {
  return [...KPI_LIBRARY].sort((a, b) => {
    const af = objectiveKey && a.objectives.includes(objectiveKey) ? 1 : 0;
    const bf = objectiveKey && b.objectives.includes(objectiveKey) ? 1 : 0;
    return bf - af || b.popularity - a.popularity || a.label.localeCompare(b.label, "vi");
  });
}
