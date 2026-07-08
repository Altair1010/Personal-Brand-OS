"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { saveBrandDna, saveGoal } from "@/app/(dashboard)/onboarding/actions";
import { BrandDnaForm } from "./BrandDnaForm";
import { GoalForm } from "@/components/forms/GoalForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BrandDnaInput } from "@/lib/validators/brandDna";
import type { GoalInput } from "@/lib/validators/goal";

type GoalDraft = Omit<GoalInput, "timeRangeStart" | "timeRangeEnd"> & {
  timeRangeStart?: string;
  timeRangeEnd?: string;
};

export function OnboardingWizard({
  initial,
}: {
  initial: { brand: BrandDnaInput; goal: GoalDraft };
}) {
  const router = useRouter();
  const { step, brand, goal, hydrated, setStep, hydrate } = useOnboardingStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate(initial);
  }, [hydrated, hydrate, initial]);

  async function handleNext() {
    setError(null);
    setSaving(true);
    const res = await saveBrandDna(brand);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep(2);
  }

  async function handleFinish() {
    setError(null);
    setSaving(true);
    const payload: GoalInput = {
      ...goal,
      timeRangeStart: goal.timeRangeStart ? new Date(goal.timeRangeStart) : undefined,
      timeRangeEnd: goal.timeRangeEnd ? new Date(goal.timeRangeEnd) : undefined,
    };
    const res = await saveGoal(payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  const steps = ["Brand DNA", "Mục tiêu"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const active = step === n;
          const complete = step > n || done;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-sm",
                  active && "border-primary bg-primary text-primary-foreground",
                  complete && "border-primary bg-primary text-primary-foreground",
                  !active && !complete && "text-muted-foreground",
                )}
              >
                {complete ? <Check className="size-4" /> : n}
              </span>
              <span className={cn("text-sm", active && "font-medium")}>{label}</span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === 1 ? <BrandDnaForm /> : <GoalForm />}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && (
        <p className="text-sm text-emerald-600">
          Đã lưu mục tiêu và đặt làm mục tiêu đang hoạt động.
        </p>
      )}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1 || saving}
          onClick={() => setStep(1)}
        >
          Quay lại
        </Button>
        {step === 1 ? (
          <Button type="button" disabled={saving} onClick={handleNext}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Tiếp tục
          </Button>
        ) : (
          <Button type="button" disabled={saving} onClick={handleFinish}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Hoàn tất
          </Button>
        )}
      </div>
    </div>
  );
}
