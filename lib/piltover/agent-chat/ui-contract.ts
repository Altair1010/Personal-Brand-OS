export type SerializableAttachment = {
  clientId?: string;
  fileName: string;
  text?: string;
  mimeType?: string;
  localPath?: string;
  source?: "upload" | "paste" | "drag_drop";
};

function unwrapJsonFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function maybeParseJson(value: string): unknown {
  const candidate = unwrapJsonFence(value);
  if (!candidate) return "";
  if (
    (candidate.startsWith("{") && candidate.endsWith("}")) ||
    (candidate.startsWith("[") && candidate.endsWith("]"))
  ) {
    try {
      return JSON.parse(candidate);
    } catch {
      return candidate;
    }
  }
  return candidate;
}

export function extractAgentReply(payload: unknown): string {
  if (typeof payload === "string") {
    const parsed = maybeParseJson(payload);
    if (typeof parsed !== "string") return extractAgentReply(parsed);
    return parsed.trim();
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = payload as Record<string, unknown>;

  for (const key of ["message", "reply", "text", "content", "answer", "output", "result"]) {
    if (!(key in value)) continue;
    const extracted = extractAgentReply(value[key]);
    if (extracted) return extracted;
  }

  for (const key of ["data", "terminalResult", "artifact", "payload"]) {
    if (!(key in value)) continue;
    const extracted = extractAgentReply(value[key]);
    if (extracted) return extracted;
  }

  return "";
}

export function canSendAgentMessage(input: {
  message: string;
  sending: boolean;
  attachmentStatuses: string[];
}) {
  if (input.sending) return false;
  const blocked = input.attachmentStatuses.some(
    (status) => status === "preparing" || status === "uploading" || status === "failed",
  );
  if (blocked) return false;
  const uploaded = input.attachmentStatuses.some((status) => status === "uploaded");
  return input.message.trim().length > 0 || uploaded;
}

export function visibleSlice(total: number, expanded: boolean, page: number, pageSize = 15) {
  if (!expanded) return { start: 0, end: Math.min(5, total), pages: Math.max(1, Math.ceil(total / pageSize)) };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pages);
  const start = (safePage - 1) * pageSize;
  return { start, end: Math.min(start + pageSize, total), pages };
}
