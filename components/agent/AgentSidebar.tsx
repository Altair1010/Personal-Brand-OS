"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/stores/onboarding";
import { listFacebookAccounts } from "@/app/(dashboard)/performance/actions";
import { invokeAgentAi } from "@/lib/ai/agent-client";
import { getSupabaseClient } from "@/lib/supabase";
import type { BrandDnaInput } from "@/lib/validators/brandDna";
import {
  canSendAgentMessage,
  extractAgentReply,
  type SerializableAttachment,
} from "@/lib/piltover/agent-chat/ui-contract";

type RunSummary = {
  id: string;
  status: string;
  roleRef: string;
  taskType: string;
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
  job: null | {
    id: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    leased: boolean;
  };
};

type ChatMessageAttachment = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  previewUrl?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  attachments?: ChatMessageAttachment[];
};

type AttachmentStatus = "preparing" | "uploading" | "uploaded" | "failed";

type ChatAttachment = SerializableAttachment & {
  id: string;
  file: File;
  status: AttachmentStatus;
  facebookAccountId: string | null;
  previewUrl?: string;
  error?: string;
};

type AgentTraceItem = {
  id: string;
  type: string;
  label: string;
  detail?: string;
  timestamp: string;
};

type LiveAgentState = {
  run: null | {
    id: string;
    status: string;
    model?: string | null;
    agentVersion?: string | null;
    promptVersion?: string | null;
    skills?: unknown;
    traceId?: string | null;
    jobStatus?: string | null;
    tokenUsage?: unknown;
    costMinor?: number | null;
  };
  tools?: { enabled: number };
  context?: { id: string | null; version: number | null; attached: boolean };
  approvals: Array<{ id: string; actionType: string; targetRef: string; status: string }>;
};

const SESSION_STORAGE_KEY = "piltover-agent-session-v1";
const MESSAGE_STORAGE_KEY = "piltover-agent-messages-v1";
const HANDOFF_STORAGE_KEY = "piltover-agent-handoff-v2";
const LEGACY_HANDOFF_STORAGE_KEY = "piltover-agent-handoff-list-v1";

type HandoffItem = {
  id: number;
  surface: string;
  text: string;
  createdAt: string;
};

const AGENT_COMMANDS = [
  { command: "/new", description: "Tạo AgentThread mới" },
  { command: "/help", description: "Hiển thị trợ giúp" },
  { command: "/handoff", description: "Phân tích ngữ cảnh tab và quản lý handoff list" },
  { command: "/status", description: "Trạng thái run, version và model" },
  { command: "/stop", description: "Dừng run đang hoạt động" },
  { command: "/retry", description: "Chạy lại user message gần nhất" },
  { command: "/compact", description: "Compact context của thread" },
  { command: "/context", description: "MarketingProjectContext hiện tại" },
  { command: "/artifacts", description: "Attachments, checkpoints và artifacts" },
  { command: "/tools", description: "Quyền tool hiện tại" },
  { command: "/model", description: "Model hiện tại" },
  { command: "/agent", description: "Agent/version/prompt/skills" },
  { command: "/session", description: "Xem thread id" },
  { command: "/clear", description: "Xóa chat hiển thị, giữ thread" },
] as const;

function clientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return globalThis.crypto["randomUUID"]();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Bảng điều khiển",
  "/onboarding": "Onboarding",
  "/audience-pillars": "Khán giả & Trụ cột",
  "/strategy": "Chiến lược",
  "/studio": "Studio",
  "/calendar": "Lịch",
  "/campaigns": "Chiến dịch",
  "/performance": "Hiệu suất",
  "/experiments": "Experiments",
  "/agents": "Agents",
  "/knowledge": "Knowledge",
  "/review": "Đánh giá tuần",
  "/settings": "Cài đặt",
};

function pageLabel(pathname: string): string {
  const key = Object.keys(PAGE_LABELS)
    .filter((item) => item === "/" ? pathname === "/" : pathname.startsWith(item))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PAGE_LABELS[key] : pathname;
}

function messagesFromPersistedRuns(runs: unknown[]): ChatMessage[] {
  const items: ChatMessage[] = [];
  for (const raw of runs) {
    if (!raw || typeof raw !== "object") continue;
    const run = raw as Record<string, unknown>;
    const task = run.task && typeof run.task === "object" ? run.task as Record<string, unknown> : null;
    const input = task?.input && typeof task.input === "object" ? task.input as Record<string, unknown> : null;
    const userMessage = typeof input?.userMessage === "string" ? input.userMessage : null;
    if (userMessage) items.push({ id: String(run.id) + ":user", role: "user", text: userMessage });

    const terminal = run.terminalResult && typeof run.terminalResult === "object"
      ? run.terminalResult as Record<string, unknown>
      : null;
    const artifacts = Array.isArray(terminal?.artifacts) ? terminal.artifacts : [];
    const first = artifacts[0] && typeof artifacts[0] === "object" ? artifacts[0] as Record<string, unknown> : null;
    const payload = first?.payload && typeof first.payload === "object" ? first.payload as Record<string, unknown> : null;
    const agentText = typeof payload?.message === "string" ? payload.message : null;
    if (agentText) items.push({ id: String(run.id) + ":agent", role: "agent", text: agentText });
  }
  return items.slice(-100);
}

function taskLabel(taskType: string): string {
  if (taskType === "CONTEXT_ASSISTANT_CHAT") return "Trò chuyện theo ngữ cảnh";
  if (taskType === "STRATEGY_PLAN_30D") return "Kế hoạch chiến lược 30 ngày";
  return taskType.replaceAll("_", " ").toLowerCase();
}

function runStateLabel(status?: string | null): string {
  if (!status || status === "IDLE") return "Rảnh";
  if (status === "QUEUED") return "Đang chờ";
  if (status === "CLAIMED") return "Đã nhận việc";
  if (status === "RUNNING") return "Đang chạy";
  if (status === "COMPLETED") return "Hoàn tất";
  if (status === "FAILED") return "Thất bại";
  if (status === "RETRY_PENDING") return "Chờ thử lại";
  return status;
}

