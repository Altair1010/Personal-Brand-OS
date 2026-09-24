import { AlertCircle, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

function isPendingAgentMessage(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes("agent job") && (
      value.includes("xếp hàng") ||
      value.includes("queued") ||
      value.includes("chưa hoàn tất") ||
      value.includes("pending")
    )
  );
}

export function ErrorState({
  message = "Đã xảy ra lỗi. Vui lòng thử lại.",
  onRetry,
}: ErrorStateProps) {
  const pending = isPendingAgentMessage(message);
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border px-4 py-3.5 [box-shadow:var(--shadow-raised-sm)]",
        pending
          ? "border-[#b98a45]/45 bg-[#eadfc9] text-[#4d381c] dark:border-[#d5a55d]/35 dark:bg-[#493d2c] dark:text-[#fff0ce]"
          : "border-[#b45b51]/45 bg-[#ead5d1] text-[#552821] dark:border-[#c56b60]/40 dark:bg-[#4a2927] dark:text-[#ffe9e5]",
      ].join(" ")}
      role="alert"
    >
      <span
        className={[
          "grid size-8 shrink-0 place-items-center rounded-full",
          pending
            ? "bg-[#b98a45]/14 text-[#765323] dark:bg-[#ffd38b]/10 dark:text-[#ffd38b]"
            : "bg-[#b45b51]/12 text-[#8f3e36] dark:bg-[#ffb4aa]/10 dark:text-[#ffb4aa]",
        ].join(" ")}
      >
        {pending ? <Clock3 className="size-4" /> : <AlertCircle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={[
            "text-[11px] font-extrabold uppercase tracking-[0.08em]",
            pending
              ? "text-[#65471f] dark:text-[#ffdda4]"
              : "text-[#7d352e] dark:text-[#ffc8c1]",
          ].join(" ")}
        >
          {pending ? "Agent job pending" : "Action failed"}
        </div>
        <p className="mt-1 text-sm font-semibold leading-5 text-current">{message}</p>
        {pending && (
          <p className="mt-1 text-xs leading-4 opacity-80">
            Job vẫn đang ở Control Plane; đây là trạng thái chờ, không phải lỗi dữ liệu của nội dung.
          </p>
        )}
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={onRetry}
        >
          Thử lại
        </Button>
      )}
    </div>
  );
}
