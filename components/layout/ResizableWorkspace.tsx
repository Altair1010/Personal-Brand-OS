"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  storageKey: string;
  className?: string;
};

type Sizes = { left: number; right: number };

const DEFAULTS: Sizes = { left: 310, right: 360 };

export function ResizableWorkspace({ left, center, right, storageKey, className }: Props) {
  const [sizes, setSizes] = useState<Sizes>(DEFAULTS);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const value = JSON.parse(raw) as Partial<Sizes>;
      setSizes({
        left: typeof value.left === "number" ? value.left : DEFAULTS.left,
        right: typeof value.right === "number" ? value.right : DEFAULTS.right,
      });
    } catch {}
  }, [storageKey]);

  function persist(next: Sizes) {
    setSizes(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function drag(side: "left" | "right", startX: number) {
    const start = { ...sizes };
    const onMove = (event: MouseEvent) => {
      const delta = event.clientX - startX;
      const frameWidth = frameRef.current?.clientWidth ?? 1200;
      const max = Math.max(260, Math.floor(frameWidth * 0.42));
      const next = side === "left"
        ? { ...start, left: Math.min(max, Math.max(220, start.left + delta)) }
        : { ...start, right: Math.min(max, Math.max(280, start.right - delta)) };
      setSizes(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      ref={frameRef}
      className={cn("hidden min-h-[620px] w-full overflow-hidden rounded-2xl border border-white/25 bg-[var(--neu-raised)] [box-shadow:var(--shadow-raised)] lg:grid", className)}
      style={{ gridTemplateColumns: `${sizes.left}px 5px minmax(420px,1fr) 5px ${sizes.right}px` }}
    >
      <aside className="min-w-0 overflow-y-auto bg-[hsl(var(--surface-1))] p-3">{left}</aside>
      <button
        type="button"
        aria-label="Resize context pane"
        onMouseDown={(event) => drag("left", event.clientX)}
        className="cursor-col-resize border-x bg-[hsl(var(--surface-2))] hover:bg-accent"
      />
      <main className="min-w-0 overflow-y-auto p-4">{center}</main>
      <button
        type="button"
        aria-label="Resize inspector pane"
        onMouseDown={(event) => drag("right", event.clientX)}
        className="cursor-col-resize border-x bg-[hsl(var(--surface-2))] hover:bg-accent"
      />
      <aside className="min-w-0 overflow-y-auto bg-[hsl(var(--surface-1))] p-3">{right}</aside>
    </div>
  );
}

export function MobileWorkspace({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 lg:hidden">{children}</div>;
}
