"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Link2, Loader2, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ErrorState";
import {
  addCalendarAsset,
  ensureCalendarDraft,
  removeCalendarAsset,
  reorderCalendarAssets,
  saveCalendarComposer,
  type CalendarDayDTO,
  type CalendarAssetDTO,
} from "@/app/(dashboard)/studio/actions";

export function FacebookPostComposer({ day, onClose }: { day: CalendarDayDTO; onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draftId, setDraftId] = useState(day.draftId);
  const [text, setText] = useState(day.content ?? [day.suggestedTopic, day.suggestedCta].filter(Boolean).join("\n\n"));
  const [assets, setAssets] = useState<CalendarAssetDTO[]>(day.assets);
  const [driveUrl, setDriveUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dateLabel = useMemo(() => day.date ? new Date(day.date).toLocaleString("vi-VN", { dateStyle: "full" }) : `Ngày ${day.dayIndex}`, [day]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function requireDraft() {
    if (draftId) return draftId;
    const res = await ensureCalendarDraft(day.dailyPlanId);
    if (!res.ok) throw new Error(res.error);
    setDraftId(res.data.draftId);
    return res.data.draftId;
  }

  function save() {
    start(async () => {
      try {
        const id = await requireDraft();
        const res = await saveCalendarComposer(id, text);
        if (!res.ok) throw new Error(res.error);
        setError(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không lưu được bài viết.");
      }
    });
  }

  async function addFiles(files: File[]) {
    try {
      const id = await requireDraft();
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const upload = await fetch("/api/upload", { method: "POST", body: form });
        const data = await upload.json();
        if (!upload.ok) throw new Error(data.error ?? "Upload thất bại.");
        const res = await addCalendarAsset({
          draftId: id,
          sourceType: "UPLOAD",
          fileName: data.fileName ?? file.name,
          mimeType: data.mimeType ?? file.type,
          localPath: data.localPath,
        });
        if (!res.ok) throw new Error(res.error);
        setAssets((items) => [...items, {
          id: res.data.id, sourceType: "UPLOAD",
          mediaType: file.type.startsWith("video/") ? "VIDEO" : file.type.startsWith("image/") ? "IMAGE" : "FILE",
          fileName: file.name, mimeType: file.type || null, sourceUrl: null, sortOrder: items.length, status: "READY",
        }]);
      }
      setError(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thêm được media.");
    }
  }

  async function addDrive() {
    if (!driveUrl.trim()) return;
    try {
      const id = await requireDraft();
      const res = await addCalendarAsset({ draftId: id, sourceType: "GOOGLE_DRIVE", sourceUrl: driveUrl.trim() });
      if (!res.ok) throw new Error(res.error);
      setAssets((items) => [...items, {
        id: res.data.id, sourceType: "GOOGLE_DRIVE", mediaType: "FILE",
        fileName: "Google Drive media", mimeType: null, sourceUrl: driveUrl.trim(), sortOrder: items.length, status: "REMOTE",
      }]);
      setDriveUrl("");
      setError(null);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Không thêm được Google Drive link."); }
  }

  async function removeAsset(id: string) {
    const res = await removeCalendarAsset(id);
    if (!res.ok) return setError(res.error);
    setAssets((items) => items.filter((item) => item.id !== id).map((item, i) => ({ ...item, sortOrder: i })));
    router.refresh();
  }

  async function moveAsset(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= assets.length || !draftId) return;
    const next = [...assets];
    [next[index], next[target]] = [next[target], next[index]];
    setAssets(next.map((item, i) => ({ ...item, sortOrder: i })));
    const res = await reorderCalendarAssets(draftId, next.map((item) => item.id));
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <div className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-white/20 bg-[var(--neu-raised)] [box-shadow:var(--shadow-popover)]">
        <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Create Facebook Post</h2>
            <p className="mt-1 text-xs text-muted-foreground">{dateLabel} · Day {day.dayIndex}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}><X className="size-5" /></Button>
        </div>

        <div className="space-y-4 p-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bạn đang nghĩ gì?"
            className="min-h-[190px] w-full resize-y rounded-xl border border-input bg-[var(--neu-inset)] px-4 py-3 text-base leading-6 outline-none [box-shadow:var(--shadow-inset)] focus:ring-2 focus:ring-ring"
          />

          {assets.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {assets.map((asset, index) => (
                <div key={asset.id} className="relative min-h-[130px] overflow-hidden rounded-xl border border-white/20 bg-[var(--neu-inset)]">
                  {asset.sourceType === "UPLOAD" && asset.mediaType === "IMAGE" ? (
                    <img src={`/api/content-assets/${asset.id}`} alt={asset.fileName ?? "media"} className="h-[130px] w-full object-cover" />
                  ) : asset.sourceType === "UPLOAD" && asset.mediaType === "VIDEO" ? (
                    <video src={`/api/content-assets/${asset.id}`} className="h-[130px] w-full object-cover" controls preload="metadata" />
                  ) : (
                    <div className="flex h-[130px] flex-col items-center justify-center gap-2 px-3 text-center">
                      <Link2 className="size-6 text-[var(--neu-teal)]" />
                      <span className="line-clamp-2 text-xs font-medium">{asset.fileName ?? "Google Drive media"}</span>
                      {asset.sourceUrl && <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[var(--neu-teal)]">Open <ExternalLink className="size-3" /></a>}
                    </div>
                  )}
                  <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                    <div className="flex gap-1">
                      <button type="button" disabled={index===0} className="grid size-7 place-items-center rounded-full bg-black/65 text-white disabled:opacity-30" onClick={() => void moveAsset(index,-1)}><ChevronLeft className="size-3.5"/></button>
                      <button type="button" disabled={index===assets.length-1} className="grid size-7 place-items-center rounded-full bg-black/65 text-white disabled:opacity-30" onClick={() => void moveAsset(index,1)}><ChevronRight className="size-3.5"/></button>
                    </div>
                    <button type="button" className="grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-destructive" onClick={() => void removeAsset(asset.id)}><Trash2 className="size-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-white/20 p-3">
            <div className="mb-2 text-xs font-semibold">Media</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="size-4"/>Add image/video</Button>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value=""; }} />
              <div className="flex min-w-[260px] flex-1 gap-2">
                <Input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="Google Drive link…" />
                <Button type="button" size="sm" variant="outline" onClick={() => void addDrive()} disabled={!driveUrl.trim()}>Attach</Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Thứ tự media từ trái sang phải là thứ tự đăng. Google Drive media sẽ được resolve khi publishing job chạy.</p>
          </div>

          {day.post?.scheduledAt && <div className="text-xs text-muted-foreground">Scheduled: {new Date(day.post.scheduledAt).toLocaleString("vi-VN")}</div>}
          {error && <ErrorState message={error} />}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/15 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin"/> : <Save className="size-4"/>}Save Post</Button>
        </div>
      </div>
    </div>
  );
}
