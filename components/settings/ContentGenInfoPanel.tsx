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

const STEPS = [
  {
    title: "Yêu cầu AI đi qua Agent Control Plane",
    body: "Các tính năng AI của sản phẩm không gọi model bằng API key. OpenClaw là route ưu tiên; OAuth worker là route dự phòng.",
  },
  {
    title: "Đóng gói context theo task",
    body: "Brand DNA, audience, strategy, content và evidence được đóng gói vào task có role, permission manifest và result contract rõ ràng.",
  },
  {
    title: "Chặn dữ liệu ngoài khỏi quyền điều khiển",
    body: "Nội dung dán hoặc upload được coi là dữ liệu đầu vào, không phải chỉ thị hệ thống. File Brand DNA hỗ trợ Markdown, DOCX và PDF.",
  },
  {
    title: "Worker thực thi và trả artifact",
    body: "Worker nhận job, giữ lease, thực thi qua Agent/OAuth và trả artifact có cấu trúc về Piltover.",
  },
  {
    title: "Piltover xác thực trước khi ghi trạng thái",
    body: "Kết quả được kiểm tra schema, evidence refs và quyền trước khi đồng bộ vào dữ liệu sản phẩm.",
  },
] as const;

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
                Cách Piltover sử dụng AI
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Agent-first execution, có kiểm soát context, permission và evidence.
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
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
              Chính sách hiện tại: <strong className="text-foreground">AGENT FIRST</strong>.
              OpenClaw được ưu tiên, OAuth worker là fallback. Direct model API-key execution
              bị vô hiệu hóa trên product path.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
