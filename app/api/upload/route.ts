import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Extract text documents and stage pasted/uploaded images for the local OpenClaw worker.
// This route never OCRs images; it returns a local file reference that the agent can inspect.

export const runtime = "nodejs";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB for composer media

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File quá lớn (tối đa 15MB)" }, { status: 413 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const artifactRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Piltover", "artifacts")
    : path.join(process.cwd(), ".piltover", "artifacts");
  const ext = path.extname(name).slice(0, 16) || ".bin";
  await fs.mkdir(artifactRoot, { recursive: true });
  const localPath = path.join(artifactRoot, `${randomUUID()}${ext}`);
  await fs.writeFile(localPath, buffer);

  try {
    if (name.endsWith(".md") || name.endsWith(".markdown")) {
      return NextResponse.json({
        text: buffer.toString("utf8").trim(),
        fileName: file.name,
        mimeType: file.type || "text/markdown",
        localPath,
      });
    }
    if (name.endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: value.trim(), fileName: file.name, mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", localPath });
    }
    if (name.endsWith(".pdf")) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return NextResponse.json({ text: result.text.trim(), fileName: file.name, mimeType: file.type || "application/pdf", localPath });
    }
    if (/\.(png|jpe?g|gif|webp|bmp)$/.test(name) || file.type.startsWith("image/")) {
      return NextResponse.json({
        text: "",
        fileName: file.name,
        mimeType: file.type || "image/*",
        localPath,
      });
    }
    if (/\.(mp4|mov|m4v|webm)$/i.test(name) || file.type.startsWith("video/")) {
      return NextResponse.json({
        text: "",
        fileName: file.name,
        mimeType: file.type || "video/*",
        localPath,
      });
    }
    if (file.type.startsWith("text/") || /\.(txt|csv|json|yaml|yml|log)$/i.test(name)) {
      return NextResponse.json({
        text: buffer.toString("utf8").trim(),
        fileName: file.name,
        mimeType: file.type || "text/plain",
        localPath,
      });
    }
    return NextResponse.json(
      { error: "Hỗ trợ text/Markdown, DOCX, PDF, ảnh và video MP4/MOV/WebM." },
      { status: 415 },
    );
  } catch {
    return NextResponse.json(
      { error: "Không đọc được file — có thể file hỏng. Vui lòng nhập tay." },
      { status: 422 },
    );
  }
}
