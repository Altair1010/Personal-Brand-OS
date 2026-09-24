"use client";

import { useState } from "react";
import { Check, Loader2, X, ArchiveRestore, Lightbulb, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EvidenceDTO = {
  id: string;
  sourceType: string;
  sourceRef: string | null;
  content: unknown;
  confidence: string | null;
  freshness: string | null;
  capturedAt: string;
};

type RecommendationDTO = {
  id: string;
  type: string;
  title: string;
  rationale: string;
  evidenceRefs: string[];
  status: string;
  createdAt: string;
  evidence: EvidenceDTO[];
};

export function LearningQueue({ initial }: { initial: RecommendationDTO[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: unknown) {
    const res = await fetch("/api/vnext/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "RECOMMENDATION_ACTION_FAILED");
    return data.data;
  }

  async function review(id: string, decision: "ACCEPTED" | "REJECTED") {
    setBusy(id); setError(null);
    try {
      const updated = await post({ action: "review", id, decision });
      setRows((items) => items.map((row) => row.id === id ? { ...row, status: updated.status } : row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "REVIEW_FAILED");
    } finally { setBusy(null); }
  }

  async function apply(id: string) {
    setBusy(id); setError(null);
    try {
      const updated = await post({ action: "apply", id });
      setRows((items) => items.map((row) => row.id === id ? { ...row, status: updated.status } : row));
    } catch (e) {
      setError(e instanceof Error ? e.message : "APPLY_FAILED");
    } finally { setBusy(null); }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Learning queue</h2>
          <p className="mt-1 text-xs text-muted-foreground">Evidence-backed recommendations require human review before they can enter production workflows.</p>
        </div>
        <Badge variant="outline">{rows.filter((row) => row.status === "PROPOSED").length} proposed</Badge>
      </div>
      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</div>}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border bg-[hsl(var(--surface-1))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-muted-foreground" />
                  <h3 className="font-medium">{row.title}</h3>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.rationale}</p>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground">{row.type} · {row.id}</div>
              </div>
              <div className="flex gap-2">
                {row.status === "PROPOSED" && (
                  <>
                    <Button size="sm" disabled={busy === row.id} onClick={() => review(row.id, "ACCEPTED")}>
                      {busy === row.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Accept
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => review(row.id, "REJECTED")}>
                      <X className="size-3" /> Reject
                    </Button>
                  </>
                )}
                {row.status === "ACCEPTED" && (
                  <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => apply(row.id)}>
                    <ArchiveRestore className="size-3" /> Mark applied
                  </Button>
                )}
              </div>
            </div>
            <details className="mt-3 rounded-lg border bg-[hsl(var(--surface-2))]">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                Evidence ({row.evidence.length || row.evidenceRefs.length})
              </summary>
              <div className="space-y-2 border-t p-3">
                {row.evidence.length ? row.evidence.map((ev) => (
                  <div key={ev.id} className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium">{ev.sourceType}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{new Date(ev.capturedAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{ev.sourceRef ?? ev.id} · confidence {ev.confidence ?? "—"} · freshness {ev.freshness ?? "—"}</div>
                    <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(ev.content, null, 2)}</pre>
                  </div>
                )) : (
                  <div className="text-xs text-muted-foreground">
                    {row.evidenceRefs.length ? row.evidenceRefs.join(", ") : "No evidence references attached."}
                  </div>
                )}
              </div>
            </details>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No recommendations yet. Complete experiments or create evidence-backed insights first.
          </div>
        )}
      </div>
    </section>
  );
}
