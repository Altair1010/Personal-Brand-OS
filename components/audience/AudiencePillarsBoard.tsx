"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiLoading } from "@/components/AiLoading";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PersonaBoard } from "./PersonaBoard";
import { PillarBoard } from "./PillarBoard";
import { ApproveGate } from "./ApproveGate";
import {
  coerceObjectiveMix,
  newKey,
  pillarToDraft,
  segmentToDraft,
} from "./helpers";
import type {
  BrandDnaContext,
  GoalContext,
  PersonaDraft,
  PillarDraft,
} from "./types";
import {
  saveSegments,
  savePillars,
  resetApproval,
  type SegmentDTO,
  type PillarDTO,
  type SegmentInput,
  type PillarInput,
} from "@/app/(dashboard)/audience-pillars/actions";

// Client board: holds persona + pillar drafts, drives AI generation (fetch-only routes),
// saving (server actions), and the approve gate. Nothing here imports lib/ai — AI is fetched.

interface AudiencePillarsBoardProps {
  brand: BrandDnaContext;
  goal: GoalContext;
  initialSegments: SegmentDTO[];
  initialPillars: PillarDTO[];
  initialApprovedAt: string | null;
}

// Shape of a persona inside the /api/ai/audience response.
interface AiPersona {
  name: string;
  pain: string;
  falseBelief: string;
  fear: string;
  desire: string;
  language: string;
  contentAngle: string;
  cta: string;
  offer: string;
}

export function AudiencePillarsBoard({
  brand,
  goal,
  initialSegments,
  initialPillars,
  initialApprovedAt,
}: AudiencePillarsBoardProps) {
  const router = useRouter();

  const [personas, setPersonas] = useState<PersonaDraft[]>(() =>
    initialSegments.map(segmentToDraft),
  );
  const [pillars, setPillars] = useState<PillarDraft[]>(() =>
    initialPillars.map(pillarToDraft),
  );
  const [approvedAt, setApprovedAt] = useState<string | null>(initialApprovedAt);
  const [dirty, setDirty] = useState(false);

  // last saved counts drive the approve guard (server also re-checks)
  const [savedPersonaCount, setSavedPersonaCount] = useState(
    initialSegments.length,
  );
  const [savedPillarCount, setSavedPillarCount] = useState(
    initialPillars.length,
  );

  const [genPersonaLoading, setGenPersonaLoading] = useState(false);
  const [genPillarLoading, setGenPillarLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  function markDirty() {
    setDirty(true);
    setSavedOk(false);
  }

  function updatePersonas(next: PersonaDraft[]) {
    setPersonas(next);
    markDirty();
  }
  function updatePillars(next: PillarDraft[]) {
    setPillars(next);
    markDirty();
  }

  async function generatePersonas() {
    setAiError(null);
    setGenPersonaLoading(true);
    try {
      const res = await fetch("/api/ai/audience", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandDna: brand,
          goal,
          existingSegments: personas.map((p) => p.name).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAiError(json.error ?? "Sinh personas thất bại. Vui lòng thử lại.");
        return;
      }
      const list = (json.data.personas as AiPersona[]) ?? [];
      setPersonas(
        list.map((p) => ({ _key: newKey(), source: "ai", ...p })),
      );
      markDirty();
    } catch {
      setAiError("Không kết nối được tới máy chủ AI.");
    } finally {
      setGenPersonaLoading(false);
    }
  }

  async function generatePillars() {
    setAiError(null);
    setGenPillarLoading(true);
    try {
      const res = await fetch("/api/ai/pillars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandDna: brand,
          goal,
          personas: personas.map((p) => ({ name: p.name })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAiError(json.error ?? "Sinh trụ cột thất bại. Vui lòng thử lại.");
        return;
      }
      const list =
        (json.data.pillars as {
          name: string;
          description: string;
          ratioPercent: number;
          objectiveMix: unknown;
        }[]) ?? [];
      setPillars(
        list.map((p) => ({
          _key: newKey(),
          name: p.name,
          description: p.description,
          ratioPercent: p.ratioPercent,
          objectiveMix: coerceObjectiveMix(p.objectiveMix),
        })),
      );
      markDirty();
    } catch {
      setAiError("Không kết nối được tới máy chủ AI.");
    } finally {
      setGenPillarLoading(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const segmentInputs: SegmentInput[] = personas.map((p) => ({
        id: p.id,
        name: p.name,
        pain: p.pain,
        falseBelief: p.falseBelief,
        fear: p.fear,
        desire: p.desire,
        language: p.language,
        contentAngle: p.contentAngle,
        cta: p.cta,
        offer: p.offer,
        source: p.source,
      }));
      const pillarInputs: PillarInput[] = pillars.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        ratioPercent: p.ratioPercent,
        objectiveMix: p.objectiveMix,
      }));

      const segRes = await saveSegments(segmentInputs);
      if (!segRes.ok) {
        setSaveError(segRes.error);
        return;
      }
      const pilRes = await savePillars(pillarInputs);
      if (!pilRes.ok) {
        setSaveError(pilRes.error);
        return;
      }

      // Editing after approval invalidates it — reset the gate on the server too.
      if (approvedAt) {
        await resetApproval();
        setApprovedAt(null);
      }

      setPersonas(segRes.data.segments.map(segmentToDraft));
      setPillars(pilRes.data.pillars.map(pillarToDraft));
      setSavedPersonaCount(segRes.data.segments.length);
      setSavedPillarCount(pilRes.data.pillars.length);
      setDirty(false);
      setSavedOk(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const canApprove = savedPersonaCount >= 2 && savedPillarCount >= 3;

  return (
    <div className="space-y-8">
      {aiError && <ErrorState message={aiError} />}

      <section className="space-y-4">
        <PageHeader
          title="Personas"
          description="Chân dung khách hàng mục tiêu (2–4)"
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generatePersonas}
              disabled={genPersonaLoading}
            >
              <Sparkles className="size-4" />
              Sinh personas (AI)
            </Button>
          }
        />
        {genPersonaLoading ? (
          <Card className="border-dashed">
            <CardContent className="py-4">
              <AiLoading status="AI đang dựng persona từ Brand DNA & mục tiêu..." />
            </CardContent>
          </Card>
        ) : (
          <PersonaBoard personas={personas} onChange={updatePersonas} />
        )}
      </section>

      <section className="space-y-4">
        <PageHeader
          title="Trụ cột nội dung"
          description="Các chủ đề chính & tỷ trọng (3–5)"
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generatePillars}
              disabled={genPillarLoading}
            >
              <Sparkles className="size-4" />
              Sinh trụ cột (AI)
            </Button>
          }
        />
        {genPillarLoading ? (
          <Card className="border-dashed">
            <CardContent className="py-4">
              <AiLoading status="AI đang dựng trụ cột nội dung & objective mix..." />
            </CardContent>
          </Card>
        ) : (
          <PillarBoard pillars={pillars} onChange={updatePillars} />
        )}
      </section>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Lưu
        </Button>
        {savedOk && !dirty && (
          <span className="text-sm text-emerald-600">Đã lưu.</span>
        )}
      </div>
      {saveError && <ErrorState message={saveError} onRetry={handleSave} />}

      <ApproveGate
        approvedAt={approvedAt}
        canApprove={canApprove}
        dirty={dirty}
        onApproved={(at) => setApprovedAt(at)}
      />
    </div>
  );
}
