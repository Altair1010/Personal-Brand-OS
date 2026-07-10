"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface StructuredEditorProps {
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
// KHÔNG rich text — chỉ plain text theo ràng buộc M7.
export function StructuredEditor({
  hook,
  body,
  ending,
  hashtags,
  imageSuggestion,
  disabled,
  onChange,
}: StructuredEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ed-hook">Hook</Label>
        <Textarea
          id="ed-hook"
          value={hook}
          disabled={disabled}
          placeholder="Câu mở đầu kéo người đọc dừng lại…"
          className="min-h-[60px]"
          onChange={(e) => onChange({ hook: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ed-body">Nội dung</Label>
        <Textarea
          id="ed-body"
          value={body}
          disabled={disabled}
          placeholder="Thân bài — plain text, không markdown…"
          className="min-h-[180px]"
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ed-ending">Kết bài & CTA</Label>
        <Textarea
          id="ed-ending"
          value={ending}
          disabled={disabled}
          placeholder="Lời kết và lời kêu gọi hành động…"
          className="min-h-[80px]"
          onChange={(e) => onChange({ ending: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ed-hashtags">Hashtag (phân tách bằng dấu phẩy)</Label>
          <Input
            id="ed-hashtags"
            value={hashtags}
            disabled={disabled}
            placeholder="xauusd, trading, giaodichvang"
            onChange={(e) => onChange({ hashtags: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-image">Gợi ý hình ảnh</Label>
          <Input
            id="ed-image"
            value={imageSuggestion}
            disabled={disabled}
            placeholder="Mô tả ảnh minh hoạ…"
            onChange={(e) => onChange({ imageSuggestion: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
