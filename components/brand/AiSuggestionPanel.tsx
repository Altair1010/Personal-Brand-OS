"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ErrorState";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { invokeAgentAi } from "@/lib/ai/agent-client";
import type { BrandDnaInput } from "@/lib/validators/brandDna";

interface BrandDnaResult {
  positioning: string;
  threeWords: [string, string, string];
  differentiationSharpened: string;
  suggestedEducationTopics: string[];
  profilePatch?: Partial<BrandDnaInput>;
}

function isBlank(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

export function AiSuggestionPanel() {
  const brand = useOnboardingStore((s) => s.brand);
  const sourceDocuments = useOnboardingStore((s) => s.sourceDocuments);
  const analysisRequestId = useOnboardingStore((s) => s.analysisRequestId);
  const patchBrand = useOnboardingStore((s) => s.patchBrand);
  const handledAnalysisRequest = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function analyze() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const extractedFileText = sourceDocuments
        .map((doc) => `# SOURCE: ${doc.fileName}\n${doc.text}`)
        .join("\n\n");
      const data = await invokeAgentAi<BrandDnaResult>("/api/ai/brand-dna", {
        whoAmI: brand.whoAmI,
        field: brand.field,
        coreBeliefs: brand.coreBeliefs,
        differentiation: brand.differentiation,
        personalStory: brand.personalStory,
        expertise: brand.expertise,
        customerProfile: brand.customerProfile,
        customerPain: brand.customerPain,
        customerMisunderstanding: brand.customerMisunderstanding,
        marketEducationGoal: brand.marketEducationGoal,
        extractedFileText: extractedFileText || undefined,
      });

      const patch: Partial<BrandDnaInput> = {};
      const candidate = data.profilePatch ?? {};
      for (const [key, value] of Object.entries(candidate)) {
        const current = brand[key as keyof BrandDnaInput];
        if (isBlank(current) && !isBlank(value)) {
          (patch as Record<string, unknown>)[key] = value;
        }
      }
      if (isBlank(brand.aiPositioning) && data.positioning) {
        patch.aiPositioning = data.positioning;
      }
      if (isBlank(brand.threeWords) && data.threeWords?.length === 3) {
        patch.threeWords = [...data.threeWords];
      }
      if (isBlank(brand.differentiation) && data.differentiationSharpened) {
        patch.differentiation = data.differentiationSharpened;
      }
      if (isBlank(brand.marketEducationGoal) && data.suggestedEducationTopics?.length) {
        patch.marketEducationGoal = data.suggestedEducationTopics.join("\n");
      }

      patchBrand(patch);
      const count = Object.keys(patch).length;
      setNotice(
        count > 0
          ? `Agent đã phân tích nguồn và tự điền ${count} trường còn trống. Bạn có thể chỉnh sửa trực tiếp bên dưới.`
          : "Agent đã phân tích xong; không có trường trống nào cần tự điền.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không kết nối được Agent Control Plane. Kiểm tra OpenClaw/OAuth worker trong Cài đặt.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (analysisRequestId <= 0 || analysisRequestId === handledAnalysisRequest.current) return;
    handledAnalysisRequest.current = analysisRequestId;
    void analyze();
    // analysisRequestId is an explicit upload-trigger nonce; other Brand DNA edits must not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisRequestId]);

  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="text-sm">
          <p className="font-medium text-foreground">Phân tích Brand DNA bằng Agent</p>
          <p className="mt-1 text-muted-foreground">
            Upload file sẽ tự kích hoạt Agent phân tích và chỉ điền các ô đang trống. Bạn vẫn có thể sửa thủ công sau đó.
          </p>
          {notice && <p className="mt-2 text-emerald-700">{notice}</p>}
          {error && <div className="mt-2"><ErrorState message={error} onRetry={analyze} /></div>}
        </div>
        <Button type="button" variant="outline" onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? "Agent đang phân tích..." : "Phân tích AI"}
        </Button>
      </CardContent>
    </Card>
  );
}
