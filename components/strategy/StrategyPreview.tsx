"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SoftSelect } from "@/components/ui/soft-select";
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

const OBJECTIVE_BAR_COLORS: Record<string, string> = {
  seo: "#0C4F54",
  educate: "#2D6A6D",
  trust: "#5A8581",
  conversion: "#B58D55",
  story: "#8C6A64",
  community: "#6F876F",
};

// Content-ratio bar: visible stacked segments + evenly distributed legend.
function ContentRatioBar({ ratio }: { ratio: Record<string, number> }) {
  const entries = OBJECTIVES.map((key) => [key, ratio[key] ?? 0] as const);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-white/25 bg-[var(--neu-inset)] [box-shadow:var(--shadow-inset)]">
        {entries.map(([key, value]) => (
          <div
            key={key}
            style={{
              width: `${Math.max(0, (value / total) * 100)}%`,
              backgroundColor: OBJECTIVE_BAR_COLORS[key] ?? "#9A8B73",
            }}
            title={`${key.toUpperCase()}: ${value}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: OBJECTIVE_BAR_COLORS[key] ?? "#9A8B73" }}
              />
              <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-foreground">
                {key}
              </span>
            </div>
            <div className="font-mono text-[11px] font-semibold text-muted-foreground">{value}%</div>
          </div>
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
    <div className="grid min-w-[1080px] grid-cols-[70px_120px_220px_minmax(280px,1fr)_minmax(240px,.9fr)_86px] items-center gap-3 border-b border-[rgba(154,139,115,.18)] px-3 py-3 text-sm last:border-b-0">
      <span className="text-xs font-semibold text-foreground">Day {day.dayIndex}</span>
      <SoftSelect
        value={objective}
        onChange={setObjective}
        className="h-9"
        options={OBJECTIVES.map((item) => ({ value: item, label: item.toUpperCase() }))}
      />
      <SoftSelect
        value={pillarId}
        onChange={setPillarId}
        className="h-9"
        placeholder="— trụ cột —"
        options={[
          { value: "", label: "— trụ cột —" },
          ...pillars.map((pillar) => ({ value: pillar.id, label: pillar.name })),
        ]}
      />
      <Input className="h-9" value={topic} placeholder="Chủ đề gợi ý" onChange={(e) => setTopic(e.target.value)} />
      <Input className="h-9" value={cta} placeholder="CTA" onChange={(e) => setCta(e.target.value)} />
      <Button type="button" size="sm" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Lưu
      </Button>
      {error && <span className="col-span-6 text-xs text-destructive">{error}</span>}
    </div>
  );
}

// Read-only day row (default view).
function DailyPlanRow({ day }: { day: StrategyDailyPlanDTO }) {
  return (
    <div className="grid min-w-[980px] grid-cols-[70px_110px_220px_minmax(300px,1.2fr)_minmax(260px,1fr)] items-start gap-3 border-b border-[rgba(154,139,115,.18)] px-3 py-3 text-sm last:border-b-0">
      <span className="pt-1 text-xs font-semibold text-foreground">Day {day.dayIndex}</span>
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] ${objectiveClass(day.plannedObjective)}`}>
        {day.plannedObjective || "—"}
      </span>
      <span className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground">
        {day.pillarName || "—"}
      </span>
      <span className="leading-5 text-foreground">{day.suggestedTopic || "—"}</span>
      <span className="leading-5 text-foreground/80">{day.suggestedCta || "—"}</span>
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
        <h3 className="text-base font-bold tracking-tight">Strategy Framework</h3>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Tỷ trọng nội dung hiện tại {sum}% — hệ thống tự chuẩn hoá về 100% khi lưu.
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
        <h2 className="text-2xl font-extrabold tracking-tight">{strategy.name}</h2>
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
            <h3 className="text-base font-bold tracking-tight">Monthly Content Mix</h3>
            <ContentRatioBar ratio={strategy.contentRatio} />
          </CardContent>
        </Card>
      )}

      <WeeklyThemeTimeline weeks={strategy.weeks} />

      {/* 30 daily plans grouped by week */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight">30-Day Content Plan</h3>
        {strategy.weeks.map((w) => (
          <Card key={w.weekIndex}>
            <CardContent className="py-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <span className="text-base font-bold">Week {w.weekIndex}</span>
                {w.theme && (
                  <span className="text-sm font-medium text-foreground/80">{w.theme}</span>
                )}
              </div>
              {w.notes && (
                <p className="mb-4 max-w-5xl rounded-lg border border-white/15 bg-[var(--neu-inset)] px-3 py-2 text-justify text-xs leading-5 text-muted-foreground [box-shadow:var(--shadow-inset)]">{w.notes}</p>
              )}
              <div className="overflow-x-auto rounded-xl border border-white/20 bg-[hsl(var(--surface-2))]">
                <div
                  className={
                    editMode
                      ? "grid min-w-[1080px] grid-cols-[70px_120px_220px_minmax(280px,1fr)_minmax(240px,.9fr)_86px] gap-3 border-b border-[rgba(12,79,84,.12)] bg-[rgba(12,79,84,.06)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--neu-teal)]"
                      : "grid min-w-[980px] grid-cols-[70px_110px_220px_minmax(300px,1.2fr)_minmax(260px,1fr)] gap-3 border-b border-[rgba(12,79,84,.12)] bg-[rgba(12,79,84,.06)] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--neu-teal)]"
                  }
                >
                  <span>Day</span><span>Objective</span><span>Pillar</span><span>Topic</span><span>CTA</span>
                  {editMode && <span>Action</span>}
                </div>
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
          <CardContent className="space-y-3 py-5">
            <h3 className="text-xl font-extrabold tracking-tight">CTA Plan</h3>
            <div className="overflow-x-auto rounded-xl border border-white/20">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="bg-[rgba(12,79,84,.06)] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--neu-teal)]">
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">CTA</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.ctaPlan.map((item, index) => (
                    <tr key={index} className="border-t border-[rgba(154,139,115,.18)]">
                      <td className="px-4 py-3 font-semibold text-foreground">{item.stage}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.when || "—"}</td>
                      <td className="px-4 py-3 leading-5 text-foreground">{item.cta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* topicMap */}
      {strategy.topicMap.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-xl font-extrabold tracking-tight">Topic Map</h3>
            <ul className="space-y-2 text-sm leading-6">
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
                <h3 className="text-base font-bold tracking-tight">KPI Tracking</h3>
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
                <h3 className="text-base font-bold tracking-tight">Do-Not List</h3>
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
