"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Field = {
  key: string;
  label: string;
  group: string;
  isSecret: boolean;
  configured: boolean;
  value: string;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
  updatedAt: string | null;
};

type Payload = {
  fields: Field[];
  pinConfigured: boolean;
};

const groups = [
  "Meta App",
  "Business Manager",
  "Fanpage",
  "Ads Account",
  "Tracking & Conversion",
  "Instagram",
  "Messenger & Webhook",
  "Ads Safety",
  "Reporting",
];

function pageNumber(key: string): string | null {
  return key.match(/^META_PAGE_(\d{2})_(?:NAME|ID|ACCESS_TOKEN)$/)?.[1] ?? null;
}

function fieldInput(
  field: Field,
  value: string,
  revealed: boolean,
  onChange: (value: string) => void,
) {
  return (
    <div key={field.key} className="space-y-1.5">
      <Label htmlFor={field.key} className="text-xs font-medium">
        {field.label}
      </Label>
      <div className="relative">
        <Input
          id={field.key}
          className="font-mono text-xs"
          value={value}
          placeholder={field.placeholder ?? field.key}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.isSecret && (
          <span className="pointer-events-none absolute right-2 top-2.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {revealed ? "đã mở" : "đã mã hóa"}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 text-[10px] text-muted-foreground">
        <code>{field.key}</code>
        <span className="text-right">{field.description ?? "Không bắt buộc"}</span>
      </div>
    </div>
  );
}

export function EnvVaultPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<string>("primary");

  const load = useCallback(async (revealToken?: string) => {
    const response = await fetch("/api/settings/env", {
      cache: "no-store",
      headers: revealToken ? { "x-env-reveal-token": revealToken } : {},
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error);
    setData(payload.data);
    setValues(Object.fromEntries(payload.data.fields.map((field: Field) => [field.key, field.value])));
  }, []);

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : "ENV_LOAD_FAILED"));
  }, [load]);

  const byGroup = useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [group, data?.fields.filter((field) => field.group === group) ?? []]),
      ),
    [data],
  );

  const numberedPages = useMemo(() => {
    const numbers = new Set<string>();
    for (const field of byGroup.Fanpage ?? []) {
      const number = pageNumber(field.key);
      if (number) numbers.add(number);
    }
    return Array.from(numbers).sort();
  }, [byGroup]);

  const selectedPageFields = useMemo(() => {
    const fields = byGroup.Fanpage ?? [];
    if (activePage === "primary") {
      return fields.filter((field) =>
        ["META_PAGE_NAME", "META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"].includes(field.key),
      );
    }
    return fields.filter((field) => field.key.startsWith(`META_PAGE_${activePage}_`));
  }, [activePage, byGroup]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/env", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error);
      setNotice("Đã lưu cấu hình .ENV.");
      await load();
      setToken(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SAVE_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function pinAction(action: "set-pin" | "verify-pin") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, pin }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error);
      setPin("");
      if (action === "verify-pin") {
        setToken(payload.data.token);
        await load(payload.data.token);
        setNotice("Secret đã được mở khóa trong 5 phút.");
      } else {
        setNotice("Đã thiết lập PIN riêng cho .ENV.");
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PIN_FAILED");
    } finally {
      setBusy(false);
    }
  }

  function addPageDraft() {
    if (!data) return;
    const next = String(Math.max(0, ...numberedPages.map(Number)) + 1).padStart(2, "0");
    const newFields: Field[] = [
      {
        key: `META_PAGE_${next}_NAME`,
        label: "Tên Fanpage",
        group: "Fanpage",
        isSecret: false,
        configured: false,
        value: "",
        updatedAt: null,
      },
      {
        key: `META_PAGE_${next}_ID`,
        label: "Page ID",
        group: "Fanpage",
        isSecret: false,
        configured: false,
        value: "",
        updatedAt: null,
      },
      {
        key: `META_PAGE_${next}_ACCESS_TOKEN`,
        label: "Page Access Token",
        group: "Fanpage",
        isSecret: true,
        configured: false,
        value: "",
        updatedAt: null,
      },
    ];
    setData({ ...data, fields: [...data.fields, ...newFields] });
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(newFields.map((field) => [field.key, ""])),
    }));
    setActivePage(next);
  }

  function deletePageDraft(number: string) {
    if (!data) return;
    const prefix = `META_PAGE_${number}_`;
    const keys = data.fields.filter((field) => field.key.startsWith(prefix)).map((field) => field.key);
    setData({ ...data, fields: data.fields.filter((field) => !keys.includes(field.key)) });
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, ""])),
    }));
    setActivePage("primary");
  }

  function addAdAccount() {
    if (!data) return;
    const regex = /^META_AD_ACCOUNT_(\d{2})_NAME$/;
    const numbers = data.fields
      .map((field) => field.key.match(regex)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);
    const next = String(Math.max(0, ...numbers) + 1).padStart(2, "0");
    const newFields: Field[] = [
      {
        key: `META_AD_ACCOUNT_${next}_NAME`,
        label: `Ad Account ${next} Name`,
        group: "Ads Account",
        isSecret: false,
        configured: false,
        value: "",
        updatedAt: null,
      },
      {
        key: `META_AD_ACCOUNT_${next}_ID`,
        label: `Ad Account ${next} ID`,
        group: "Ads Account",
        isSecret: false,
        configured: false,
        value: "",
        updatedAt: null,
      },
    ];
    setData({ ...data, fields: [...data.fields, ...newFields] });
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(newFields.map((field) => [field.key, ""])),
    }));
  }

  function deleteDynamic(prefix: string) {
    if (!data) return;
    const keys = data.fields.filter((field) => field.key.startsWith(prefix)).map((field) => field.key);
    setData({ ...data, fields: data.fields.filter((field) => !keys.includes(field.key)) });
    setValues((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, ""])),
    }));
  }

  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="size-5" />
              <h2 className="text-base font-semibold">.ENV Vault</h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Cấu hình Meta, Fanpage và Ads Agent theo Brand. Tất cả trường đều không bắt buộc.
              Secret được mã hóa và che mặc định.
            </p>
          </div>
          <Button onClick={save} disabled={busy}>
            <Save className="size-4" />
            Lưu cấu hình
          </Button>
        </div>

        {notice && <div className="rounded-md border px-3 py-2 text-sm">{notice}</div>}
        {error && (
          <div className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <h3 className="text-sm font-semibold">Secret Reveal PIN</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.pinConfigured
              ? "PIN đã được thiết lập. Xác minh lại để xem secret trong 5 phút."
              : "Tạo PIN 6–12 chữ số dành riêng cho .ENV. PIN chỉ lưu dưới dạng salt + hash."}
          </p>
          <div className="mt-3 flex max-w-md gap-2">
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="6–12 chữ số"
            />
            <Button
              variant="outline"
              disabled={busy || pin.length < 6}
              onClick={() => pinAction(data?.pinConfigured ? "verify-pin" : "set-pin")}
            >
              {token ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {data?.pinConfigured ? "Xác minh & hiện" : "Tạo PIN"}
            </Button>
          </div>
        </section>

        {groups.map((group) => {
          if (group === "Fanpage") {
            return (
              <section key={group} className="rounded-xl border p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Fanpage</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Mỗi Page là một bản cấu hình độc lập. Bấm “Thêm Page” để tạo bản trống mới.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={addPageDraft}>
                    <Plus className="size-4" />
                    Thêm Page
                  </Button>
                </div>

                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setActivePage("primary")}
                    className={[
                      "shrink-0 rounded-lg border px-3 py-2 text-xs font-medium",
                      activePage === "primary" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    ].join(" ")}
                  >
                    Page chính
                  </button>
                  {numberedPages.map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setActivePage(number)}
                      className={[
                        "shrink-0 rounded-lg border px-3 py-2 text-xs font-medium",
                        activePage === number ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                      ].join(" ")}
                    >
                      Page {number}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {activePage === "primary" ? "Page chính" : `Page ${activePage}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tên Page, Page ID và Page Access Token của riêng cấu hình này.
                      </div>
                    </div>
                    {activePage !== "primary" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deletePageDraft(activePage)}
                      >
                        <Trash2 className="size-4" />
                        Xóa
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {selectedPageFields.map((field) =>
                      fieldInput(
                        field,
                        values[field.key] ?? field.value ?? "",
                        Boolean(token),
                        (value) => setValues((current) => ({ ...current, [field.key]: value })),
                      ),
                    )}
                  </div>
                </div>
              </section>
            );
          }

          const fields = byGroup[group] ?? [];
          return (
            <section key={group} className="rounded-xl border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{group}</h3>
                {group === "Ads Account" && (
                  <Button size="sm" variant="outline" onClick={addAdAccount}>
                    <Plus className="size-4" />
                    Thêm Ad Account
                  </Button>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className="relative">
                    {/^META_AD_ACCOUNT_\d{2}_NAME$/.test(field.key) && (
                      <button
                        type="button"
                        className="absolute right-0 top-0 z-10 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteDynamic(field.key.replace(/_NAME$/, "_"))}
                        aria-label="Xóa Ad Account"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    {fieldInput(
                      field,
                      values[field.key] ?? field.value ?? "",
                      Boolean(token),
                      (value) => setValues((current) => ({ ...current, [field.key]: value })),
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="rounded-xl border border-amber-500/30 p-4 text-xs text-muted-foreground">
          <strong className="text-foreground">An toàn Ads Agent:</strong> lưu credential không cấp quyền
          tự động cho agent. Publish, tăng ngân sách, tạm dừng hoặc xóa chiến dịch vẫn phải đi qua
          approval/governance policy.
        </section>
      </CardContent>
    </Card>
  );
}
