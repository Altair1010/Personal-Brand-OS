import { Loader2 } from "lucide-react";

interface AiLoadingProps {
  status?: string;
}

export function AiLoading({
  status = "AI đang xử lý yêu cầu...",
}: AiLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{status}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Quá trình này có thể mất vài giây...
        </p>
      </div>
      {/* Progress bar placeholder */}
      <div className="w-48 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
      </div>
    </div>
  );
}
