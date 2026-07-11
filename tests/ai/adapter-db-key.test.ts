// EM1a Slice 1 (T6) — proves the AI adapter runs on a DB-STORED key alone, env unset.
//
// Flow: point the keystore at a throwaway temp dir (so .pbos-key never lands in the repo),
// encrypt a fake key with the REAL keystore, mock `@/lib/db` to return an AIModelConfig row
// holding that encrypted key, then assert (1) resolveModelConfig() decrypts it back and
// (2) the built adapter sends it in the provider auth header — with ANTHROPIC_API_KEY /
// OPENAI_API_KEY explicitly deleted from process.env.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// --- isolate the keystore to a temp dir via DATABASE_URL (keyDir derives from it) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pbos-key-test-"));
const prevDbUrl = process.env.DATABASE_URL;
const prevAnthropic = process.env.ANTHROPIC_API_KEY;
const prevOpenai = process.env.OPENAI_API_KEY;

// Row store the db mock reads from — mutated per test.
let dbRow: {
  provider: string;
  model: string;
  apiKey: string | null;
  isDefault: boolean;
} | null = null;

vi.mock("@/lib/db", () => ({
  db: {
    aIModelConfig: {
      findFirst: vi.fn(async (args?: { where?: { isDefault?: boolean } }) => {
        // isDefault query first, then bare findFirst — both return the single row here.
        if (args?.where?.isDefault) return dbRow?.isDefault ? dbRow : null;
        return dbRow;
      }),
    },
  },
}));

beforeAll(() => {
  process.env.DATABASE_URL = `file:${path.join(tmpDir, "pbos.db")}`;
});

afterAll(() => {
  if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDbUrl;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // The scenario under test: NO env keys anywhere.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = prevAnthropic;
  if (prevOpenai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prevOpenai;
});

describe("adapter runs on DB-stored key with env unset", () => {
  it("(anthropic) resolveModelConfig decrypts the DB key and adapter sends x-api-key", async () => {
    const { encryptString } = await import("@/lib/ai/keystore");
    const { resolveModelConfig, getAdapter } = await import("@/lib/ai/adapter");

    const fakeKey = "sk-ant-db-only-FAKEKEY-123";
    dbRow = {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKey: encryptString(fakeKey),
      isDefault: true,
    };

    const cfg = await resolveModelConfig();
    expect(cfg.provider).toBe("anthropic");
    expect(cfg.model).toBe("claude-haiku-4-5");
    expect(cfg.apiKey).toBe(fakeKey); // decrypted round-trip

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        content: [{ text: "{}" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = getAdapter(cfg);
    await adapter.call({ system: "s", user: "u", temperature: 0.2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(fakeKey);
    // Env was unset, so only the DB key could have produced this.
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("(openai) adapter sends Authorization: Bearer with the DB key", async () => {
    const { encryptString } = await import("@/lib/ai/keystore");
    const { resolveModelConfig, getAdapter } = await import("@/lib/ai/adapter");

    const fakeKey = "sk-openai-db-only-FAKEKEY-456";
    dbRow = {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: encryptString(fakeKey),
      isDefault: true,
    };

    const cfg = await resolveModelConfig();
    expect(cfg.apiKey).toBe(fakeKey);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{}" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = getAdapter(cfg);
    await adapter.call({ system: "s", user: "u", temperature: 0.2 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${fakeKey}`);
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it("decryptString throws on a malformed blob (caller handles, no crash)", async () => {
    const { decryptString } = await import("@/lib/ai/keystore");
    expect(() => decryptString("not-a-valid-blob")).toThrow();
    expect(() => decryptString("v1:###")).toThrow();
  });
});
