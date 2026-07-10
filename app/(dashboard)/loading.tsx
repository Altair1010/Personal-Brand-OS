import { AiLoading } from "@/components/AiLoading";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <AiLoading status="Đang tải..." />
    </div>
  );
}
