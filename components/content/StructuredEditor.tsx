"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface StructuredEditorProps {
  format?: string | null;
  hook: string;
  body: string;
  ending: string;
  hashtags: string; // comma-separated free text in the input
  imageSuggestion: string;
  disabled?: boolean;
  onChange: (patch: {
    hook?: string;
    body?: string;
    ending?: string;
    hashtags?: string;
    imageSuggestion?: string;
  }) => void;
}

// Plain-text FB editor: three textareas (Hook / Body / Ending) + hashtags + image note.
// KHÃ”NG rich text â€” chá»‰ plain text theo rÃ ng buá»™c M7.
export function StructuredEditor({
  format,
  hook,
  body,
  ending,
  hashtags,
  imageSuggestion,
  disabled,
  onChange,
}: StructuredEditorProps) {
  const bodyLabel = format === "carousel" ? "Ná»™i dung tá»«ng slide / áº£nh" : format === "video" || format === "reel" ? "Ká»‹ch báº£n theo cáº£nh & lá»i thoáº¡i / voice-over" : "Ná»™i dung";
  const imageLabel = format === "carousel" ? "Gá»£i Ã½ visual / CTA tá»«ng slide" : format === "video" || format === "reel" ? "Gá»£i Ã½ cáº£nh quay / hÃ¬nh minh há»a" : format === "image" ? "Text trÃªn áº£nh & gá»£i Ã½ hÃ¬nh áº£nh" : "Gá»£i Ã½ hÃ¬nh áº£nh";
  const bodyPlaceholder = format === "carousel" ? "Slide 1: tiÃªu Ä‘á»â€¦\nSlide 2: ná»™i dungâ€¦\nSlide cuá»‘i: CTAâ€¦" : format === "video" || format === "reel" ? "Cáº£nh 1: hook + hÃ¬nh áº£nhâ€¦\nCáº£nh 2: voice-overâ€¦\nCáº£nh cuá»‘i: CTAâ€¦" : "ThÃ¢n bÃ i â€” plain text, khÃ´ng markdownâ€¦";

  return (
    <div className="space-y-5 px-1 py-1">
      <div className="space-y-2 rounded-xl px-1.5 py-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="ed-hook">Hook</Label>
          <span className="text-xs text-muted-foreground">{hook.length} kÃ½ tá»±</span>
        </div>
        <Textarea
          id="ed-hook"
          value={hook}
          disabled={disabled}
          placeholder="CÃ¢u má»Ÿ Ä‘áº§u kÃ©o ngÆ°á»i Ä‘á»c dá»«ng láº¡iâ€¦"
          className="min-h-[60px]"
          onChange={(e) => onChange({ hook: e.target.value })}
        />
      </div>
      <div className="space-y-2 rounded-xl px-1.5 py-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="ed-body">{bodyLabel}</Label>
          <span className="text-xs text-muted-foreground">{body.length} kÃ½ tá»±</span>
        </div>
        <Textarea
          id="ed-body"
          value={body}
          disabled={disabled}
          placeholder={bodyPlaceholder}
          className="min-h-[180px]"
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </div>
      <div className="space-y-2 rounded-xl px-1.5 py-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="ed-ending">Káº¿t bÃ i & CTA</Label>
          <span className="text-xs text-muted-foreground">{ending.length} kÃ½ tá»±</span>
        </div>
        <Textarea
          id="ed-ending"
          value={ending}
          disabled={disabled}
          placeholder="Lá»i káº¿t vÃ  lá»i kÃªu gá»i hÃ nh Ä‘á»™ngâ€¦"
          className="min-h-[80px]"
          onChange={(e) => onChange({ ending: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl px-1.5 py-1">
          <Label htmlFor="ed-hashtags">Hashtag (phÃ¢n tÃ¡ch báº±ng dáº¥u pháº©y)</Label>
          <Input
            id="ed-hashtags"
            value={hashtags}
            disabled={disabled}
            placeholder="xauusd, trading, giaodichvang"
            onChange={(e) => onChange({ hashtags: e.target.value })}
          />
        </div>
        <div className="space-y-2 rounded-xl px-1.5 py-1">
          <Label htmlFor="ed-image">{imageLabel}</Label>
          <Input
            id="ed-image"
            value={imageSuggestion}
            disabled={disabled}
            placeholder="MÃ´ táº£ áº£nh minh hoáº¡â€¦"
            onChange={(e) => onChange({ imageSuggestion: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
