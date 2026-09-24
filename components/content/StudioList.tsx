"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, PenSquare, Lightbulb, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import {
  createBlankDraft,
  createDraftFromIdea,
  deleteDraftAction,
  type StudioDraftDTO,
  type StudioIdeaDTO,
} from "@/app/(dashboard)/studio/actions";

interface StudioListProps {
  drafts: StudioDraftDTO[];
  ideasWithoutDraft: StudioIdeaDTO[];
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "approved" || status === "posted" || status === "analyzed")
    return "default";
  if (status === "draft") return "secondary";
  return "outline";
}

export function StudioList({ drafts, ideasWithoutDraft }: StudioListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const blankMutation = useMutation({
    mutationFn: () => createBlankDraft(),
    onSuccess: (res) => {
      if (!res.ok) return setError(res.error);
      setError(null);
      router.push(`/studio/${res.data.draftId}`);
    },
    onError: () => setError("Không kết nối được tới máy chủ."),
  });

  const deleteMutation = useMutation({
    mutationFn: (draftId: string) => deleteDraftAction(draftId),
    onSuccess: (res) => {
      if (!res.ok) return setError(res.error);
      setError(null);
      router.refresh();
    },
    onError: () => setError("Không kết nối được tới máy chủ."),
  });

  const createMutation = useMutation({
    mutationFn: (ideaId: string) => createDraftFromIdea(ideaId),
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      router.push(`/studio/${res.data.draftId}`);
    },
    onError: () => setError("Không kết nối được tới máy chủ."),
  });

  if (drafts.length === 0 && ideasWithoutDraft.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button type="button" disabled={blankMutation.isPending} onClick={() => blankMutation.mutate()}>
            {blankMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
            Tạo bản nháp
          </Button>
        </div>
        {error && <ErrorState message={error} />}
        <EmptyState icon={PenSquare} title="Chưa có bản nháp nào" description="Tạo bản nháp ngay trong Studio hoặc bắt đầu từ một ý tưởng trong chiến lược." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && <ErrorState message={error} />}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Bản nháp ({drafts.length})
          </h2>
          <Button type="button" size="sm" disabled={blankMutation.isPending} onClick={() => blankMutation.mutate()}>
            {blankMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlusCircle className="size-4" />}
            Tạo bản nháp
          </Button>
        </div>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bản nháp. Tạo từ ý tưởng bên dưới.
          </p>
        ) : (
          <div className="grid gap-3">
            {drafts.map((draft) => (
              <Card key={draft.id} className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3 py-4">
                  <Link href={`/studio/${draft.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{draft.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {draft.objectiveKey ?? "—"} · v{draft.version}
                    </p>
                  </Link>
                  <Badge variant={statusVariant(draft.status)}>{draft.status}</Badge>
                  {!draft.approved && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={deleteMutation.isPending && deleteMutation.variables === draft.id}
                      onClick={() => {
                        if (window.confirm("Xóa bản nháp này? Hành động này không thể hoàn tác.")) {
                          deleteMutation.mutate(draft.id);
                        }
                      }}
                      aria-label={`Xóa ${draft.title}`}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === draft.id
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Trash2 className="size-4" />}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {ideasWithoutDraft.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Lightbulb className="size-4" /> Tạo từ ý tưởng (
            {ideasWithoutDraft.length})
          </h2>
          <div className="grid gap-3">
            {ideasWithoutDraft.map((idea) => (
              <Card key={idea.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {idea.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {idea.objectiveKey ?? "—"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={createMutation.isPending}
                    onClick={() => createMutation.mutate(idea.id)}
                  >
                    {createMutation.isPending &&
                    createMutation.variables === idea.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PlusCircle className="size-4" />
                    )}
                    Tạo bản nháp
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
