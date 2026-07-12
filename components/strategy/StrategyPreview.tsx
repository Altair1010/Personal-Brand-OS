"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OBJECTIVE_COLORS, OBJECTIVES, type Objective } from "@/lib/constants";
import { WeeklyThemeTimeline } from "./WeeklyThemeTimeline";
import {
  updateDailyPlan,
  updateStrategyFrame,
  type PillarContextDTO,
  type StrategyDailyPlanDTO,
  type StrategyDTO,
} from "@/app/(dashboard)/strategy/actions";

interface StrategyPreviewProps {
  strategy: StrategyDTO;
  pillars: PillarContextDTO[];
}

function isObjective(k: string): k is Objective {
  return (OBJECTIVES as readonly string[]).includes(k);
}

function objectiveClass(k: string): string {
  return isObjective(k) ? OBJECTIVE_COLORS[k] : "bg-muted text-muted-foreground";
}

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Content-ratio bar: a single stacked bar across the 6 objectives.
function ContentRatioBar({ ratio }: { ratio: Record<string, number> }) {
  const entries = OBJECTIVES.map((k) => [k, ratio[k] ?? 0] as const).filter(
    ([, v]) => v > 0,
  );
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full border">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className={objectiveClass(k)}
            style={{ width: `${(v / total) * 100}%` }}
            title={`${k}: ${v}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${objectiveClass(
              k,
            )}`}
          >
            {k} {v}%
          </span>
        ))}
      </div>
    </div>
  );
}

