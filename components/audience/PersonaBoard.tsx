"use client";

import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { PersonaEditor } from "./PersonaEditor";
import { emptyPersona } from "./helpers";
import type { PersonaDraft } from "./types";

// Persona editor list (2–4 recommended). Holds no AI logic — the parent board drives
// generation; this only edits/adds/removes the persona drafts.

const MAX = 4;

interface PersonaBoardProps {
  personas: PersonaDraft[];
  onChange: (personas: PersonaDraft[]) => void;
}

export function PersonaBoard({ personas, onChange }: PersonaBoardProps) {
  function patchAt(idx: number, patch: Partial<PersonaDraft>) {
    onChange(personas.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addPersona() {
    if (personas.length >= MAX) return;
    onChange([...personas, emptyPersona()]);
  }
  function removeAt(idx: number) {
    if (personas.length <= 1) return;
    onChange(personas.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {personas.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Chưa có persona"
          description="Bấm “Sinh personas (AI)” hoặc thêm thủ công (2–4 persona)."
        />
      ) : (
        <div className="space-y-3">
          {personas.map((p, idx) => (
            <PersonaEditor
              key={p._key}
              persona={p}
              index={idx}
              canDelete={personas.length > 1}
              onChange={(patch) => patchAt(idx, patch)}
              onDelete={() => removeAt(idx)}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={personas.length >= MAX}
          onClick={addPersona}
        >
          <Plus className="size-4" />
          Thêm persona
        </Button>
        <span>
          {personas.length}/{MAX} persona (khuyến nghị 2–{MAX})
        </span>
      </div>
    </div>
  );
}
