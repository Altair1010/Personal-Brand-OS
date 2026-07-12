"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { AiLoading } from "@/components/AiLoading";
import { ErrorState } from "@/components/ErrorState";
import {
  HOOK_STYLES,
  CTA_INTENSITY,
  FORMATS,
} from "@/lib/constants";
import { HELP_TEXT } from "@/lib/help-text";
import { StructuredEditor } from "./StructuredEditor";
import { PostPreview } from "./PostPreview";
import { ObjectiveSelect } from "./ObjectiveSelect";
import { FrameworkSelect } from "./FrameworkSelect";
import { StatusStepper } from "./StatusStepper";
import { HookGeneratorPanel } from "./HookGeneratorPanel";
import { CtaGeneratorPanel } from "./CtaGeneratorPanel";
import { ToneRewriter } from "./ToneRewriter";
import {
  saveDraft,
  approveDraftAction,
  type DraftDTO,
  type FrameworkDTO,
  type DraftContextDTO,
} from "@/app/(dashboard)/studio/actions";

interface DraftEditorProps {
  draft: DraftDTO;
  frameworks: FrameworkDTO[];
  context: DraftContextDTO;
}

// Generic enum <select> — values are ONLY from the passed constants tuple.
function EnumSelect({
  id,
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">— chọn —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DraftEditor({
  draft,
  frameworks,
  context,
}: DraftEditorProps) {
  const router = useRouter();

  // Content
  const [hook, setHook] = useState(draft.hook ?? "");
  const [body, setBody] = useState(draft.body ?? "");
  const [ending, setEnding] = useState(draft.ending ?? "");
  const [hashtags, setHashtags] = useState(draft.hashtags.join(", "));
  const [imageSuggestion, setImageSuggestion] = useState(
    draft.imageSuggestion ?? "",
  );

  // Dims
  const [objectiveKey, setObjectiveKey] = useState<string | null>(
    draft.objectiveKey,
  );
  const [framework, setFramework] = useState<string | null>(draft.framework);
  const [hookStyle, setHookStyle] = useState<string | null>(draft.hookStyle);
  const [ctaIntensity, setCtaIntensity] = useState<string | null>(
    draft.ctaIntensity,
  );
  const [format, setFormat] = useState<string | null>(draft.format);
  const [tone, setTone] = useState(draft.tone ?? "gần gũi, chuyên gia");
  const [length, setLength] = useState(draft.length ?? "trung bình");

  const [version, setVersion] = useState(draft.version);
  const [status, setStatus] = useState(draft.status);
  const [approvedPostId, setApprovedPostId] = useState<string | null>(
    draft.postId,
  );

  const [writeError, setWriteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const persona: Record<string, unknown> = {
    name: context.personas.map((p) => p.name).join(", "),
  };
  const goalRecord: Record<string, unknown> = {
    description: context.goalName ?? "",
    mainGoal: context.goalName ?? "",
  };
  const brandDna: Record<string, unknown> = {
    positioning: context.brandDnaSummary ?? "",
  };

  const hashtagsArray = () =>
    hashtags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

  // "Viết bằng AI": full post-writer, fills all fields + dims.
  const writeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/post-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: draft.topic ?? draft.title,
          objectiveKey,
          framework: framework ?? undefined,
          tone,
          length,
          persona,
          brandDna,
          cta: context.mainOffer ?? undefined,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Viết bài thất bại";
        throw new Error(msg);
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data: Record<string, unknown> }).data
          : {};
      return data;
    },
    onSuccess: (data) => {
      setWriteError(null);
      const str = (k: string) =>
        typeof data[k] === "string" ? (data[k] as string) : null;
      if (str("hook")) setHook(str("hook") as string);
      if (str("body")) setBody(str("body") as string);
      if (str("ending")) setEnding(str("ending") as string);
      if (Array.isArray(data.hashtags))
        setHashtags(
          (data.hashtags as unknown[])
            .filter((t): t is string => typeof t === "string")
            .join(", "),
        );
      if (str("imageSuggestion"))
        setImageSuggestion(str("imageSuggestion") as string);
      // AI output enums are only accepted if they belong to the constants tuple —
      // otherwise the <select> could transiently show an out-of-enum value.
      const inEnum = (opts: readonly string[], v: string | null) =>
        v !== null && opts.includes(v) ? v : null;
      const hs = inEnum(HOOK_STYLES, str("hookStyle"));
      const ci = inEnum(CTA_INTENSITY, str("ctaIntensity"));
      const fmt = inEnum(FORMATS, str("format"));
      if (hs) setHookStyle(hs);
      if (ci) setCtaIntensity(ci);
      if (fmt) setFormat(fmt);
    },
    onError: (e) =>
      setWriteError(e instanceof Error ? e.message : "Viết bài thất bại."),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveDraft(draft.id, {
        hook,
        body,
        ending,
        hashtags: hashtagsArray(),
        imageSuggestion,
        objectiveKey: objectiveKey ?? undefined,
        framework: framework ?? undefined,
        hookStyle: hookStyle ?? undefined,
        ctaIntensity: ctaIntensity ?? undefined,
        format: format ?? undefined,
        topic: draft.topic ?? undefined,
        tone,
        length,
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      setSaveError(null);
      setVersion(res.data.version);
      setStatus("draft");
      router.refresh();
    },
    onError: () => setSaveError("Không kết nối được tới máy chủ."),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveDraftAction(draft.id),
    onSuccess: (res) => {
      if (!res.ok) {
        // KHÔNG nuốt lỗi invariant — hiển thị message engine.
        setApproveError(res.error);
        return;
      }
      setApproveError(null);
      setStatus("approved");
      setApprovedPostId(res.data.postId);
      router.refresh();
    },
    onError: () => setApproveError("Không kết nối được tới máy chủ."),
  });

  const busy =
    writeMutation.isPending ||
    saveMutation.isPending ||
    approveMutation.isPending;
  const isApproved = status === "approved" || approvedPostId !== null;

  return (
    <div className="space-y-6">
      <StatusStepper status={status} />

      {/* Dims */}
      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
          <ObjectiveSelect
            value={objectiveKey}
            disabled={busy || isApproved}
            onChange={setObjectiveKey}
          />
          <FrameworkSelect
            frameworks={frameworks}
            value={framework}
            disabled={busy || isApproved}
            onChange={setFramework}
          />
          <EnumSelect
            id="sel-hookstyle"
            label="Hook style"
            options={HOOK_STYLES}
            value={hookStyle}
            disabled={busy || isApproved}
            onChange={setHookStyle}
          />
          <EnumSelect
            id="sel-cta"
            label="CTA intensity"
            options={CTA_INTENSITY}
            value={ctaIntensity}
            disabled={busy || isApproved}
            onChange={setCtaIntensity}
          />
          <EnumSelect
            id="sel-format"
            label="Format"
            options={FORMATS}
            value={format}
            disabled={busy || isApproved}
            onChange={setFormat}
          />
          <div className="space-y-1.5">
            <LabelWithHelp htmlFor="fld-tone" help={HELP_TEXT.draftTone}>
              Giọng điệu
            </LabelWithHelp>
            <Input
              id="fld-tone"
              value={tone}
              disabled={busy || isApproved}
              onChange={(e) => setTone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fld-length">Độ dài</Label>
            <Input
              id="fld-length"
              value={length}
              disabled={busy || isApproved}
              onChange={(e) => setLength(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI write full post */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Viết bài bằng AI</h3>
            <Button
              type="button"
              disabled={!objectiveKey || busy || isApproved}
              onClick={() => writeMutation.mutate()}
            >
              {writeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Viết bằng AI
            </Button>
          </div>
          {!objectiveKey && (
            <p className="text-xs text-muted-foreground">
              Chọn objective trước khi viết bài.
            </p>
          )}
          {writeMutation.isPending && (
            <AiLoading status="Đang viết bài Facebook…" />
          )}
          {writeError && <ErrorState message={writeError} />}
        </CardContent>
      </Card>

      {/* Structured editor + live FB preview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <StructuredEditor
              hook={hook}
              body={body}
              ending={ending}
              hashtags={hashtags}
              imageSuggestion={imageSuggestion}
              disabled={busy || isApproved}
              onChange={(patch) => {
                if (patch.hook !== undefined) setHook(patch.hook);
                if (patch.body !== undefined) setBody(patch.body);
                if (patch.ending !== undefined) setEnding(patch.ending);
                if (patch.hashtags !== undefined) setHashtags(patch.hashtags);
                if (patch.imageSuggestion !== undefined)
                  setImageSuggestion(patch.imageSuggestion);
              }}
            />
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <PostPreview
            brandName={context.goalName ?? ""}
            hook={hook}
            body={body}
            ending={ending}
            hashtags={hashtags}
            imageSuggestion={imageSuggestion}
          />
        </div>
      </div>

      {/* AI helper panels */}
      {!isApproved && (
        <div className="grid gap-4 lg:grid-cols-2">
          <HookGeneratorPanel
            topic={draft.topic ?? draft.title}
            objectiveKey={objectiveKey}
            persona={persona}
            onInsert={(text) =>
              setHook((prev) => (prev ? `${text}\n${prev}` : text))
            }
          />
          <CtaGeneratorPanel
            objectiveKey={objectiveKey}
            goal={goalRecord}
            offer={context.mainOffer}
            intensity={ctaIntensity}
            onInsert={(text) =>
              setEnding((prev) => (prev ? `${prev}\n${text}` : text))
            }
          />
        </div>
      )}
      {!isApproved && (
        <ToneRewriter currentBody={body} onRewritten={setBody} />
      )}

      {/* Save + approve */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy || isApproved}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Lưu bản nháp
            </Button>
            <Button
              type="button"
              disabled={busy || isApproved}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Duyệt &amp; tạo Post
            </Button>
            <span className="text-xs text-muted-foreground">
              Phiên bản hiện tại: v{version}
            </span>
          </div>

          {saveError && <ErrorState message={saveError} />}
          {approveError && <ErrorState message={approveError} />}

          {isApproved && approvedPostId && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
              <CheckCircle2 className="size-4" />
              Đã duyệt và tạo Post.
              <Link href="/calendar" className="underline">
                Xem trên Lịch
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
