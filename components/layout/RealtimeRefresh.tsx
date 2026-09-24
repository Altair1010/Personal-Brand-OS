"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function RealtimeRefresh() {
  const router = useRouter();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/vnext/events");
    const refresh = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => router.refresh(), 250);
    };
    source.addEventListener("STATE_DELTA", refresh);
    return () => {
      source.close();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [router]);

  return null;
}
