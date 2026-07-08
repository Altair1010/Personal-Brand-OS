"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiLoading } from "@/components/AiLoading";
import { ErrorState } from "@/components/ErrorState";
import { useOnboardingStore } from "@/lib/stores/onboarding";

// D.1 Brand DNA Analyzer UI. Client component that ONLY fetches the server route — it never
// imports lib/ai/* so the API key stays server-side. On success it renders positioning +
// threeWords + suggested topics; "Áp dụng" writes only threeWords back into the wizard.

interface BrandDnaResult {
  positioning: string;
  threeWords: [string, string, string];
  suggestedEducationTopics: string[];
}

export function AiSuggestionPanel() {
  const brand = useOnboardingStore((s) => s.brand);
  const patchBrand = useOnboardingStore((s) => s.patchBrand);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandDnaResult | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/brand-dna", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Phân tích thất bại. Vui lòng thử lại.");
        return;
      }
      setResult(json.data as BrandDnaResult);
    } catch {
      setError("Không kết nối được tới máy chủ AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Phân tích AI</p>
            <p>Gợi ý định vị + 3 từ khoá thương hiệu từ thông tin đã nhập.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={analyze}
            disabled={loading}
          >
            <Sparkles className="size-4" />
            Phân tích AI
          </Button>
        </div>

        {loading && <AiLoading status="AI đang phân tích thương hiệu..." />}

        {error && !loading && (
          <ErrorState message={error} onRetry={analyze} />
        )}

        {result && !loading && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <div>
              <p className="font-medium text-foreground">Định vị</p>
              <p className="text-muted-foreground">{result.positioning}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">3 từ khoá</p>
              <p className="text-muted-foreground">
                {result.threeWords.join(" · ")}
              </p>
            </div>
            {result.suggestedEducationTopics.length > 0 && (
              <div>
                <p className="font-medium text-foreground">
                  Chủ đề giáo dục gợi ý
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {result.suggestedEducationTopics.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => patchBrand({ threeWords: [...result.threeWords] })}
            >
              Áp dụng 3 từ khoá
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
