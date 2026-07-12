"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

// EM2b T8 — a read-only, fully-filled reference example (Khang Guru / XAUUSD) users can
// copy ideas from while filling personas + pillars. Pure static content, no state beyond open.

const SAMPLE_PERSONA: { label: string; value: string }[] = [
  { label: "Tên persona", value: "Nhà đầu tư mới F0" },
  {
    label: "Nỗi đau (pain)",
    value: "Thua lỗ liên tục vì vào lệnh theo cảm tính, không có hệ thống.",
  },
  {
    label: "Niềm tin sai (falseBelief)",
    value: "Tin rằng chỉ cần tìm được tín hiệu 'chuẩn' là sẽ thắng.",
  },
  {
    label: "Nỗi sợ (fear)",
    value: "Sợ cháy tài khoản, mất hết vốn tích cóp nhiều năm.",
  },
  {
    label: "Khát khao (desire)",
    value: "Có lãi đều đặn, tự tin quản trị rủi ro và giữ được vốn.",
  },
  {
    label: "Ngôn ngữ (language)",
    value: "'gồng lỗ', 'full margin', 'bắt đáy', 'cháy tài khoản'",
  },
  {
    label: "Góc nội dung (contentAngle)",
    value: "Case study lệnh thật kèm bài học quản trị vốn, có số liệu.",
  },
  { label: "CTA", value: "Inbox nhận checklist vào lệnh miễn phí" },
  { label: "Offer", value: "Khoá học quản trị vốn 7 ngày" },
];

const SAMPLE_PILLAR: { label: string; value: string }[] = [
  { label: "Tên trụ cột", value: "Tâm lý & kỷ luật giao dịch" },
  { label: "Tỷ trọng (ratioPercent)", value: "30" },
  {
    label: "Mô tả",
    value: "Bài về kiểm soát cảm xúc, kỷ luật vào/thoát lệnh, tránh FOMO.",
  },
  {
    label: "Objective mix",
    value: "educate 40 · inspire 20 · trust 20 · engage 10 · sell 5 · brand 5",
  },
];

function SampleList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-0.5 sm:grid-cols-[180px_1fr]">
            <dt className="text-xs font-medium text-muted-foreground">
              {r.label}
            </dt>
            <dd className="text-sm text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ReferenceSamplePanel() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-dashed">
        <CardContent className="py-4">
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm font-medium text-foreground">
            {open ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            <BookOpen className="size-4 shrink-0 text-muted-foreground" />
            Xem mẫu tham chiếu (persona + trụ cột điền đầy đủ)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-6">
            <p className="text-xs text-muted-foreground">
              Ví dụ theo brand mẫu Khang Guru (XAUUSD). Chỉ để tham khảo ý — không
              tự động điền vào form.
            </p>
            <SampleList title="Persona mẫu" rows={SAMPLE_PERSONA} />
            <SampleList title="Trụ cột mẫu" rows={SAMPLE_PILLAR} />
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