// One editable day row (Strategy edit mode). Keeps its own draft; on save persists in place.
function DailyPlanEditRow({
  day,
  pillars,
  onSaved,
}: {
  day: StrategyDailyPlanDTO;
  pillars: PillarContextDTO[];
  onSaved: () => void;
}) {
  const [objective, setObjective] = useState(day.plannedObjective || OBJECTIVES[0]);
  const [pillarId, setPillarId] = useState(day.pillarId ?? "");
  const [topic, setTopic] = useState(day.suggestedTopic);
  const [cta, setCta] = useState(day.suggestedCta);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await updateDailyPlan(day.dailyPlanId, {
        plannedObjective: objective as Objective,
        suggestedTopic: topic,
        suggestedCta: cta,
        pillarId: pillarId || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
        Ngày {day.dayIndex}
      </span>
      <select
        className={selectClass}
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
      >
        {OBJECTIVES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={pillarId}
        onChange={(e) => setPillarId(e.target.value)}
      >
        <option value="">— trụ cột —</option>
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Input
        className="h-9 flex-1 min-w-[8rem]"
        value={topic}
        placeholder="Chủ đề gợi ý"
        onChange={(e) => setTopic(e.target.value)}
      />
      <Input
        className="h-9 w-40"
        value={cta}
        placeholder="CTA"
        onChange={(e) => setCta(e.target.value)}
      />
      <Button type="button" size="sm" onClick={save} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Lưu
      </Button>
      {error && (
        <span className="w-full text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}

// Read-only day row (default view).
function DailyPlanRow({ day }: { day: StrategyDailyPlanDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
        Ngày {day.dayIndex}
      </span>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${objectiveClass(
          day.plannedObjective,
        )}`}
      >
        {day.plannedObjective}
      </span>
      {day.pillarName && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
          {day.pillarName}
        </span>
      )}
      <span className="flex-1 min-w-[8rem]">{day.suggestedTopic || "—"}</span>
      {day.suggestedCta && (
        <span className="text-xs text-muted-foreground">
          CTA: {day.suggestedCta}
        </span>
      )}
    </div>
  );
}

// Frame editor: contentRatio (normalized to 100 in code) + kpiToTrack + doNotList.
function FrameEditor({
  strategy,
  onSaved,
}: {
  strategy: StrategyDTO;
  onSaved: () => void;
}) {
  const [ratio, setRatio] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const k of OBJECTIVES) base[k] = strategy.contentRatio?.[k] ?? 0;
    return base;
  });
  const [kpi, setKpi] = useState(strategy.kpiToTrack.join("\n"));
  const [doNot, setDoNot] = useState(strategy.doNotList.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sum = OBJECTIVES.reduce((s, k) => s + (ratio[k] || 0), 0);

  function toLines(s: string): string[] {
    return s
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateStrategyFrame(strategy.versionId, {
        contentRatio: ratio,
        kpiToTrack: toLines(kpi),
        doNotList: toLines(doNot),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-4">
        <h3 className="text-sm font-semibold">Chỉnh khung chiến lược</h3>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Tỷ trọng nội dung (tổng hiện tại {sum}% — hệ thống tự chuẩn hoá về
            100% khi lưu)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OBJECTIVES.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <span className="w-20 shrink-0">{k}</span>
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  value={ratio[k]}
                  onChange={(e) =>
                    setRatio((r) => ({
                      ...r,
                      [k]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">KPI theo dõi (mỗi dòng 1 mục)</label>
            <Textarea
              rows={4}
              value={kpi}
              onChange={(e) => setKpi(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Điều cần tránh (mỗi dòng 1 mục)</label>
            <Textarea
              rows={4}
              value={doNot}
              onChange={(e) => setDoNot(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Lưu khung
        </Button>
      </CardContent>
    </Card>
  );
}

export function StrategyPreview({ strategy, pillars }: StrategyPreviewProps) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const onSaved = () => router.refresh();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{strategy.name}</h2>
        <span className="text-sm text-muted-foreground">
          phiên bản v{strategy.version}
        </span>
        {strategy.frameworkSlug && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {strategy.frameworkSlug}
          </span>
        )}
        {strategy.editedAt && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            đã chỉnh tay
          </span>
        )}
        <Button
          type="button"
          variant={editMode ? "default" : "outline"}
          size="sm"
          className="ml-auto"
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? <X className="size-4" /> : <Pencil className="size-4" />}
          {editMode ? "Xong" : "Chỉnh sửa"}
        </Button>
      </div>

      {editMode && <FrameEditor strategy={strategy} onSaved={onSaved} />}

      {!editMode && strategy.contentRatio && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">Tỷ trọng nội dung tháng</h3>
            <ContentRatioBar ratio={strategy.contentRatio} />
          </CardContent>
        </Card>
      )}

      <WeeklyThemeTimeline weeks={strategy.weeks} />

      {/* 30 daily plans grouped by week */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Kế hoạch 30 ngày</h3>
        {strategy.weeks.map((w) => (
          <Card key={w.weekIndex}>
            <CardContent className="py-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold">Tuần {w.weekIndex}</span>
                {w.theme && (
                  <span className="text-sm text-muted-foreground">
                    {w.theme}
                  </span>
                )}
              </div>
              {w.notes && (
                <p className="mb-3 text-xs italic text-muted-foreground">
                  {w.notes}
                </p>
              )}
              <div className="space-y-2">
                {w.dailyPlans.map((d) =>
                  editMode ? (
                    <DailyPlanEditRow
                      key={d.dailyPlanId}
                      day={d}
                      pillars={pillars}
                      onSaved={onSaved}
                    />
                  ) : (
                    <DailyPlanRow key={d.dailyPlanId} day={d} />
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ctaPlan */}
      {strategy.ctaPlan.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">Kế hoạch CTA</h3>
            <ul className="space-y-1 text-sm">
              {strategy.ctaPlan.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.stage}</span>
                  {c.when && (
                    <span className="text-muted-foreground"> ({c.when})</span>
                  )}
                  : {c.cta}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* topicMap */}
      {strategy.topicMap.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">Bản đồ chủ đề</h3>
            <ul className="space-y-1 text-sm">
              {strategy.topicMap.map((tm, i) => (
                <li key={i}>
                  <span className="font-medium">{tm.pillar}:</span>{" "}
                  {tm.topics.join(", ")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* kpiToTrack + doNotList (read-only view) */}
      {!editMode && (
        <div className="grid gap-4 md:grid-cols-2">
          {strategy.kpiToTrack.length > 0 && (
            <Card>
              <CardContent className="space-y-2 py-4">
                <h3 className="text-sm font-semibold">KPI theo dõi</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {strategy.kpiToTrack.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {strategy.doNotList.length > 0 && (
            <Card>
              <CardContent className="space-y-2 py-4">
                <h3 className="text-sm font-semibold">Điều cần tránh</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {strategy.doNotList.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
