// Server-only API-key encryption at rest. NEVER stores plaintext; NEVER importable client-side.
//
// DECISION (user 2026-07-11): Electron `safeStorage` is NOT reachable from the Next server
// child process, so the primary path is Node `crypto` AES-256-GCM with a per-install secret.
// The secret lives at <userData>/.pbos-key (0o600), created on first use via randomBytes(32).
// We resolve <userData> the same way the app resolves the SQLite file — from DATABASE_URL's
// directory (electron/runtime.js sets DATABASE_URL=file:<userData>/pbos.db in prod) — with a
// repo-local fallback (prisma/.pbos-key) in dev/tests. safeStorage is tried only when genuinely
// available; otherwise crypto. Decrypt of a malformed blob or missing key throws (caller handles).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const VERSION = "v1";
const KEY_FILE = ".pbos-key";
const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard
const TAG_LEN = 16;

// Directory that holds the per-install secret. Co-located with the SQLite DB so it follows
// the same relocation logic (dev.db in repo, pbos.db in userData). Falls back to prisma/.
function keyDir(): string {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("file:")) {
    const dbPath = url.slice("file:".length);
    const dir = path.dirname(dbPath);
    if (dir && dir !== ".") return path.resolve(dir);
  }
  return path.resolve(process.cwd(), "prisma");
}

function keyPath(): string {
  return path.join(keyDir(), KEY_FILE);
}

// Read the per-install 32-byte secret, creating it on first use. Restrictive mode 0o600.
function loadOrCreateSecret(): Buffer {
  const file = keyPath();
  try {
    const buf = fs.readFileSync(file);
    if (buf.length === 32) return buf;
    // A truncated/corrupt key file is unrecoverable — surface loudly, don't silently rotate.
    throw new Error(
      `Khóa mã hóa API key hỏng (${file}): độ dài không hợp lệ. Xóa file để tạo lại (mọi key đã lưu sẽ cần nhập lại).`,
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const dir = keyDir();
  fs.mkdirSync(dir, { recursive: true });
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(file, secret, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600); // ensure mode even if umask altered create
  } catch {
    // Best-effort on platforms/filesystems that ignore chmod (e.g. Windows).
  }
  return secret;
}

// Electron safeStorage — only if genuinely reachable AND initialized. In the Next server
// child it is not, so this returns null and we use crypto.
function trySafeStorage(): {
  encrypt: (s: string) => Buffer;
  decrypt: (b: Buffer) => string;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron");
    const safeStorage = electron?.safeStorage;
    if (safeStorage && typeof safeStorage.isEncryptionAvailable === "function") {
      if (safeStorage.isEncryptionAvailable()) {
        return {
          encrypt: (s: string) => safeStorage.encryptString(s),
          decrypt: (b: Buffer) => safeStorage.decryptString(b),
        };
      }
    }
  } catch {
    // Not in an Electron main process with safeStorage — fall through to crypto.
  }
  return null;
}

// encrypt: "v1:" + base64(iv | tag | ciphertext) for crypto, or "ss1:" + base64 for safeStorage.
export function encryptString(plain: string): string {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("encryptString: chuỗi rỗng.");
  }

  const ss = trySafeStorage();
  if (ss) {
    return `ss1:${ss.encrypt(plain).toString("base64")}`;
  }

  const secret = loadOrCreateSecret();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, secret, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ciphertext]);
  return `${VERSION}:${packed.toString("base64")}`;
}

export function decryptString(cipher: string): string {
  if (typeof cipher !== "string" || cipher.length === 0) {
    throw new Error("decryptString: chuỗi rỗng.");
  }

  if (cipher.startsWith("ss1:")) {
    const ss = trySafeStorage();
    if (!ss) {
      throw new Error(
        "Không giải mã được API key: blob dùng safeStorage nhưng safeStorage không khả dụng ở tiến trình này.",
      );
    }
    return ss.decrypt(Buffer.from(cipher.slice(4), "base64"));
  }

  if (!cipher.startsWith(`${VERSION}:`)) {
    throw new Error(`Không giải mã được API key: định dạng không nhận dạng được.`);
  }

  const packed = Buffer.from(cipher.slice(VERSION.length + 1), "base64");
  if (packed.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Không giải mã được API key: dữ liệu quá ngắn/hỏng.");
  }
  const iv = packed.subarray(0, IV_LEN);
  const tag = packed.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = packed.subarray(IV_LEN + TAG_LEN);

  const secret = loadOrCreateSecret();
  const decipher = crypto.createDecipheriv(ALGO, secret, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong secret (key rotated) or tampered blob → auth tag mismatch.
    throw new Error(
      "Không giải mã được API key: khóa mã hóa không khớp hoặc dữ liệu bị thay đổi.",
    );
  }
}
