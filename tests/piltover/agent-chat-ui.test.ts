import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canSendAgentMessage, extractAgentReply, visibleSlice } from "../../lib/piltover/agent-chat/ui-contract";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Agent chat UI contract", () => {
  it("unwraps structured reply JSON instead of rendering raw JSON", () => {
    const raw = JSON.stringify({ version: "AgentSidebarReply/v1", reply: "Phản hồi tự nhiên cho người dùng." });
    expect(extractAgentReply(raw)).toBe("Phản hồi tự nhiên cho người dùng.");
    expect(extractAgentReply("```json\n" + raw + "\n```")).toBe("Phản hồi tự nhiên cho người dùng.");
    expect(extractAgentReply({ terminalResult: { output: raw } })).toBe("Phản hồi tự nhiên cho người dùng.");
  });

  it("allows attachment-only send only after upload completes", () => {
    expect(canSendAgentMessage({ message: "", sending: false, attachmentStatuses: ["uploaded"] })).toBe(true);
    expect(canSendAgentMessage({ message: "", sending: false, attachmentStatuses: ["uploading"] })).toBe(false);
    expect(canSendAgentMessage({ message: "hello", sending: false, attachmentStatuses: ["failed"] })).toBe(false);
    expect(canSendAgentMessage({ message: "hello", sending: false, attachmentStatuses: [] })).toBe(true);
  });

  it("limits collapsed history to five and expanded history to fifteen per page", () => {
    expect(visibleSlice(33, false, 1)).toEqual({ start: 0, end: 5, pages: 3 });
    expect(visibleSlice(33, true, 1)).toEqual({ start: 0, end: 15, pages: 3 });
    expect(visibleSlice(33, true, 2)).toEqual({ start: 15, end: 30, pages: 3 });
    expect(visibleSlice(33, true, 3)).toEqual({ start: 30, end: 33, pages: 3 });
  });

  it("keeps paste, drag/drop, picker, square previews, retry and object URL cleanup wired", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain("onPaste=");
    expect(source).toContain("onDrop=");
    expect(source).toContain('type="file"');
    expect(source).toContain("URL.createObjectURL(file)");
    expect(source).toContain("URL.revokeObjectURL");
    expect(source).toContain("setPreviewAttachment(item)");
    expect(source).toContain("uploadAttachment(item)");
    expect(source).toContain('item.status === "failed"');
    expect(source).toContain('item.status === "uploading"');
    expect(source).toContain("attachments: serializedAttachments");
    expect(source).toContain("previewUrl: item.previewUrl");
    expect(source).toContain('className="size-full object-cover"');
    expect(source).toContain("const persistedHref =");
  });

  it("queues Enter/send intent until pasted attachments are ready, clears after ACK and guards IME submission", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain("queuedSendRef.current = true");
    expect(source).toContain("setSendQueued(true)");
    expect(source).toContain("Đang chờ attachment upload xong để gửi");
    expect(source).toContain("event.nativeEvent.isComposing");
    expect(source).toContain("clientId: item.id");
    expect(source).toContain("setInput((current) => current.trim() === message ? \"\" : current)");
    expect(source).toContain("activeFacebookAccountIdRef.current = facebookAccountId");
    expect(source).toContain("item.facebookAccountId !== activeFacebookAccountIdRef.current");
    expect(source).toContain("Gửi ngay khi upload hoàn tất");
    const clearAt = source.indexOf('setInput((current) => current.trim() === message ? "" : current)');
    const waitAt = source.indexOf("await waitForReply(String(data.data.runId))");
    expect(clearAt).toBeGreaterThan(-1);
    expect(waitAt).toBeGreaterThan(clearAt);
  });

  it("persists message attachment ids and rehydrates durable attachment history", () => {
    const sidebar = read("components/agent/AgentSidebar.tsx");
    const route = read("app/api/agent/sidebar/route.ts");
    const attachmentRoute = read("app/api/agent/attachment/route.ts");
    expect(route).toContain("persistedAttachments.map((item) => item.id)");
    expect(route).toContain("ATTACHMENT_THREAD_MISMATCH");
    expect(sidebar).toContain("persistedAttachmentMap");
    expect(sidebar).toContain("/api/agent/attachment?id=");
    expect(attachmentRoute).toContain("attachment.thread.organizationId !== tenant.organizationId");
  });

  it("renders only tab context, Facebook Page and token usage in the user-facing Agent info projection", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    const start = source.indexOf('data-testid="agent-info-allowlist"');
    const end = source.indexOf('<Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>', start);
    const info = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(info).toContain("Context of Tab:");
    expect(info).toContain("{contextLabel}");
    expect(info).toContain("Facebook Page:");
    expect(info).toContain("Token usage:");
    expect(info).not.toContain("Mô hình:");
    expect(info).not.toContain("công cụ");
    expect(info).not.toContain("ngữ cảnh v");
    expect(info).not.toContain("phiên");
  });

  it("supports TUI-style slash command selection, stop control and contextual persistent handoff", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain('{ command: "/handoff"');
    expect(source).not.toContain('{ command: "/handoff-list"');
    expect(source).toContain('{ command: "/stop"');
    expect(source).toContain("commandMatches");
    expect(source).toContain("commandSelection");
    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Enter" || event.key === "Tab"');
    expect(source).toContain("AGENT_COMMANDS.some(({ command }) => command === query)");
    expect(source).toContain("stopActiveRun()");
    expect(source).toContain('command: "/stop"');
    expect(source).toContain("HANDOFF_STORAGE_KEY");
    expect(source).toContain("visiblePageContext");
    expect(source).toContain("analyzeHandoff");
    expect(source).toContain('mode: "HANDOFF_ANALYSIS"');
    expect(source).toContain("fallbackHandoffDescription");
    expect(source).toContain("targetIds");
  });

  it("worker aborts cancellation and retries transient OpenClaw handshake failures", () => {
    const worker = read("scripts/piltover-openclaw-worker.ts");
    const queue = read("lib/piltover/modules/agents/infrastructure/prisma-job-queue.ts");
    const runRoute = read("app/api/ai/runs/[runId]/route.ts");
    expect(worker).toContain("new AbortController()");
    expect(worker).toContain("abortController.abort");
    expect(worker).toContain("AGENT_RUN_CANCELLED");
    expect(worker).toContain("abortController.signal");
    expect(worker).toContain("isRetryableOpenClawFailure");
    expect(worker).toContain("opening handshake has timed out");
    expect(queue).toContain("AGENT_RUN_RETRY_SCHEDULED");
    expect(queue).toContain('status: "RETRY_PENDING"');
    expect(runRoute).toContain("terminalError?.message");
  });
});