function statusLabel(run: RunSummary): string {
  const status = run.job?.status ?? run.status;
  if (status === "QUEUED") return "Đang chờ worker";
  if (status === "CLAIMED") return "Agent đã nhận việc";
  if (status === "RUNNING") return "Agent đang làm việc";
  if (status === "RETRY_PENDING") return "Đang chờ thử lại";
  if (status === "COMPLETED") return "Hoàn tất";
  if (status === "FAILED") return "Thất bại";
  return status;
}

function tokenUsageLabel(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Chưa có";
  const usage = value as Record<string, unknown>;
  const total = usage.totalTokens;
  const input = usage.inputTokens;
  const output = usage.outputTokens;
  if (typeof total === "number") {
    const breakdown =
      typeof input === "number" && typeof output === "number"
        ? ` (in ${input.toLocaleString()} / out ${output.toLocaleString()})`
        : "";
    return `${total.toLocaleString()} tok${breakdown}`;
  }
  return "Chưa có";
}

export function AgentSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const facebookAccountId = searchParams.get("fb");
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [handoffItems, setHandoffItems] = useState<HandoffItem[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [liveState, setLiveState] = useState<LiveAgentState | null>(null);
  const [trace, setTrace] = useState<AgentTraceItem[]>([]);
  const [showRuns, setShowRuns] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [facebookPageName, setFacebookPageName] = useState<string | null>(null);
  const [sendQueued, setSendQueued] = useState(false);
  const [commandSelection, setCommandSelection] = useState(0);
  const sessionHydrated = useRef(false);
  const attachmentRef = useRef<ChatAttachment[]>([]);
  const activeFacebookAccountIdRef = useRef<string | null>(facebookAccountId);
  const queuedSendRef = useRef(false);
  const stoppedRunIdsRef = useRef<Set<string>>(new Set());
  const brand = useOnboardingStore((s) => s.brand);
  const patchBrand = useOnboardingStore((s) => s.patchBrand);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const contextLabel = useMemo(() => pageLabel(pathname), [pathname]);
  const commandMatches = useMemo(() => {
    const query = input.trim().toLowerCase();
    if (!query.startsWith("/") || query.includes(" ")) return [];
    if (AGENT_COMMANDS.some(({ command }) => command === query)) return [];
    return AGENT_COMMANDS.filter(({ command }) => command.startsWith(query));
  }, [input]);

  useEffect(() => {
    setCommandSelection(0);
  }, [input, commandMatches.length]);

  useEffect(() => {
    attachmentRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    activeFacebookAccountIdRef.current = facebookAccountId;
    queuedSendRef.current = false;
    setSendQueued(false);
    setAttachments((items) => {
      const stale = items.filter((item) => item.facebookAccountId !== facebookAccountId);
      for (const item of stale) revokeAttachment(item);
      if (stale.some((item) => item.id === previewAttachment?.id)) setPreviewAttachment(null);
      return items.filter((item) => item.facebookAccountId === facebookAccountId);
    });
  }, [facebookAccountId]);

  useEffect(() => {
    let cancelled = false;
    if (!facebookAccountId) {
      setFacebookPageName(null);
      return;
    }
    listFacebookAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setFacebookPageName(
          accounts.find((account) => account.id === facebookAccountId)?.pageName ?? null,
        );
      })
      .catch(() => {
        if (!cancelled) setFacebookPageName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [facebookAccountId]);

  useEffect(() => {
    if (!queuedSendRef.current || sending) return;
    if (attachments.some((item) => item.status === "failed")) {
      queuedSendRef.current = false;
      setSendQueued(false);
      return;
    }
    if (attachments.some((item) => item.status === "preparing" || item.status === "uploading")) return;
    if (!attachments.some((item) => item.status === "uploaded")) {
      queuedSendRef.current = false;
      setSendQueued(false);
      return;
    }
    queuedSendRef.current = false;
    setSendQueued(false);
    void sendMessage();
  }, [attachments, sending]);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(HANDOFF_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_HANDOFF_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) {
        const restored = parsed.filter((item): item is HandoffItem =>
          Boolean(
            item &&
            typeof item === "object" &&
            typeof (item as HandoffItem).id === "number" &&
            typeof (item as HandoffItem).text === "string",
          ),
        );
        setHandoffItems(restored);
        window.localStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(restored));
        window.localStorage.removeItem(LEGACY_HANDOFF_STORAGE_KEY);
      }
    } catch {
      window.localStorage.removeItem(HANDOFF_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(handoffItems));
  }, [handoffItems]);

  useEffect(() => {
    return () => {
      for (const item of attachmentRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!previewAttachment) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAttachment(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewAttachment]);

  useEffect(() => {
    const openAgent = () => setOpen(true);
    window.addEventListener("piltover:open-agent", openAgent);
    return () => window.removeEventListener("piltover:open-agent", openAgent);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      let nextSession = storedSession || clientId();

      if (storedSession) {
        const res = await fetch(
          `/api/agent/thread?threadId=${encodeURIComponent(storedSession)}`,
          { cache: "no-store" },
        ).catch(() => null);
        if (res?.ok) {
          const data = await res.json();
          const persistedAttachmentMap = new Map<string, ChatMessageAttachment>();
          if (Array.isArray(data?.data?.attachments)) {
            for (const rawAttachment of data.data.attachments) {
              if (!rawAttachment || typeof rawAttachment !== "object") continue;
              const attachment = rawAttachment as Record<string, unknown>;
              const metadata =
                attachment.metadata && typeof attachment.metadata === "object" && !Array.isArray(attachment.metadata)
                  ? attachment.metadata as Record<string, unknown>
                  : {};
              const id = String(attachment.id ?? "");
              if (!id) continue;
              persistedAttachmentMap.set(id, {
                id,
                fileName: typeof metadata.fileName === "string" ? metadata.fileName : "attachment",
                mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : null,
              });
            }
          }
          const persistedMessages = Array.isArray(data?.data?.messages)
            ? data.data.messages
                .map((item: unknown) => {
                  if (!item || typeof item !== "object") return null;
                  const message = item as Record<string, unknown>;
                  const content =
                    message.content && typeof message.content === "object" && !Array.isArray(message.content)
                      ? (message.content as Record<string, unknown>)
                      : null;
                  const metadata =
                    message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
                      ? message.metadata as Record<string, unknown>
                      : null;
                  const text = typeof content?.text === "string" ? content.text : null;
                  const role = message.role;
                  if (!text || !["user", "agent", "system"].includes(String(role))) return null;
                  const attachmentIds = Array.isArray(metadata?.attachmentIds)
                    ? metadata.attachmentIds.filter((id): id is string => typeof id === "string")
                    : [];
                  return {
                    id: String(message.id),
                    role: role as ChatMessage["role"],
                    text,
                    attachments: attachmentIds
                      .map((id) => persistedAttachmentMap.get(id))
                      .filter((attachment): attachment is ChatMessageAttachment => Boolean(attachment)),
                  };
                })
                .filter((item: ChatMessage | null): item is ChatMessage => item !== null)
                .slice(-100)
            : [];
          const persisted = persistedMessages.length > 0
            ? persistedMessages
            : Array.isArray(data?.data?.runs)
              ? messagesFromPersistedRuns(data.data.runs)
              : [];
          if (!cancelled && persisted.length > 0) setMessages(persisted);
        } else if (res?.status === 404) {
          const create = await fetch("/api/agent/thread", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestedId: storedSession }),
          });
          if (!create.ok) nextSession = clientId();
        }
      } else {
        const create = await fetch("/api/agent/thread", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestedId: nextSession }),
        }).catch(() => null);
        if (create?.ok) {
          const data = await create.json();
          nextSession = data.data.threadId;
        }
      }

      if (cancelled) return;
      window.localStorage.setItem(SESSION_STORAGE_KEY, nextSession);
      setConversationId(nextSession);

      if (messages.length === 0) {
        const storedMessages = window.localStorage.getItem(MESSAGE_STORAGE_KEY);
        if (storedMessages) {
          try {
            const parsed = JSON.parse(storedMessages);
            if (Array.isArray(parsed)) setMessages(parsed.slice(-100));
          } catch {
            window.localStorage.removeItem(MESSAGE_STORAGE_KEY);
          }
        }
      }
      sessionHydrated.current = true;
    }

    void hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionHydrated.current) return;
    window.localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;
    const source = new EventSource(
      `/api/agent/events?threadId=${encodeURIComponent(conversationId)}`,
    );
    const onSnapshot = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.payload) setLiveState(data.payload as LiveAgentState);
      } catch {
        // Ignore malformed transient events; the polling fallback remains active.
      }
    };
    const onTrace = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as {
          eventId?: string;
          type?: string;
          timestamp?: string;
          payload?: Record<string, unknown>;
        };
        const type = data.type ?? "ACTIVITY";
        const payload = data.payload ?? {};
        const rawLabel =
          typeof payload.label === "string"
            ? payload.label
            : type === "RUN_STARTED"
              ? "Agent bắt đầu"
              : type === "RUN_FINISHED"
                ? `Agent kết thúc: ${runStateLabel(String(payload.status ?? ""))}`
                : type === "ERROR"
                  ? `Lỗi: ${String(payload.message ?? payload.code ?? "Agent error")}`
                  : type === "TEXT_MESSAGE_START"
                    ? "Đang tạo phản hồi"
                    : type;
        const label =
          rawLabel === "Context resolved" ? "Đã nạp ngữ cảnh"
            : rawLabel.startsWith("Model execution started") ? "Bắt đầu chạy mô hình"
              : rawLabel === "Model execution completed" ? "Mô hình đã hoàn tất"
                : rawLabel === "Generating response" ? "Đang tạo phản hồi"
                  : rawLabel;
        const detail = typeof payload.detail === "string" ? payload.detail : undefined;
        const item: AgentTraceItem = {
          id: data.eventId ?? clientId(),
          type,
          label,
          detail,
          timestamp: data.timestamp ?? new Date().toISOString(),
        };
        setTrace((items) => {
          if (items.some((existing) => existing.id === item.id)) return items;
          return [...items, item].slice(-40);
        });
      } catch {
        // Keep the SSE connection alive if a transient event cannot be parsed.
      }
    };
    source.addEventListener("STATE_SNAPSHOT", onSnapshot as EventListener);
    for (const type of ["RUN_STARTED", "RUN_FINISHED", "ACTIVITY", "ERROR", "TEXT_MESSAGE_START", "TEXT_MESSAGE_END"]) {
      source.addEventListener(type, onTrace as EventListener);
    }
    return () => source.close();
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    async function refreshRuns() {
      try {
        const res = await fetch("/api/agent/runs", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.runs)) setRuns(data.runs);
      } catch {
        // Sidebar remains usable if telemetry refresh fails.
      }
    }
    void refreshRuns();
    const timer = setInterval(() => void refreshRuns(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function waitForReply(runId: string) {
    const start = Date.now();
    while (Date.now() - start < 600_000) {
      if (stoppedRunIdsRef.current.has(runId)) return;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (stoppedRunIdsRef.current.has(runId)) return;
      const res = await fetch(`/api/ai/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.status === 202 || data.pending) continue;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Agent run failed.");
      }
      const payload = data.data;
      const text = extractAgentReply(payload) || "Agent đã hoàn tất nhưng không có nội dung phản hồi.";
      setMessages((items) => [
        ...items,
        { id: clientId(), role: "agent", text },
      ]);
      return;
    }
    throw new Error("Agent chưa hoàn tất trong 10 phút. Có thể tiếp tục theo dõi ở mục tiến độ.");
  }

  async function analyzeAttachmentIntoBrandDna() {
    const attachment = attachments.find((item) => item.text?.trim());
    if (!attachment || !pathname.startsWith("/onboarding") || sending) return;
    setSending(true);
    try {
      const data = await invokeAgentAi<{
        positioning: string;
        threeWords: [string, string, string];
        differentiationSharpened: string;
        suggestedEducationTopics: string[];
        profilePatch?: Partial<BrandDnaInput>;
      }>("/api/ai/brand-dna", {
        whoAmI: brand.whoAmI,
        field: brand.field,
        coreBeliefs: brand.coreBeliefs,
        differentiation: brand.differentiation,
        personalStory: brand.personalStory,
        expertise: brand.expertise,
        customerProfile: brand.customerProfile,
        customerPain: brand.customerPain,
        customerMisunderstanding: brand.customerMisunderstanding,
        marketEducationGoal: brand.marketEducationGoal,
        extractedFileText: attachment.text,
      });
      const patch: Partial<BrandDnaInput> = {};
      const isBlank = (value: unknown) =>
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);
      for (const [key, value] of Object.entries(data.profilePatch ?? {})) {
        const current = brand[key as keyof BrandDnaInput];
        if (isBlank(current) && !isBlank(value)) {
          (patch as Record<string, unknown>)[key] = value;
        }
      }
      if (isBlank(brand.aiPositioning)) patch.aiPositioning = data.positioning;
      if (isBlank(brand.threeWords)) patch.threeWords = [...data.threeWords];
      if (isBlank(brand.differentiation)) patch.differentiation = data.differentiationSharpened;
      if (isBlank(brand.marketEducationGoal) && data.suggestedEducationTopics?.length) {
        patch.marketEducationGoal = data.suggestedEducationTopics.join("\n");
      }
      patchBrand(patch);
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "agent",
          text: `Đã phân tích ${attachment.fileName} và điền ${Object.keys(patch).length} trường Brand DNA còn trống. Hãy kiểm tra/chỉnh sửa trực tiếp trong Onboarding.`,
        },
      ]);
      clearAllAttachments();
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: error instanceof Error ? error.message : "Không phân tích được file.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function decideApproval(
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
  ) {
    setSending(true);
    try {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("AUTH_REQUIRED");
      const res = await fetch("/api/agent/approvals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ approvalId, decision }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Approval failed.");
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: decision === "APPROVED"
            ? "Đã phê duyệt. Run sẽ resume từ checkpoint."
            : "Đã từ chối yêu cầu.",
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: error instanceof Error ? error.message : "Approval failed.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function runControlCommand(command: string) {
    if (!conversationId) return;
    setSending(true);
    try {
      const res = await fetch("/api/agent/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: conversationId, command }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Command failed.");
      setMessages((items) => [
        ...items,
        { id: clientId(), role: "user", text: command },
        {
          id: clientId(),
          role: "system",
          text: JSON.stringify(data.data, null, 2),
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: error instanceof Error ? error.message : "Command failed.",
        },
      ]);
    } finally {
      setSending(false);
      setInput("");
    }
  }

  function handoffListText(items: HandoffItem[]) {
    if (items.length === 0) return "Handoff list đang trống.";
    return [
      "Handoff list:",
      ...items.map((item) => `${item.id}. [${item.surface}] ${item.text}`),
      "",
      "Dùng /handoff DONE để clear toàn bộ; /handoff clear 2 hoặc /handoff DONE 2,4 để clear mục đã hoàn tất.",
    ].join("\n");
  }

  function fallbackHandoffDescription(raw: string) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    const snapshot = visiblePageContext();
    return [
      `Vấn đề/Yêu cầu tại ${contextLabel}: ${normalized}`,
      snapshot ? `Ngữ cảnh tab tại thời điểm handoff: ${snapshot}` : "",
      "Pipeline handoff: xác nhận biểu hiện hoặc outcome mong muốn -> đọc ngữ cảnh tab hiện tại -> truy vết UI/component -> client state -> API/server action -> domain/service -> persistence/queue/worker/provider -> xác định deepest supported root-cause hypothesis hoặc upgrade contract -> nêu implementation scope, ordering/concurrency constraints, invariants, edge cases và acceptance checks. Không khẳng định phần chưa có evidence.",
    ].filter(Boolean).join(" ");
  }

  function visiblePageContext() {
    const root = document.querySelector<HTMLElement>("[data-piltover-page-context]");
    if (!root) return "";

    const compact = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();

    const controls = Array.from(
      root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select",
      ),
    )
      .slice(0, 40)
      .map((control) => ({
        kind: control.tagName.toLowerCase(),
        name: control.getAttribute("name") ?? control.getAttribute("aria-label") ?? control.id ?? null,
        value:
          control instanceof HTMLInputElement && control.type === "password"
            ? "[REDACTED]"
            : compact(control.value).slice(0, 280),
        disabled: control.disabled,
      }));

    const actions = Array.from(root.querySelectorAll<HTMLElement>("button, [role='button'], a"))
      .slice(0, 50)
      .map((node) => compact(node.textContent).slice(0, 160))
      .filter(Boolean);

    const alerts = Array.from(root.querySelectorAll<HTMLElement>("[role='alert'], [data-error], [aria-live]"))
      .slice(0, 20)
      .map((node) => compact(node.textContent).slice(0, 600))
      .filter(Boolean);

    const snapshot = {
      url: window.location.pathname + window.location.search,
      surface: contextLabel,
      visibleText: compact(root.innerText).slice(0, 7000),
      alerts,
      controls,
      actions,
    };

    return JSON.stringify(snapshot).slice(0, 12000);
  }

  async function analyzeHandoff(raw: string) {
    const threadId = await ensureConversationReady();
    const res = await fetch("/api/agent/sidebar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: raw,
        pathname,
        facebookAccountId,
        conversationId: threadId,
        mode: "HANDOFF_ANALYSIS",
        visibleContext: visiblePageContext(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data?.data?.runId) {
      throw new Error(data.error ?? "Không tạo được handoff analysis.");
    }
    const runId = String(data.data.runId);
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const statusRes = await fetch(`/api/ai/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const statusData = await statusRes.json();
      if (statusRes.status === 202 || statusData.pending) continue;
      if (!statusRes.ok || !statusData.ok) {
        throw new Error(statusData.error ?? "Handoff analysis failed.");
      }
      const text = extractAgentReply(statusData.data);
      if (!text) throw new Error("Agent không trả mô tả handoff.");
      return text.trim();
    }
    throw new Error("Handoff analysis chưa hoàn tất trong 3 phút.");
  }

  async function handleHandoffCommand(command: string) {
    const payload = command.replace(/^\/handoff\b/i, "").trim();
    const userMessage: ChatMessage = { id: clientId(), role: "user", text: command };

    if (!payload) {
      setMessages((items) => [
        ...items,
        userMessage,
        { id: clientId(), role: "system", text: handoffListText(handoffItems) },
      ]);
      setInput("");
      return;
    }

    if (/^(done|clear)$/i.test(payload)) {
      setHandoffItems([]);
      setMessages((items) => [
        ...items,
        userMessage,
        { id: clientId(), role: "system", text: "Đã clear toàn bộ handoff list." },
      ]);
      setInput("");
      return;
    }

    const selected = /^(?:done|clear|remove)\s+(.+)$/i.exec(payload);
    if (selected) {
      const targetIds = Array.from(
        new Set(
          selected[1]
            .split(/[\s,]+/)
            .map((value) => Number(value.replace(/^#/, "")))
            .filter((value) => Number.isInteger(value) && value > 0),
        ),
      );
      const existingIds = new Set(handoffItems.map((item) => item.id));
      const removed = targetIds.filter((id) => existingIds.has(id));
      const next = handoffItems.filter((item) => !targetIds.includes(item.id));
      setHandoffItems(next);
      setMessages((items) => [
        ...items,
        userMessage,
        {
          id: clientId(),
          role: "system",
          text: removed.length > 0
            ? `Đã clear handoff #${removed.join(", #")}.\n\n${handoffListText(next)}`
            : `Không tìm thấy handoff phù hợp.\n\n${handoffListText(handoffItems)}`,
        },
      ]);
      setInput("");
      return;
    }

    setSending(true);
    setInput("");
    setMessages((items) => [
      ...items,
      userMessage,
      {
        id: clientId(),
        role: "system",
        text: `Đang đọc ngữ cảnh ${contextLabel} và phân tích handoff theo pipeline symptom → context → root cause/upgrade contract → implementation → verification…`,
      },
    ]);
    let rewritten = fallbackHandoffDescription(payload);
    try {
      rewritten = await analyzeHandoff(payload);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: `Agent handoff analysis chưa hoàn tất; dùng mô tả fallback có context. ${error instanceof Error ? error.message : ""}`,
        },
      ]);
    } finally {
      setSending(false);
    }

    const nextId = handoffItems.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const item: HandoffItem = {
      id: nextId,
      surface: contextLabel,
      text: rewritten,
      createdAt: new Date().toISOString(),
    };
    const next = [...handoffItems, item];
    setHandoffItems(next);
    setMessages((items) => [
      ...items,
      {
        id: clientId(),
        role: "system",
        text: `Đã thêm handoff #${nextId}:\n[${contextLabel}] ${rewritten}`,
      },
    ]);
  }

  async function stopActiveRun() {
    setStopping(true);
    try {
      const threadId = await ensureConversationReady();
      const res = await fetch("/api/agent/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, command: "/stop" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Không dừng được Agent run.");
      const stoppedRunId = data.data?.runId ? String(data.data.runId) : null;
      if (stoppedRunId) stoppedRunIdsRef.current.add(stoppedRunId);
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: stoppedRunId
            ? `Đã dừng run ${stoppedRunId}. Agent sẽ không tiếp tục ghi kết quả vào cuộc trò chuyện này.`
            : "Không có run đang hoạt động để dừng.",
        },
      ]);
      setSending(false);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: error instanceof Error ? error.message : "Không dừng được Agent run.",
        },
      ]);
    } finally {
      setStopping(false);
    }
  }

  async function ensureConversationReady(): Promise<string> {
    if (conversationId) return conversationId;
    const requestedId =
      window.localStorage.getItem(SESSION_STORAGE_KEY) || clientId();
    const res = await fetch("/api/agent/thread", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestedId }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data?.data?.threadId) {
      throw new Error(data?.error ?? "AGENT_THREAD_INIT_FAILED");
    }
    const threadId = String(data.data.threadId);
    window.localStorage.setItem(SESSION_STORAGE_KEY, threadId);
    setConversationId(threadId);
    sessionHydrated.current = true;
    return threadId;
  }

  function revokeAttachment(item: ChatAttachment) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }

  function removeAttachment(id: string) {
    setAttachments((items) => {
      const target = items.find((item) => item.id === id);
      if (target) revokeAttachment(target);
      if (previewAttachment?.id === id) setPreviewAttachment(null);
      return items.filter((item) => item.id !== id);
    });
  }

  function clearAllAttachments() {
    setAttachments((items) => {
      for (const item of items) revokeAttachment(item);
      return [];
    });
    setPreviewAttachment(null);
  }

  async function uploadAttachment(item: ChatAttachment) {
    setAttachments((items) =>
      items.map((current) =>
        current.id === item.id
          ? { ...current, status: "uploading", error: undefined }
          : current,
      ),
    );
    try {
      const form = new FormData();
      form.append("file", item.file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không upload được file.");
      if (item.facebookAccountId !== activeFacebookAccountIdRef.current) {
        revokeAttachment(item);
        setAttachments((items) => items.filter((current) => current.id !== item.id));
        return;
      }
      setAttachments((items) =>
        items.map((current) =>
          current.id === item.id
            ? {
                ...current,
                fileName: data.fileName ?? current.fileName,
                text: data.text ?? "",
                mimeType: data.mimeType ?? current.mimeType,
                localPath: data.localPath ?? undefined,
                status: "uploaded",
                error: undefined,
              }
            : current,
        ),
      );
    } catch (error) {
      setAttachments((items) =>
        items.map((current) =>
          current.id === item.id
            ? {
                ...current,
                status: "failed",
                error: error instanceof Error ? error.message : "Upload thất bại.",
              }
            : current,
        ),
      );
    }
  }

  function queueFile(file: File, source: ChatAttachment["source"] = "upload") {
    const item: ChatAttachment = {
      id: clientId(),
      file,
      fileName: file.name || "attachment",
      mimeType: file.type || undefined,
      source,
      status: "preparing",
      facebookAccountId,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    };
    setAttachments((items) => [...items, item]);
    void uploadAttachment(item);
  }

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (sending) return;
    const hasFailedAttachment = attachments.some((item) => item.status === "failed");
    if (hasFailedAttachment) return;
    const hasPendingAttachment = attachments.some(
      (item) => item.status === "preparing" || item.status === "uploading",
    );
    if (hasPendingAttachment) {
      if (!queuedSendRef.current) {
        queuedSendRef.current = true;
        setSendQueued(true);
      }
      return;
    }
    if (!canSendAgentMessage({
      message,
      sending,
      attachmentStatuses: attachments.map((item) => item.status),
    })) return;

    if (message === "/new") {
      setSending(true);
      try {
        const res = await fetch("/api/agent/thread", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Không tạo được AgentThread mới.");
        const nextSession = String(data.data.threadId);
        window.localStorage.setItem(SESSION_STORAGE_KEY, nextSession);
        window.localStorage.removeItem(MESSAGE_STORAGE_KEY);
        setConversationId(nextSession);
        setMessages([
          {
            id: clientId(),
            role: "system",
            text: "Đã tạo AgentThread mới. Thread cũ được giữ lại trong lịch sử.",
          },
        ]);
        clearAllAttachments();
        setInput("");
      } catch (error) {
        setMessages((items) => [
          ...items,
          {
            id: clientId(),
            role: "system",
            text: error instanceof Error ? error.message : "Không tạo được AgentThread mới.",
          },
        ]);
      } finally {
        setSending(false);
      }
      return;
    }

    if (message === "/help") {
      setMessages((items) => [
        ...items,
        { id: clientId(), role: "user", text: message },
        {
          id: clientId(),
          role: "system",
          text:
            "Lệnh Piltover Agent:\n/new — tạo AgentThread mới\n/help — hiển thị trợ giúp\n/handoff — xem handoff list hiện tại\n/handoff <mô tả> — Agent đọc ngữ cảnh tab, truy vết symptom → root cause hoặc upgrade contract rồi thêm vào list\n/handoff clear <số> — clear một hoặc nhiều mục\n/handoff DONE — hoàn tất và clear toàn bộ list\n/compact — compact context, giữ nguyên thread\n/status — trạng thái run + version + model\n/context — MarketingProjectContext đang dùng\n/artifacts — attachments/checkpoints/artifacts\n/tools — quyền tool hiện tại\n/model — model hiện tại\n/agent — agent/version/prompt/skills\n/retry — chạy lại user message gần nhất\n/stop — hủy run đang hoạt động\n/clear — xóa phần chat hiển thị, không xóa thread\n/session — xem thread id.",
        },
      ]);
      setInput("");
      return;
    }

    if (message === "/clear") {
      setMessages([]);
      window.localStorage.removeItem(MESSAGE_STORAGE_KEY);
      setInput("");
      return;
    }

    if (/^\/handoff(?:\s|$)/i.test(message)) {
      await handleHandoffCommand(message);
      return;
    }

    if (message === "/stop") {
      await stopActiveRun();
      setInput("");
      return;
    }

    if (["/status", "/context", "/artifacts", "/tools", "/model", "/agent"].includes(message)) {
      await runControlCommand(message);
      return;
    }

    if (message === "/session") {
      setMessages((items) => [
        ...items,
        { id: clientId(), role: "user", text: message },
        {
          id: clientId(),
          role: "system",
          text: `Session hiện tại: ${conversationId || "(đang khởi tạo)"}`,
        },
      ]);
      setInput("");
      return;
    }

    if (message === "/retry") {
      const previous = [...messages]
        .reverse()
        .find((item) => item.role === "user" && !item.text.startsWith("/"));
      if (!previous) {
        setMessages((items) => [
          ...items,
          { id: clientId(), role: "system", text: "Không có user message trước đó để retry." },
        ]);
        setInput("");
        return;
      }
      setInput("");
      await sendMessage(previous.text);
      return;
    }

    if (message.startsWith("/") && message !== "/compact") {
      setMessages((items) => [
        ...items,
        { id: clientId(), role: "user", text: message },
        {
          id: clientId(),
          role: "system",
          text: `Lệnh ${message} chưa được hỗ trợ. Dùng /help để xem danh sách lệnh.`,
        },
      ]);
      setInput("");
      return;
    }

    let activeConversationId = conversationId;
    if (!activeConversationId) {
      try {
        activeConversationId = await ensureConversationReady();
      } catch (error) {
        setMessages((items) => [
          ...items,
          {
            id: clientId(),
            role: "system",
            text: error instanceof Error ? error.message : "Không khởi tạo được Agent thread.",
          },
        ]);
        return;
      }
    }
    const sendAttachments = attachments.filter((item) => item.status === "uploaded");
    const serializedAttachments: SerializableAttachment[] = sendAttachments.map((item) => ({
      clientId: item.id,
      fileName: item.fileName,
      text: item.text,
      mimeType: item.mimeType,
      localPath: item.localPath,
      source: item.source,
    }));
    const displayMessage = message || `Đã gửi ${sendAttachments.length} tệp đính kèm.`;
    const optimisticMessageId = clientId();
    setSending(true);
    setMessages((items) => [
      ...items,
      {
        id: optimisticMessageId,
        role: "user",
        text: displayMessage,
        attachments: sendAttachments.map((item) => ({
          id: item.id,
          fileName: item.fileName,
          mimeType: item.mimeType,
          previewUrl: item.previewUrl,
        })),
      },
    ]);
    try {
      const res = await fetch("/api/agent/sidebar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          pathname,
          facebookAccountId,
          attachments: serializedAttachments,
          conversationId: activeConversationId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Không giao được việc cho Agent.");

      const canonicalAttachments: ChatMessageAttachment[] = Array.isArray(data.data?.attachments)
        ? data.data.attachments.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            fileName: typeof item.fileName === "string" ? item.fileName : "attachment",
            mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
          }))
        : sendAttachments.map((item) => ({
            id: item.id,
            fileName: item.fileName,
            mimeType: item.mimeType,
          }));
      setMessages((items) =>
        items.map((item) =>
          item.id === optimisticMessageId
            ? { ...item, attachments: canonicalAttachments }
            : item,
        ),
      );

      // The server has persisted the user message and attachments. Clear the composer now;
      // do not wait for the Agent model run to finish before giving the user a fresh input box.
      const sentIds = new Set(sendAttachments.map((item) => item.id));
      setInput((current) => current.trim() === message ? "" : current);
      setAttachments((items) => items.filter((item) => !sentIds.has(item.id)));
      setPreviewAttachment(null);
      for (const item of sendAttachments) revokeAttachment(item);

      await waitForReply(String(data.data.runId));
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: clientId(),
          role: "system",
          text: error instanceof Error ? error.message : "Agent request failed.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onFile(file: File, source: ChatAttachment["source"] = "upload") {
    queueFile(file, source);
  }

  const activeRuns = runs.filter((run) => !["COMPLETED", "FAILED", "CANCELLED"].includes(run.status));
  const recentRuns = runs.slice(0, 5);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 rounded-l-2xl border border-r-0 border-white/25 bg-[var(--neu-raised)] px-2 py-3 text-sm font-semibold text-[var(--neu-teal)] [box-shadow:var(--shadow-popover)]"
        aria-label={open ? "Đóng Agent sidebar" : "Mở Agent sidebar"}
      >
        <Bot className="size-4" />
        {!open && <span>Agent</span>}
      </button>

      <aside
        className={[
          "fixed right-0 top-0 z-50 flex h-screen w-[390px] flex-col border-l border-white/25 bg-[var(--neu-raised)] [box-shadow:var(--shadow-popover)] transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-white/20 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="size-4" />
              <h2 className="font-semibold">Piltover Agent</h2>
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground" data-testid="agent-info-allowlist">
              <div>
                <span className="font-medium text-foreground">Context of Tab:</span>{" "}
                <span>{contextLabel}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">Facebook Page:</span>{" "}
                <span>{facebookPageName ?? (facebookAccountId ? "Đang tải…" : "Chưa chọn")}</span>
              </div>
              <div>
                <span className="font-medium text-foreground">Token usage:</span>{" "}
                <span>{tokenUsageLabel(liveState?.run?.tokenUsage)}</span>
              </div>
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="border-b border-white/20 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowRuns((value) => !value)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-xs font-medium hover:bg-muted/60"
          >
            <span>Tiến độ Agent <span className="text-muted-foreground">({activeRuns.length || recentRuns.length})</span></span>
            {showRuns ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {showRuns && (
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
              {(activeRuns.length ? activeRuns : recentRuns).slice(0, 4).map((run) => (
                <div key={run.id} className="rounded-lg border p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{taskLabel(run.taskType)}</span>
                    <span className="shrink-0 text-muted-foreground">{statusLabel(run)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {run.job?.leased && !["COMPLETED", "FAILED"].includes(run.status) && (
                      <Loader2 className="size-3 animate-spin" />
                    )}
                    <span className="truncate">{run.id}</span>
                    {run.job && <span>lần {run.job.attemptCount}/{run.job.maxAttempts}</span>}
                  </div>
                </div>
              ))}
              {runs.length === 0 && <p className="text-xs text-muted-foreground">Chưa có lượt chạy Agent.</p>}
            </div>
          )}

          {trace.length > 0 && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setShowTrace((value) => !value)}
                className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-xs font-medium hover:bg-muted/60"
              >
                <span>Nhật ký vận hành <span className="text-muted-foreground">({trace.length})</span></span>
                {showTrace ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
              {showTrace && (
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border p-2">
                  {trace.slice(-10).map((item) => (
                    <div key={item.id} className="flex gap-2 text-[11px] leading-4">
                      <span className="shrink-0 font-mono text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span className="min-w-0">
                        <span>{item.label}</span>
                        {item.detail ? <span className="text-muted-foreground"> · {item.detail}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {liveState?.approvals?.map((approval) => (
            <div key={approval.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="text-xs font-medium">Cần phê duyệt</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {approval.actionType} · {approval.targetRef}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={sending}
                  onClick={() => void decideApproval(approval.id, "APPROVED")}
                >
                  Phê duyệt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sending}
                  onClick={() => void decideApproval(approval.id, "REJECTED")}
                >
                  Từ chối
                </Button>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Trao đổi với Agent theo đúng context của tab hiện tại. Có thể đính kèm Markdown, DOCX hoặc PDF để Agent phân tích trước.
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={[
                "max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground [box-shadow:var(--shadow-raised-sm)]"
                  : message.role === "agent"
                    ? "border border-white/20 bg-[var(--neu-raised)] [box-shadow:var(--shadow-raised-sm)]"
                    : "border border-destructive/30 bg-[rgba(162,77,69,.08)] text-destructive",
              ].join(" ")}
            >
              <div>{message.text}</div>
              {message.attachments?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => {
                    const persistedHref = `/api/agent/attachment?id=${encodeURIComponent(attachment.id)}`;
                    const href = attachment.previewUrl ?? persistedHref;
                    const image = attachment.mimeType?.startsWith("image/");
                    return image ? (
                      <a
                        key={attachment.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="block size-20 overflow-hidden rounded-xl border border-white/25 bg-[var(--neu-inset)] [box-shadow:var(--shadow-inset)]"
                        title={attachment.fileName}
                      >
                        <img
                          src={href}
                          alt={attachment.fileName}
                          className="size-full object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        key={attachment.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/20 px-2 py-1 text-xs underline-offset-2 hover:underline"
                      >
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate">{attachment.fileName}</span>
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
          {sending && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-[var(--neu-inset)] px-3 py-2 text-xs [box-shadow:var(--shadow-inset)]">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                <span className="truncate">Agent đang xử lý…</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={stopping}
                onClick={() => void stopActiveRun()}
              >
                {stopping ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5" />}
                Dừng
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-white/20 bg-[var(--neu-raised)] p-3">
          {attachments.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {attachments.map((item) => {
                  const isImage = item.mimeType?.startsWith("image/") && Boolean(item.previewUrl);
                  const busyUpload = item.status === "preparing" || item.status === "uploading";
                  return (
                    <div
                      key={item.id}
                      className={[
                        "group relative size-[76px] overflow-hidden rounded-xl border bg-[var(--neu-inset)] [box-shadow:var(--shadow-inset)]",
                        item.status === "failed" ? "border-destructive/50" : "border-white/25",
                      ].join(" ")}
                      title={item.fileName}
                    >
                      {isImage ? (
                        <button
                          type="button"
                          className="absolute inset-0"
                          onClick={() => setPreviewAttachment(item)}
                          aria-label={`Xem ảnh ${item.fileName}`}
                        >
                          <img
                            src={item.previewUrl}
                            alt={item.fileName}
                            className="size-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                          <FileText className="size-6 text-[var(--neu-teal)]" />
                          <span className="w-full truncate text-[9px] font-medium">{item.fileName}</span>
                          <span className="text-[8px] text-muted-foreground">
                            {Math.max(1, Math.round(item.file.size / 1024))} KB
                          </span>
                        </div>
                      )}

                      {busyUpload && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(32,39,36,.32)] backdrop-blur-[1px]">
                          <span className="grid size-7 place-items-center rounded-full border border-white/60 bg-[var(--neu-raised)] [box-shadow:var(--shadow-raised-sm)]">
                            <Loader2 className="size-4 animate-spin text-[var(--neu-teal)]" />
                          </span>
                          <span className="rounded-full bg-[rgba(32,39,36,.66)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                            {item.status === "preparing" ? "Preparing" : "Uploading"}
                          </span>
                        </div>
                      )}

                      {item.status === "uploaded" && (
                        <span className="absolute bottom-1 left-1 rounded-full bg-[var(--neu-teal)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary-foreground">
                          Ready
                        </span>
                      )}

                      {item.status === "failed" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(162,77,69,.88)] px-1 text-center text-[9px] text-white">
                          <span className="line-clamp-2">Upload lỗi</span>
                          <button
                            type="button"
                            className="grid size-6 place-items-center rounded-full bg-white/20 hover:bg-white/30"
                            onClick={() => void uploadAttachment(item)}
                            aria-label={`Thử upload lại ${item.fileName}`}
                          >
                            <RefreshCw className="size-3.5" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        className="absolute right-1 top-1 z-20 grid size-5 place-items-center rounded-full bg-[rgba(32,39,36,.72)] text-white opacity-90 hover:bg-destructive"
                        onClick={() => removeAttachment(item.id)}
                        aria-label={`Xóa ${item.fileName}`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              {pathname.startsWith("/onboarding") && attachments.some((item) => item.status === "uploaded" && Boolean(item.text?.trim())) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => void analyzeAttachmentIntoBrandDna()}
                  disabled={sending || attachments.some((item) => item.status === "preparing" || item.status === "uploading")}
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                  Phân tích file → điền Brand DNA
                </Button>
              )}
            </div>
          )}
          {sendQueued && (
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Đang chờ attachment upload xong để gửi…</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sending}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".md,.markdown,.txt,.csv,.json,.yaml,.yml,.log,.docx,.pdf,image/png,image/jpeg,image/gif,image/webp,image/bmp,text/*"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                for (const file of files) void onFile(file);
                event.target.value = "";
              }}
            />
            <div className="relative min-w-0 flex-1">
              {commandMatches.length > 0 && (
                <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-30 max-h-72 overflow-y-auto rounded-xl border border-white/25 bg-[var(--neu-raised)] p-1.5 [box-shadow:var(--shadow-popover)]">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Agent Commands
                  </div>
                  {commandMatches.map(({ command, description }, index) => (
                    <button
                      key={command}
                      type="button"
                      aria-selected={index === commandSelection}
                      className={[
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                        index === commandSelection
                          ? "bg-[var(--neu-teal-soft)]"
                          : "hover:bg-[var(--neu-teal-soft)]",
                      ].join(" ")}
                      onMouseEnter={() => setCommandSelection(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setInput(command);
                        requestAnimationFrame(() => composerRef.current?.focus());
                      }}
                    >
                      <code className="min-w-[112px] text-xs font-bold text-[var(--neu-teal)]">{command}</code>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{description}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files ?? []);
                  if (files.length > 0) {
                    event.preventDefault();
                    for (const file of files) void onFile(file, "paste");
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const files = Array.from(event.dataTransfer.files ?? []);
                  if (files.length > 0) {
                    event.preventDefault();
                    for (const file of files) void onFile(file, "drag_drop");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;

                  if (commandMatches.length > 0) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setCommandSelection((current) => (current + 1) % commandMatches.length);
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setCommandSelection((current) => (current - 1 + commandMatches.length) % commandMatches.length);
                      return;
                    }
                    if (event.key === "Enter" || event.key === "Tab") {
                      event.preventDefault();
                      const selected = commandMatches[Math.min(commandSelection, commandMatches.length - 1)];
                      if (selected) {
                        setInput(selected.command);
                        requestAnimationFrame(() => composerRef.current?.focus());
                      }
                      return;
                    }
                  }

                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={`Trao đổi với Agent về ${contextLabel}…  gõ / để xem command`}
                rows={3}
                className="min-h-[72px] w-full resize-none rounded-xl border border-input bg-[var(--neu-inset)] px-3 py-2 text-sm outline-none [box-shadow:var(--shadow-inset)] focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void sendMessage()}
              disabled={sending || attachments.some((item) => item.status === "failed") || (!input.trim() && attachments.length === 0)}
              title={
                attachments.some((item) => item.status === "preparing" || item.status === "uploading")
                  ? "Gửi ngay khi upload hoàn tất"
                  : attachments.some((item) => item.status === "failed")
                    ? "Retry hoặc xóa attachment lỗi trước khi gửi"
                    : "Gửi"
              }
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {previewAttachment?.previewUrl && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(19,24,22,.72)] p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Xem trước ${previewAttachment.fileName}`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPreviewAttachment(null);
          }}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-2xl border border-white/20 bg-[var(--neu-raised)] p-3 [box-shadow:var(--shadow-popover)]">
            <img
              src={previewAttachment.previewUrl}
              alt={previewAttachment.fileName}
              className="max-h-[82vh] max-w-[84vw] rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewAttachment(null)}
              className="absolute -right-3 -top-3 grid size-9 place-items-center rounded-full border border-white/25 bg-[var(--neu-raised)] text-foreground [box-shadow:var(--shadow-raised-sm)] hover:text-destructive"
              aria-label="Đóng xem trước"
            >
              <X className="size-4" />
            </button>
            <div className="mt-2 max-w-[70vw] truncate px-1 text-xs text-muted-foreground">
              {previewAttachment.fileName}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
