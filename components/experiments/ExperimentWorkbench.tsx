"use client";

import { useState } from "react";
import { FlaskConical, Loader2, Pause, Play, Plus, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SoftSelect } from "@/components/ui/soft-select";

type ExperimentRow = {
  id: string;
  hypothesis: string;
  entityType: string;
  primaryMetric: string;
  status: string;
  variants: unknown;
  analysis?: unknown;
  conclusion?: string | null;
};

function nextActions(status: string) {
  if (status === "DRAFT") return [{ label: "Ready", status: "READY", icon: CheckCircle2 }];
  if (status === "READY") return [{ label: "Start", status: "RUNNING", icon: Play }];
  if (status === "RUNNING") return [{ label: "Pause", status: "PAUSED", icon: Pause }];
  if (status === "PAUSED") return [{ label: "Resume", status: "RUNNING", icon: RotateCcw }];
  return [];
}

export function ExperimentWorkbench({ initial }: { initial: ExperimentRow[] }) {
  const [rows, setRows] = useState(initial);
  const [hypothesis, setHypothesis] = useState("");
  const [entityType, setEntityType] = useState("content");
  const [primaryMetric, setPrimaryMetric] = useState("ctr");
  const [variant, setVariant] = useState("Variant B");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"hypothesis" | "status">("hypothesis");
  const [selected, setSelected] = useState<string[]>([]);

  const visibleRows = rows
    .filter((row) => statusFilter === "ALL" || row.status === statusFilter)
    .filter((row) => {
      const q = query.trim().toLowerCase();
      return !q || `${row.hypothesis} ${row.entityType} ${row.primaryMetric}`.toLowerCase().includes(q);
    })
    .sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy])));

  async function create() {
    if (!hypothesis.trim()) return;
    setBusy("create"); setError(null);
    try {
      const res = await fetch("/api/vnext/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: {
            hypothesis,
            entityType,
            primaryMetric,
            control: { id: "control", label: "Control" },
            variants: [{ id: "variant-b", label: variant || "Variant B" }],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "CREATE_FAILED");
      setRows((items) => [data.data, ...items]);
      setHypothesis("");
      setVariant("Variant B");
    } catch (e) {
      setError(e instanceof Error ? e.message : "CREATE_FAILED");
    } finally { setBusy(null); }
  }

  async function transition(id: string, status: string) {
    setBusy(id); setError(null);
    try {
      const res = await fetch("/api/vnext/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "transition", id, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "TRANSITION_FAILED");
      setRows((items) => items.map((row) => row.id === id ? data.data : row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "TRANSITION_FAILED");
    } finally { setBusy(null); }
  }

  async function bulkArchive() {
    const eligible = rows.filter((row) => selected.includes(row.id) && ["DRAFT", "READY", "PAUSED", "COMPLETED"].includes(row.status));
    if (!eligible.length) return;
    setBusy("bulk"); setError(null);
    try {
      const updates = await Promise.all(eligible.map(async (row) => {
        const res = await fetch("/api/vnext/experiments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "transition", id: row.id, status: "ARCHIVED" }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "BULK_ARCHIVE_FAILED");
        return data.data as ExperimentRow;
      }));
      const byId = new Map(updates.map((row) => [row.id, row]));
      setRows((items) => items.map((row) => byId.get(row.id) ?? row));
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "BULK_ARCHIVE_FAILED");
    } finally { setBusy(null); }
  }

  async function createRecommendation(id: string) {
    setBusy(id); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/vnext/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "fromExperiment", experimentId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "RECOMMENDATION_FAILED");
      setNotice("Recommendation đã được đưa vào Review & Learning để human approve.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "RECOMMENDATION_FAILED");
    } finally { setBusy(null); }
  }

  async function complete(id: string) {
    const conclusion = window.prompt("Kết luận experiment (không dùng để tự động sửa prompt/strategy):");
    if (!conclusion?.trim()) return;
    setBusy(id); setError(null);
    try {
      const res = await fetch("/api/vnext/experiments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          id,
          conclusion: conclusion.trim(),
          analysis: { source: "human-reviewed", note: conclusion.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "COMPLETE_FAILED");
      setRows((items) => items.map((row) => row.id === id ? data.data : row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "COMPLETE_FAILED");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-[hsl(var(--surface-1))] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="size-4" /> Create experiment
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.8fr_.8fr_.8fr_1fr_auto]">
          <Input value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Hypothesis: changing X will improve Y because…" />
          <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="content / hook / CTA…" />
          <Input value={primaryMetric} onChange={(e) => setPrimaryMetric(e.target.value)} placeholder="Primary metric" />
          <Input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Variant label" />
          <Button onClick={create} disabled={busy === "create" || !hypothesis.trim()}>
            {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create
          </Button>
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        {notice && <p className="mt-3 text-xs text-muted-foreground">{notice}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-[hsl(var(--surface-1))] p-3">
        <Input className="h-8 min-w-[220px] flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter experiments…" />
        <div className="w-[170px]">
          <SoftSelect
            value={statusFilter}
            className="h-8 text-xs"
            ariaLabel="Status filter"
            onChange={setStatusFilter}
            options={[
              { value: "ALL", label: "All statuses" },
              ...["DRAFT","READY","RUNNING","PAUSED","COMPLETED","ARCHIVED"].map((status) => ({ value: status, label: status })),
            ]}
          />
        </div>
        <div className="w-[170px]">
          <SoftSelect
            value={sortBy}
            className="h-8 text-xs"
            ariaLabel="Sort experiments"
            onChange={(next) => setSortBy(next as "hypothesis" | "status")}
            options={[
              { value: "hypothesis", label: "Sort: hypothesis" },
              { value: "status", label: "Sort: status" },
            ]}
          />
        </div>
        <Button size="sm" variant="outline" disabled={busy === "bulk" || selected.length === 0} onClick={bulkArchive}>
          Archive selected ({selected.length})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-[hsl(var(--surface-2))] text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select visible experiments"
                  checked={visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id))}
                  onChange={(e) => setSelected((current) => e.target.checked
                    ? Array.from(new Set([...current, ...visibleRows.map((row) => row.id)]))
                    : current.filter((id) => !visibleRows.some((row) => row.id === id)))}
                />
              </th>
              <th className="py-2.5">Hypothesis</th><th>Entity</th><th>Metric</th><th>Status</th><th className="pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${row.hypothesis}`} checked={selected.includes(row.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>
                <td className="max-w-xl py-3"><div className="font-medium">{row.hypothesis}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.id}</div></td>
                <td>{row.entityType}</td><td className="font-mono">{row.primaryMetric}</td>
                <td><Badge variant="outline">{row.status}</Badge></td>
                <td className="pr-3"><div className="flex justify-end gap-2">
                  {nextActions(row.status).map(({ label, status, icon: Icon }) => (
                    <Button key={status} size="sm" variant="outline" disabled={busy === row.id} onClick={() => transition(row.id, status)}>
                      {busy === row.id ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}{label}
                    </Button>
                  ))}
                  {["RUNNING", "PAUSED"].includes(row.status) && (
                    <Button size="sm" disabled={busy === row.id} onClick={() => complete(row.id)}>Complete</Button>
                  )}
                  {row.status === "COMPLETED" && (
                    <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => createRecommendation(row.id)}>
                      Create recommendation
                    </Button>
                  )}
                </div></td>
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No experiments match this view. Create one from a measurable hypothesis or change filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
