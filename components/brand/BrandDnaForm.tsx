"use client";

import { useOnboardingStore } from "@/lib/stores/onboarding";
import { Label } from "@/components/ui/label";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { FileDropzone } from "./FileDropzone";
import { AiSuggestionPanel } from "./AiSuggestionPanel";
import { HELP_TEXT } from "@/lib/help-text";
import type { BrandDnaInput } from "@/lib/validators/brandDna";

// Step 1 — Brand DNA (11 core fields) + company context. Longform fields are textareas.
// Upload appends extracted text into "personalStory" and records the file name in sourceFiles.

type TextKey = Exclude<keyof BrandDnaInput, "threeWords" | "offers" | "sourceFiles">;

const CORE_FIELDS: { key: TextKey; label: string; long?: boolean }[] = [
  { key: "aiPositioning", label: "Định vị", long: true },
  { key: "whoAmI", label: "Tôi là ai" },
  { key: "field", label: "Lĩnh vực" },
  { key: "coreBeliefs", label: "Niềm tin cốt lõi", long: true },
  { key: "differentiation", label: "Điểm khác biệt", long: true },
  { key: "personalStory", label: "Câu chuyện cá nhân", long: true },
  { key: "expertise", label: "Chuyên môn", long: true },
  { key: "customerProfile", label: "Chân dung khách hàng", long: true },
  { key: "customerPain", label: "Nỗi đau khách hàng", long: true },
  { key: "customerMisunderstanding", label: "Hiểu lầm của khách hàng", long: true },
  { key: "marketEducationGoal", label: "Mục tiêu giáo dục thị trường", long: true },
];

const COMPANY_FIELDS: { key: TextKey; label: string; long?: boolean }[] = [
  { key: "companyName", label: "Tên doanh nghiệp" },
  { key: "usp", label: "USP", long: true },
  { key: "region", label: "Khu vực" },
];

export function BrandDnaForm() {
  const brand = useOnboardingStore((s) => s.brand);
  const patchBrand = useOnboardingStore((s) => s.patchBrand);
  const sourceDocuments = useOnboardingStore((s) => s.sourceDocuments);
  const addSourceDocument = useOnboardingStore((s) => s.addSourceDocument);
  const removeSourceDocument = useOnboardingStore((s) => s.removeSourceDocument);

  const threeWords = brand.threeWords ?? [];
  const offersText = (brand.offers ?? []).join("\n");

  return (
    <div className="space-y-6">
      <AiSuggestionPanel />

      <FileDropzone
        onExtracted={(text, fileName) => {
          addSourceDocument({ text, fileName });
        }}
      />
      {(brand.sourceFiles?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {(brand.sourceFiles ?? []).map((fileName) => (
            <span
              key={fileName}
              className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs"
            >
              <span>{fileName}</span>
              <button
                type="button"
                aria-label={`Gỡ ${fileName}`}
                title={sourceDocuments.some((doc) => doc.fileName === fileName)
                  ? "Gỡ file khỏi phiên phân tích"
                  : "Gỡ tên file đã lưu"}
                onClick={() => removeSourceDocument(fileName)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <LabelWithHelp help={HELP_TEXT.brandThreeWords}>
          3 từ khoá thương hiệu
        </LabelWithHelp>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Input
              key={i}
              value={threeWords[i] ?? ""}
              placeholder={`Từ ${i + 1}`}
              onChange={(e) => {
                const next = [...threeWords];
                next[i] = e.target.value;
                patchBrand({ threeWords: next.filter((w) => w.trim()) });
              }}
            />
          ))}
        </div>
      </div>

      {CORE_FIELDS.map(({ key, label, long }) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>{label}</Label>
          {long ? (
            <Textarea
              id={key}
              value={(brand[key] as string) ?? ""}
              onChange={(e) => patchBrand({ [key]: e.target.value })}
            />
          ) : (
            <Input
              id={key}
              value={(brand[key] as string) ?? ""}
              onChange={(e) => patchBrand({ [key]: e.target.value })}
            />
          )}
        </div>
      ))}

      <div className="border-t pt-4">
        <p className="mb-3 text-sm font-medium">Bối cảnh doanh nghiệp</p>
        <div className="space-y-4">
          {COMPANY_FIELDS.map(({ key, label, long }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label}</Label>
              {long ? (
                <Textarea
                  id={key}
                  value={(brand[key] as string) ?? ""}
                  onChange={(e) => patchBrand({ [key]: e.target.value })}
                />
              ) : (
                <Input
                  id={key}
                  value={(brand[key] as string) ?? ""}
                  onChange={(e) => patchBrand({ [key]: e.target.value })}
                />
              )}
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="offers">Sản phẩm/dịch vụ (mỗi dòng một mục)</Label>
            <Textarea
              id="offers"
              value={offersText}
              onChange={(e) =>
                patchBrand({
                  offers: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
