"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, CheckCircle2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { SoftSelect } from "@/components/ui/soft-select";
import { AiLoading } from "@/components/AiLoading";
import { invokeAgentAi } from "@/lib/ai/agent-client";
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
import { MobileWorkspace, ResizableWorkspace } from "@/components/layout/ResizableWorkspace";
import { HookGeneratorPanel } from "./HookGeneratorPanel";
import { CtaGeneratorPanel } from "./CtaGeneratorPanel";
import { ToneRewriter } from "./ToneRewriter";
import {
  saveDraft,
  approveDraftAction,
  createPostAction,
  deleteDraftAction,
  prepareContentBriefForDraft,
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
      <SoftSelect
        value={value ?? ""}
        disabled={disabled}
        onChange={onChange}
        placeholder="— chọn —"
        ariaLabel={label}
        options={[
          { value: "", label: "— chọn —" },
          ...options.map((option) => ({ value: option, label: option })),
        ]}
      />
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
  const [draftName, setDraftName] = useState(draft.topic ?? draft.title ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [notes, setNotes] = useState(draft.notes ?? "");
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
  const [createPostError, setCreatePostError] = useState<string | null>(null);

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

  const normalizeHashtag = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "");

  const hashtagsArray = () => hashtags.split(",").map((t) => normalizeHashtag(t.trim())).filter(Boolean);

  // "Viết bằng AI": full post-writer, fills all fields + dims.
  const writeMutation = useMutation({
    mutationFn: async () => {
      if (!objectiveKey) throw new Error("Chọn objective trước khi viết bài.");
      const briefResult = await prepareContentBriefForDraft(draft.id, {
        objective: objectiveKey,
        audienceRef: context.personas[0]?.name,
        format: format ?? "text",
        channel: "facebook",
        tone,
        intensity: ctaIntensity ?? undefined,
        hookDirection: hookStyle ?? undefined,
        length,
        cta: context.mainOffer ?? undefined,
        keyMessage: description.trim() || draftName.trim() || undefined,
        offer: context.mainOffer ?? undefined,
      });
      if (!briefResult.ok) throw new Error(briefResult.error);
      const data = await invokeAgentAi<Record<string, unknown>>("/api/ai/post-writer", {
        contentBriefId: briefResult.data.briefId,
        idea: [draftName.trim() || context.goalName || "Nội dung theo chiến lược", description.trim(), notes.trim()].filter(Boolean).join(" | "),
        objectiveKey,
        framework: framework ?? undefined,
        hookStyle: hookStyle ?? undefined,
        ctaIntensity: ctaIntensity ?? undefined,
        format: format ?? undefined,
        tone,
        length,
        persona,
        brandDna,
        cta: context.mainOffer ?? undefined,
      });
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
            .map(normalizeHashtag)
            .filter(Boolean)
            .join(", "),
        );
      if (str("imageSuggestion"))
        setImageSuggestion(str("imageSuggestion") as string);
      // AI output enums are only accepted if they belong to the constants tuple —
      // otherwise the <select> could transiently show an out-of-enum value.
      const inEnum = (opts: readonly string[], v: string | null) =>
        v !== null && opts.includes(v) ? v : null;
      // User-selected dimensions are authoritative. AI may suggest dimensions only when the form is empty.
      const hs = inEnum(HOOK_STYLES, str("hookStyle"));
      const ci = inEnum(CTA_INTENSITY, str("ctaIntensity"));
      const fmt = inEnum(FORMATS, str("format"));
      if (!hookStyle && hs) setHookStyle(hs);
      if (!ctaIntensity && ci) setCtaIntensity(ci);
      if (!format && fmt) setFormat(fmt);
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
        topic: draftName.trim() || undefined,
        description,
        notes,
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

  const deleteMutation = useMutation({
    mutationFn: () => deleteDraftAction(draft.id),
    onSuccess: (res) => {
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      router.push("/studio");
      router.refresh();
    },
    onError: () => setSaveError("Không kết nối được tới máy chủ."),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveDraftAction(draft.id),
    onSuccess: (res) => {
      if (!res.ok) {
        setApproveError(res.error);
        return;
      }
      setApproveError(null);
      setStatus("approved");
      router.refresh();
    },
    onError: () => setApproveError("Không kết nối được tới máy chủ."),
  });

  const createPostMutation = useMutation({
    mutationFn: () => createPostAction(draft.id),
    onSuccess: (res) => {
      if (!res.ok) {
        setCreatePostError(res.error);
        return;
      }
      setCreatePostError(null);
      setApprovedPostId(res.data.postId);
      router.refresh();
    },
    onError: () => setCreatePostError("Không kết nối được tới máy chủ."),
  });

  const busy =
    writeMutation.isPending ||
    saveMutation.isPending ||
    approveMutation.isPending ||
    createPostMutation.isPending ||
    deleteMutation.isPending;
  const hasPost = approvedPostId !== null;
  const isApproved = status === "approved" || hasPost;

  return (
    <div className="space-y-6">
      <StatusStepper status={status} />

      {/* Draft metadata + generation dimensions */}
      <Card>
        <CardContent className="grid gap-5 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="fld-draft-name">Tên / chủ đề bản nháp</Label>
            <Input id="fld-draft-name" value={draftName} disabled={busy || isApproved} placeholder="Nhập chủ đề thực tế để AI bám sát nội dung…" onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fld-description">Mô tả</Label>
            <Input id="fld-description" value={description} disabled={busy || isApproved} placeholder="Mô tả ngắn về mục đích hoặc nội dung bản nháp…" onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fld-notes">Ghi chú</Label>
            <Input id="fld-notes" value={notes} disabled={busy || isApproved} placeholder="Ghi chú nội bộ…" onChange={(e) => setNotes(e.target.value)} />
          </div>
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
          <EnumSelect id="sel-length" label="Độ dài" options={["ngắn", "trung bình", "dài"] as const} value={length} disabled={busy || isApproved} onChange={setLength} />
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

      {/* Resizable content workbench */}
      <ResizableWorkspace
        storageKey="piltover-studio-workbench-v1"
        left={
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Brief</p>
              <p className="mt-2 text-sm font-medium">{draftName || "Untitled draft"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{description || "No description"}</p>
            </div>
            <div className="rounded-lg border bg-background p-3 text-xs">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <span className="text-muted-foreground">Objective</span><span>{objectiveKey ?? "—"}</span>
                <span className="text-muted-foreground">Format</span><span>{format ?? "—"}</span>
                <span className="text-muted-foreground">Intensity</span><span>{ctaIntensity ?? "—"}</span>
                <span className="text-muted-foreground">Length</span><span>{length}</span>
                <span className="text-muted-foreground">Audience</span><span className="truncate">{context.personas[0]?.name ?? "—"}</span>
                <span className="text-muted-foreground">Offer</span><span className="truncate">{context.mainOffer ?? "—"}</span>
              </div>
            </div>
            {notes && <div className="rounded-lg border p-3 text-xs text-muted-foreground">{notes}</div>}
          </div>
        }
        center={
          <Card className="border-0 shadow-none">
            <CardContent className="p-5">
              <StructuredEditor
              format={format}
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
                if (patch.imageSuggestion !== undefined) setImageSuggestion(patch.imageSuggestion);
              }}
            />
            </CardContent>
          </Card>
        }
        right={<div className="space-y-3"><PostPreview
              brandName={context.goalName ?? ""}
              hook={hook}
              body={body}
              ending={ending}
              hashtags={hashtags}
              imageSuggestion={imageSuggestion}
            /><div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">Inspector · live preview · quality and SEO checks will attach to the persisted ContentMaster/QualityGate chain.</div></div>}
      />
      <MobileWorkspace>
        <Card><CardContent className="px-5 py-5"><StructuredEditor
              format={format}
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
                if (patch.imageSuggestion !== undefined) setImageSuggestion(patch.imageSuggestion);
              }}
            /></CardContent></Card>
        <PostPreview
              brandName={context.goalName ?? ""}
              hook={hook}
              body={body}
              ending={ending}
              hashtags={hashtags}
              imageSuggestion={imageSuggestion}
            />
      </MobileWorkspace>

      {/* AI helper panels */}
      {!isApproved && (
        <div className="grid gap-4 lg:grid-cols-2">
          <HookGeneratorPanel
            topic={draftName.trim() || context.goalName || "Nội dung theo chiến lược"}
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
            {!isApproved && (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Xóa bản nháp này? Hành động này không thể hoàn tác.")) {
                    deleteMutation.mutate();
                  }
                }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete draft
              </Button>
            )}
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
              Duyệt
            </Button>
            <Button
              type="button"
              variant={isApproved && !hasPost ? "default" : "outline"}
              disabled={busy || !isApproved || hasPost}
              onClick={() => createPostMutation.mutate()}
            >
              {createPostMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Tạo Post
            </Button>
            <span className="text-xs text-muted-foreground">
              Phiên bản hiện tại: v{version}
            </span>
          </div>

          {saveError && <ErrorState message={saveError} />}
          {approveError && <ErrorState message={approveError} />}
          {createPostError && <ErrorState message={createPostError} />}

          {isApproved && !hasPost && (
            <div className="rounded-xl border border-[var(--neu-teal)]/20 bg-[var(--neu-teal-soft)] px-3 py-2 text-sm text-[var(--neu-teal)]">
              Bản nháp đã được duyệt. Nhấn <strong>Tạo Post</strong> khi bạn muốn đưa nội dung vào Calendar/Campaign.
            </div>
          )}

          {hasPost && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
              <CheckCircle2 className="size-4" />
              Post đã được tạo.
              <Link href="/calendar" className="underline">
                Xem trên Calendar
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
