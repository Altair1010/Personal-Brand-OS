// EM1b cloud snapshot: encrypted, secret-stripped backup pushed to Supabase Storage so the
// user can restore on another machine. Reuses lib/import-export/backup.ts verbatim for the
// export/import/validate logic — this module only adds (1) secret stripping and (2) portable
// passphrase encryption.
//
// WHY passphrase, not lib/ai/keystore.ts: keystore uses a per-install secret at
// <userData>/.pbos-key, which does NOT exist on a new machine → the snapshot would be
// undecryptable there, defeating the whole feature. We derive the key from a user passphrase
// (scrypt) with a random salt embedded in the blob, so any machine with the passphrase can
// decrypt. The passphrase itself is NEVER uploaded.
//
// HARD RULE (RULES.md): secrets never enter the cloud snapshot. See STRIP_FIELDS.

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  exportBackup,
  importBackup,
  backupEnvelopeSchema,
  type BackupDb,
  type BackupEnvelope,
  type BackupModel,
} from "@/lib/import-export/backup";

export const CLOUD_BUCKET = "backups";
export const snapshotPath = (userId: string) => `${userId}/latest.enc`;

// Fields nulled out before a snapshot leaves the machine.
//   - AIModelConfig.apiKey  → SECRET (encrypted API key). Never leaves the local DB.
//   - AppState.supabaseUserId → account binding; stripped so a restore never clobbers the
//     new machine's own binding (set locally by bindAccount).
//   - FacebookAccount.accessToken → SECRET (encrypted Page token). Never leaves the local DB.
export const STRIP_FIELDS: Partial<Record<BackupModel, string[]>> = {
  AIModelConfig: ["apiKey"],
  AppState: ["supabaseUserId"],
  FacebookAccount: ["accessToken"],
};

/** Return a deep copy of the envelope with STRIP_FIELDS nulled on every row (rows kept). */
export function stripSecrets(envelope: BackupEnvelope): BackupEnvelope {
  const clone: BackupEnvelope = JSON.parse(JSON.stringify(envelope));
  for (const [model, fields] of Object.entries(STRIP_FIELDS)) {
    const rows = clone.data[model as BackupModel] ?? [];
    for (const row of rows) {
      for (const f of fields) {
        if (f in row) row[f] = null;
      }
    }
  }
  return clone;
}

// --- passphrase encryption (AES-256-GCM, scrypt-derived key) ---
const MAGIC = "PBOS1"; // 5 bytes, format sentinel
const SALT_LEN = 16;
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, KEY_LEN);
}

/** Encrypt UTF-8 json → blob: MAGIC | salt | iv | tag | ciphertext. */
export function encryptSnapshot(json: string, passphrase: string): Buffer {
  if (!passphrase) throw new Error("Thiếu passphrase.");
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(MAGIC, "utf8"), salt, iv, tag, ct]);
}

/** Decrypt a blob produced by encryptSnapshot. Wrong passphrase → GCM auth fail → throw. */
export function decryptSnapshot(blob: Buffer, passphrase: string): string {
  if (!passphrase) throw new Error("Thiếu passphrase.");
  const magicLen = MAGIC.length;
  if (blob.length < magicLen + SALT_LEN + IV_LEN + TAG_LEN + 1) {
    throw new Error("File khôi phục hỏng hoặc quá ngắn.");
  }
  if (blob.subarray(0, magicLen).toString("utf8") !== MAGIC) {
    throw new Error("File khôi phục không đúng định dạng.");
  }
  let o = magicLen;
  const salt = blob.subarray(o, (o += SALT_LEN));
  const iv = blob.subarray(o, (o += IV_LEN));
  const tag = blob.subarray(o, (o += TAG_LEN));
  const ct = blob.subarray(o);
  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Sai passphrase hoặc dữ liệu bị thay đổi.");
  }
}

/**
 * Export → strip secrets → encrypt → upload to Storage (upsert, one snapshot per user).
 * Updates AppState.lastCloudSyncAt. Requires a Supabase client already scoped to the user.
 */
export async function pushSnapshot(
  db: BackupDb,
  supabase: SupabaseClient,
  userId: string,
  passphrase: string,
): Promise<void> {
  const envelope = await exportBackup(db);
  const stripped = stripSecrets(envelope);
  const blob = encryptSnapshot(JSON.stringify(stripped), passphrase);
  const { error } = await supabase.storage
    .from(CLOUD_BUCKET)
    .upload(snapshotPath(userId), blob, {
      upsert: true,
      contentType: "application/octet-stream",
    });
  if (error) throw new Error(`Tải snapshot lên cloud thất bại: ${error.message}`);
  await db.appState.update({
    where: { id: "singleton" },
    data: { lastCloudSyncAt: new Date() },
  });
}

/**
 * Download → decrypt → validate structure → import (upsert). Rejects a corrupt/invalid file
 * BEFORE touching the DB (backupEnvelopeSchema). Secrets are absent → user re-enters them.
 */
export async function pullSnapshot(
  db: BackupDb,
  supabase: SupabaseClient,
  userId: string,
  passphrase: string,
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(CLOUD_BUCKET)
    .download(snapshotPath(userId));
  if (error || !data) {
    throw new Error(
      `Không tải được snapshot từ cloud: ${error?.message ?? "không tìm thấy"}.`,
    );
  }
  const buf = Buffer.from(await data.arrayBuffer());
  const json = decryptSnapshot(buf, passphrase);
  const parsed = backupEnvelopeSchema.safeParse(JSON.parse(json));
  if (!parsed.success) {
    throw new Error("File khôi phục không hợp lệ (cấu trúc sai).");
  }
  await importBackup(db, parsed.data);
}
