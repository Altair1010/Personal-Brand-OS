"use client";

import { Card, CardContent } from "@/components/ui/card";

interface PostPreviewProps {
  brandName: string;
  hook: string;
  body: string;
  ending: string;
  hashtags: string; // comma-separated free text
  imageSuggestion?: string;
}

// Read-only FB-style preview of the composed post (hook + body + ending + hashtags).
// Mirrors how the plain-text sections read once stitched together — no editing here.
export function PostPreview({
  brandName,
  hook,
  body,
  ending,
  hashtags,
  imageSuggestion,
}: PostPreviewProps) {
  const sections = [hook, body, ending].filter((s) => s.trim().length > 0);
  const composed = sections.join("\n\n");
  const tags = hashtags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
  const totalChars = composed.length;
  const initial = (brandName.trim()[0] ?? "P").toUpperCase();

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {brandName || "Trang của bạn"}
            </div>
            <div className="text-xs text-muted-foreground">
              Bản xem trước · Facebook
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-4">
          {composed.trim().length > 0 ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              {composed}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Nội dung sẽ hiển thị ở đây khi bạn nhập Hook / Nội dung / Kết bài.
            </p>
          )}
          {tags.length > 0 && (
            <p className="mt-2 text-sm text-blue-600">{tags.join(" ")}</p>
          )}
        </div>

        {/* Image suggestion placeholder */}
        {imageSuggestion && imageSuggestion.trim().length > 0 && (
          <div className="mx-4 flex items-center gap-2 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            <span>🖼</span>
            <span className="truncate">Ảnh gợi ý: {imageSuggestion}</span>
          </div>
        )}

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {totalChars} ký tự{tags.length > 0 ? ` · ${tags.length} hashtag` : ""}
        </div>
      </CardContent>
    </Card>
  );
}
