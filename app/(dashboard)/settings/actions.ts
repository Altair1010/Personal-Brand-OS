"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveModelConfig } from "@/lib/ai/adapter";
import { encryptString } from "@/lib/ai/keystore";
import { wipeAll } from "@/lib/import-export/backup";
import { seedCore } from "@/prisma/seedCore";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ============================================================
// DTOs (serializable — Date → ISO string)
// ============================================================

export type AiModelConfigDTO = {
  id: string;
  provider: string;
  model: string;
  label: string | null;
  temperature: number | null;
  maxTokens: number | null;
  isDefault: boolean;
  // NEVER expose the encrypted/raw key to the client — only whether one is stored.
  hasKey: boolean;
  createdAt: string;
};

export type SettingsData = {
  configs: AiModelConfigDTO[];
  active: { provider: string; model: string } | null;
};

// ============================================================
// Reads
// ============================================================

export async function getSettingsData(): Promise<SettingsData> {
  const rows = await db.aIModelConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  // resolveModelConfig throws when no model is set → treat as "no active model".
  let active: { provider: string; model: string } | null = null;
  try {
    active = await resolveModelConfig();
  } catch {
    active = null;
  }

  return {
    configs: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      label: r.label,
      temperature: r.temperature,
      maxTokens: r.maxTokens,
      isDefault: r.isDefault,
      hasKey: !!r.apiKey,
      createdAt: r.createdAt.toISOString(),
    })),
    active,
  };
}

// ============================================================
// Mutations
// ============================================================

const saveModelConfigSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  // Accept a preset model id OR any non-empty custom string (RULES #3: presets are DATA,
  // not a hard whitelist — a custom model must still be allowed).
  model: z.string().min(1),
  label: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  apiKey: z.string().min(1).optional(),
});

export type SaveModelConfigInput = z.input<typeof saveModelConfigSchema>;

export async function saveModelConfig(
  input: SaveModelConfigInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveModelConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Cấu hình model không hợp lệ." };
  }
  const v = parsed.data;
  const isDefault = v.isDefault ?? true;

  // Encrypt the key BEFORE any DB write — plaintext never reaches the database.
  let encryptedKey: string | null = null;
  if (v.apiKey) {
    try {
      encryptedKey = encryptString(v.apiKey);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Mã hóa API key thất bại.",
      };
    }
  }

  try {
    const created = await db.$transaction(async (tx) => {
      if (isDefault) {
        await tx.aIModelConfig.updateMany({
          data: { isDefault: false },
        });
      }
      return tx.aIModelConfig.create({
        data: {
          provider: v.provider,
          model: v.model,
          label: v.label ?? null,
          temperature: v.temperature ?? null,
          maxTokens: v.maxTokens ?? null,
          isDefault,
          apiKey: encryptedKey,
        },
        select: { id: true },
      });
    });
    revalidatePath("/settings");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lưu cấu hình thất bại.",
    };
  }
}

export async function deleteModelConfig(id: string): Promise<ActionResult> {
  try {
    await db.aIModelConfig.delete({ where: { id } });
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Xóa cấu hình thất bại.",
    };
  }
}

export async function resetDatabase(
  confirmText: string,
): Promise<ActionResult> {
  // Server RE-CHECKS the confirmation phrase — never trust the client alone.
  if (confirmText !== "RESET") {
    return { ok: false, error: "Xác nhận không đúng. Nhập chính xác RESET." };
  }

  try {
    await db.$transaction(async (tx) => {
      await wipeAll(tx);
      await seedCore(tx, "khang-guru");
    });
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Reset dữ liệu thất bại.",
    };
  }
}
