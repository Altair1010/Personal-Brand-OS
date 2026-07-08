"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder — the AI adapter arrives in M4. The button is intentionally disabled here so
// the wizard flow is visible without any AI call (CLAUDE.md: no AI import until M4).

export function AiSuggestionPanel() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Phân tích AI</p>
          <p>Gợi ý định vị + 3 từ khoá thương hiệu (mở khoá ở M4).</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled>
          <Sparkles className="size-4" />
          Phân tích AI
        </Button>
      </CardContent>
    </Card>
  );
}