describe("Shell contracts", () => {
  it("persists theme on root and localStorage", () => {
    const providers = read("components/Providers.tsx");
    expect(providers).toContain('root.classList.toggle("dark"');
    expect(providers).toContain("root.dataset.theme = next");
    expect(providers).toContain("root.style.colorScheme = next");
    expect(providers).toContain("window.localStorage.setItem(THEME_STORAGE_KEY, next)");
  });

  it("keeps the topbar ordered breadcrumb -> Page Switcher -> theme -> model -> account -> logout", () => {
    const topbar = read("components/layout/Topbar.tsx");
    expect(topbar).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(topbar).toContain("justify-self-center");
    const breadcrumb = topbar.indexOf('<nav aria-label="breadcrumb"');
    const switcher = topbar.indexOf("<AccountSwitcher />");
    const theme = topbar.indexOf("onClick={toggleTheme}");
    const model = topbar.indexOf("Model AI");
    const account = topbar.indexOf("title={email}");
    const logout = topbar.indexOf("onClick={onLogout}");
    expect(breadcrumb).toBeGreaterThan(-1);
    expect(breadcrumb).toBeLessThan(switcher);
    expect(switcher).toBeLessThan(theme);
    expect(theme).toBeLessThan(model);
    expect(model).toBeLessThan(account);
    expect(account).toBeLessThan(logout);
    expect(topbar).not.toContain("Tạo mới");
  });

  it("places Onboarding before Strategy and Command Center in System", () => {
    const sidebar = read("components/layout/Sidebar.tsx");
    const onboarding = sidebar.indexOf('{ label: "Onboarding"');
    const strategy = sidebar.indexOf('{ label: "Strategy"');
    const system = sidebar.indexOf('label: "System"');
    const commandCenter = sidebar.indexOf('{ label: "Command Center"');
    expect(onboarding).toBeGreaterThan(-1);
    expect(onboarding).toBeLessThan(strategy);
    expect(commandCenter).toBeGreaterThan(system);
  });

  it("uses shared soft dropdown/date-time components instead of browser-native controls in key flows", () => {
    expect(read("components/content/CalendarMonth.tsx")).toContain("FacebookPostComposer");
    expect(read("components/strategy/FrameworkPicker.tsx")).toContain("<SoftSelect");
    expect(read("components/marketing/CampaignWorkspace.tsx")).toContain("<SoftDateTimePicker");
  });

  it("keeps Studio draft deletion available and Strategy content mix structured", () => {
    expect(read("components/content/DraftEditor.tsx")).toContain("deleteMutation.mutate()");
    const strategy = read("components/strategy/StrategyPreview.tsx");
    expect(strategy).toContain("ContentRatioBar");
    expect(strategy).toContain("CTA Plan");
    expect(strategy).toContain("<table");
  });

  it("separates approval from post creation and uses the sidebar image hero", () => {
    const draft = read("components/content/DraftEditor.tsx");
    expect(draft).toContain("approveMutation.mutate()");
    expect(draft).toContain("createPostMutation.mutate()");
    expect(draft).toContain("Duyệt");
    expect(draft).toContain("Tạo Post");
    const sidebar = read("components/layout/Sidebar.tsx");
    expect(sidebar).toContain('/brand/sidebar-hero.webp');
  });

  it("renders queued Agent work as a readable pending state instead of a destructive error", () => {
    const errorState = read("components/ErrorState.tsx");
    expect(errorState).toContain("Agent job pending");
    expect(errorState).toContain("isPendingAgentMessage");
    expect(errorState).toContain("bg-[#eadfc9]");
  });
});