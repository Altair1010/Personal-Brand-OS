"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Prompt hệ thống theo khuôn mẫu",
    body: "Mỗi module ghép một hợp đồng chung (GLOBAL_CONTRACT) với system riêng của module. Đây là bộ khung cố định định hình vai trò, giọng điệu và ràng buộc đầu ra — AI không tự do phá khuôn.",
  },
  {
    title: "Chèn dữ liệu của bạn",
    body: "Dữ liệu bạn nhập (persona, pillar, cấu hình…) được đưa vào prompt qua hàm buildUser của module, tạo phần yêu cầu cụ thể cho lần chạy đó.",
  },
  {
    title: "Bọc và khử lệnh dữ liệu ngoài",
    body: "Nội dung dán/upload từ bên ngoài được bao trong khối <<DATA>> và làm sạch (sanitize) để hệ thống coi đó là DỮ LIỆU, không phải chỉ thị — chống chèn lệnh độc hại.",
  },
  {
    title: "Gọi model ở nhiệt độ thấp",
    body: "Model được gọi với nhiệt độ thấp để cho đầu ra có cấu trúc, ổn định và ít ngẫu hứng, phục vụ việc parse chính xác.",
  },
  {
    title: "Kiểm tra bằng zod + sửa một lần",
    body: "Đầu ra được kiểm tra theo một schema zod. Nếu sai định dạng, hệ thống gửi lại một prompt sửa lỗi đúng một lần trước khi báo lỗi — không lặp vô hạn.",
  },
  {
    title: "Ghi log mỗi lần chạy",
    body: "Mỗi lần gọi được lưu vào PromptRun để bạn truy vết, đối chiếu và kiểm toán về sau.",
  },
];

export function ContentGenInfoPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-6 text-left"
          >
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Cách AI tạo nội dung
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Minh bạch về quy trình sinh nội dung — AI là cộng sự được duyệt,
                không phải hộp đen.
              </p>
            </div>
            <ChevronDown
              className={cn(
                "size-5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <ol className="space-y-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
              AI ở đây là <strong className="text-foreground">cộng sự được duyệt</strong>:
              nó đề xuất theo khuôn mẫu và dữ liệu của bạn, còn bạn luôn là người
              xem lại và quyết định. API key được lưu cục bộ và chỉ dùng phía máy
              chủ — không gửi ra client.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
