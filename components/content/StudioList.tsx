"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2, PenSquare, Lightbulb, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import {
  createDraftFromIdea,
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
      <EmptyState
        icon={PenSquare}
        title="Chưa có bản nháp nào"
        description="Sinh ý tưởng từ chiến lược rồi tạo bản nháp, hoặc phê duyệt bản nháp có sẵn."
      />
    );
  }

  return (
    <div className="space-y-8">
      {error && <ErrorState message={error} />}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Bản nháp ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bản nháp. Tạo từ ý tưởng bên dưới.
          </p>
        ) : (
          <div className="grid gap-3">
            {drafts.map((d) => (
              <Link key={d.id} href={`/studio/${d.id}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {d.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.objectiveKey ?? "—"} · v{d.version}
                      </p>
                    </div>
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
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
