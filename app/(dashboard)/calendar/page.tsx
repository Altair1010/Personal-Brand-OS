import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { CalendarMonth } from "@/components/content/CalendarMonth";
import { getCalendarData } from "../studio/actions";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const data = await getCalendarData();

  return (
    <>
      <PageHeader
        title="Lịch đăng bài"
        description="Xem và quản lý lịch trình nội dung 30 ngày"
      />
      {!data.hasStrategy || data.days.length === 0 ? (
        <>
          <EmptyState
            icon={CalendarDays}
            title="Lịch trống"
            description="Tạo chiến lược 30 ngày để xem lịch đăng bài được lên kế hoạch theo từng ngày."
          />
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/strategy">Tới Chiến lược</Link>
            </Button>
          </div>
        </>
      ) : (
        <CalendarMonth days={data.days} />
      )}
    </>
  );
}
