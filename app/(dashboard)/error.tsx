"use client";

import { ErrorState } from "@/components/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-12">
      <ErrorState
        message={error.message || "Đã xảy ra lỗi. Vui lòng thử lại."}
        onRetry={reset}
      />
    </div>
  );
}
