"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ErrorState";
import { approveAudience } from "@/app/(dashboard)/audience-pillars/actions";

// Review gate. "Duyệt & tạo chiến lược" stays DISABLED until BOTH boxes are ticked AND the
// current draft is saved with >=2 personas & >=1 pillar. Once approved, shows a badge + a
// link to /strategy. Editing after approval is handled by the parent (resetApproval on save).

interface ApproveGateProps {
  approvedAt: string | null;
  // true only when saved counts already meet the server guard (>=2 personas, >=1 pillar)
  canApprove: boolean;
  // true when the draft has unsaved changes — approval must wait for a save
  dirty: boolean;
  onApproved: (approvedAt: string) => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export function ApproveGate({
  approvedAt,
  canApprove,
  dirty,
  onApproved,
}: ApproveGateProps) {
  const [confirmPersona, setConfirmPersona] = useState(false);
  const [confirmPillar, setConfirmPillar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (approvedAt) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Đã duyệt Khán giả & Trụ cột
              </p>
              <p className="text-muted-foreground">
                Lúc {formatWhen(approvedAt)}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/strategy">Sang Chiến lược</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const bothTicked = confirmPersona && confirmPillar;
  const disabled = !bothTicked || !canApprove || dirty || submitting;

  async function handleApprove() {
    setError(null);
    setSubmitting(true);
    const res = await approveAudience();
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onApproved(res.data.approvedAt);
  }

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lock className="size-4" />
          Cổng duyệt
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmPersona}
            onChange={(e) => setConfirmPersona(e.target.checked)}
            className="size-4"
          />
          Tôi đã xác nhận Persona
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmPillar}
            onChange={(e) => setConfirmPillar(e.target.checked)}
            className="size-4"
          />
          Tôi đã xác nhận Trụ cột
        </label>

        {!canApprove && (
          <p className="text-xs text-muted-foreground">
            Cần lưu ít nhất 2 persona và 3 trụ cột trước khi duyệt.
          </p>
        )}
        {canApprove && dirty && (
          <p className="text-xs text-amber-600">
            Có thay đổi chưa lưu — hãy bấm “Lưu” trước khi duyệt.
          </p>
        )}

        {error && <ErrorState message={error} onRetry={handleApprove} />}

        <Button type="button" disabled={disabled} onClick={handleApprove}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Duyệt & tạo chiến lược
        </Button>
      </CardContent>
    </Card>
  );
}
