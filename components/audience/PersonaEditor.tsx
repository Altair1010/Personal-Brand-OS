"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LabelWithHelp } from "@/components/ui/field-help";
import { HELP_TEXT } from "@/lib/help-text";
import type { PersonaDraft } from "./types";

// Editable card for one persona — the 9 acceptance fields. Pure controlled inputs;
// all state lives in the parent board.

const FIELDS: {
  key: keyof Omit<PersonaDraft, "_key" | "id" | "source">;
  label: string;
  textarea?: boolean;
  placeholder?: string;
}[] = [
  {
    key: "name",
    label: "Tên persona",
    placeholder: "vd: Nhà đầu tư mới F0",
  },
  {
    key: "pain",
    label: "Nỗi đau (pain)",
    textarea: true,
    placeholder: "vd: Thua lỗ liên tục vì vào lệnh theo cảm tính, không có hệ thống.",
  },
  {
    key: "falseBelief",
    label: "Niềm tin sai (falseBelief)",
    textarea: true,
    placeholder: "vd: Tin rằng cứ có tín hiệu 'chuẩn' là sẽ thắng.",
  },
  {
    key: "fear",
    label: "Nỗi sợ (fear)",
    textarea: true,
    placeholder: "vd: Sợ cháy tài khoản, mất hết vốn tích cóp.",
  },
  {
    key: "desire",
    label: "Khát khao (desire)",
    textarea: true,
    placeholder: "vd: Có lãi đều đặn, tự tin quản trị rủi ro.",
  },
  {
    key: "language",
    label: "Ngôn ngữ (language)",
    placeholder: "vd: 'gồng lỗ', 'full margin', 'bắt đáy'",
  },
  {
    key: "contentAngle",
    label: "Góc nội dung (contentAngle)",
    textarea: true,
    placeholder: "vd: Case study lệnh thật + bài học quản trị vốn.",
  },
  { key: "cta", label: "CTA", placeholder: "vd: Inbox nhận checklist vào lệnh" },
  {
    key: "offer",
    label: "Offer",
    placeholder: "vd: Khoá học quản trị vốn 7 ngày",
  },
];

// Per-field help text — full coverage (EM2b): every field shows a help icon.
const FIELD_HELP: Record<(typeof FIELDS)[number]["key"], string> = {
  name: HELP_TEXT.personaName,
  pain: HELP_TEXT.personaPain,
  falseBelief: HELP_TEXT.personaFalseBelief,
  fear: HELP_TEXT.personaFear,
  desire: HELP_TEXT.personaDesire,
  language: HELP_TEXT.personaLanguage,
  contentAngle: HELP_TEXT.personaContentAngle,
  cta: HELP_TEXT.personaCta,
  offer: HELP_TEXT.personaOffer,
};

interface PersonaEditorProps {
  persona: PersonaDraft;
  index: number;
  canDelete: boolean;
  onChange: (patch: Partial<PersonaDraft>) => void;
  onDelete: () => void;
}

export function PersonaEditor({
  persona,
  index,
  canDelete,
  onChange,
  onDelete,
}: PersonaEditorProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Persona #{index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Xoá
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label, textarea, placeholder }) => (
          <div key={key} className={textarea ? "sm:col-span-2" : ""}>
            <LabelWithHelp
              htmlFor={`${persona._key}-${key}`}
              help={FIELD_HELP[key]}
              className="mb-1"
            >
              {label}
            </LabelWithHelp>
            {textarea ? (
              <Textarea
                id={`${persona._key}-${key}`}
                value={persona[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder={placeholder}
                className="min-h-[60px]"
              />
            ) : (
              <Input
                id={`${persona._key}-${key}`}
                value={persona[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder={placeholder}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
