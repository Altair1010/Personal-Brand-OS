"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { PersonaDraft } from "./types";

// Editable card for one persona — the 9 acceptance fields. Pure controlled inputs;
// all state lives in the parent board.

const FIELDS: {
  key: keyof Omit<PersonaDraft, "_key" | "id" | "source">;
  label: string;
  textarea?: boolean;
}[] = [
  { key: "name", label: "Tên persona" },
  { key: "pain", label: "Nỗi đau (pain)", textarea: true },
  { key: "falseBelief", label: "Niềm tin sai (falseBelief)", textarea: true },
  { key: "fear", label: "Nỗi sợ (fear)", textarea: true },
  { key: "desire", label: "Khát khao (desire)", textarea: true },
  { key: "language", label: "Ngôn ngữ (language)" },
  { key: "contentAngle", label: "Góc nội dung (contentAngle)", textarea: true },
  { key: "cta", label: "CTA" },
  { key: "offer", label: "Offer" },
];

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
        {FIELDS.map(({ key, label, textarea }) => (
          <div key={key} className={textarea ? "sm:col-span-2" : ""}>
            <Label htmlFor={`${persona._key}-${key}`} className="mb-1 block">
              {label}
            </Label>
            {textarea ? (
              <Textarea
                id={`${persona._key}-${key}`}
                value={persona[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                className="min-h-[60px]"
              />
            ) : (
              <Input
                id={`${persona._key}-${key}`}
                value={persona[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
