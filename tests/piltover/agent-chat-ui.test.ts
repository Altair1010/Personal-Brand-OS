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

  it("keeps paste, drag/drop, picker, preview, retry and object URL cleanup wired", () => {
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
  });

  it("queues Enter/send intent until pasted attachments are ready and guards IME submission", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain("queuedSendRef.current = true");
    expect(source).toContain("setSendQueued(true)");
    expect(source).toContain("Đang chờ attachment upload xong để gửi");
    expect(source).toContain("!event.nativeEvent.isComposing");
    expect(source).toContain("clientId: item.id");
    expect(source).toContain("setInput((current) => current.trim() === message ? \"\" : current)");
    expect(source).toContain("activeFacebookAccountIdRef.current = facebookAccountId");
    expect(source).toContain("item.facebookAccountId !== activeFacebookAccountIdRef.current");
    expect(source).toContain("Gửi ngay khi upload hoàn tất");
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

  it("renders only Facebook Page and token usage in the user-facing Agent info projection", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    const start = source.indexOf('data-testid="agent-info-allowlist"');
    const end = source.indexOf('<Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>', start);
    const info = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(info).toContain("Facebook Page:");
    expect(info).toContain("Token usage:");
    expect(info).not.toContain("Ngữ cảnh:");
    expect(info).not.toContain("Mô hình:");
    expect(info).not.toContain("công cụ");
    expect(info).not.toContain("ngữ cảnh v");
    expect(info).not.toContain("phiên");
  });

  it("supports visible slash commands, stop control and contextual persistent handoff", () => {
    const source = read("components/agent/AgentSidebar.tsx");
    expect(source).toContain('{ command: "/handoff"');
    expect(source).not.toContain('{ command: "/handoff-list"');
    expect(source).toContain('{ command: "/stop"');
    expect(source).toContain("commandMatches");
    expect(source).toContain("stopActiveRun()");
    expect(source).toContain('command: "/stop"');
    expect(source).toContain("HANDOFF_STORAGE_KEY");
    expect(source).toContain("visiblePageContext");
    expect(source).toContain("analyzeHandoff");
    expect(source).toContain('mode: "HANDOFF_ANALYSIS"');
    expect(source).toContain("fallbackHandoffDescription");
    expect(source).toContain("targetIds");
  });

  it("worker aborts active model execution when cancellation invalidates the lease", () => {
    const worker = read("scripts/piltover-openclaw-worker.ts");
    expect(worker).toContain("new AbortController()");
    expect(worker).toContain("abortController.abort");
    expect(worker).toContain("AGENT_RUN_CANCELLED");
    expect(worker).toContain("abortController.signal");
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

  it("keeps the topbar ordered theme -> Page Switcher -> breadcrumb with a true center column", () => {
    const topbar = read("components/layout/Topbar.tsx");
    expect(topbar).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(topbar).toContain("justify-self-center");
    const theme = topbar.indexOf("onClick={toggleTheme}");
    const switcher = topbar.indexOf("<AccountSwitcher />");
    const breadcrumb = topbar.indexOf('<nav aria-label="breadcrumb"');
    expect(theme).toBeGreaterThan(-1);
    expect(theme).toBeLessThan(switcher);
    expect(switcher).toBeLessThan(breadcrumb);
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