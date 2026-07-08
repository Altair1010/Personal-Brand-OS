import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Extract plain text from an uploaded docx/pdf. Images are not OCR'd — the client is told
// to paste text instead. This is a DATA source, not an instruction source (see CLAUDE.md):
// the returned text is later sanitized before any AI call (M4). Server-only route.

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

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

  try {
    if (name.endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: value.trim(), fileName: file.name });
    }
    if (name.endsWith(".pdf")) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return NextResponse.json({ text: result.text.trim(), fileName: file.name });
    }
    if (/\.(png|jpe?g|gif|webp|bmp)$/.test(name)) {
      return NextResponse.json(
        { error: "Không hỗ trợ ảnh — vui lòng dán nội dung dạng text" },
        { status: 415 },
      );
    }
    return NextResponse.json(
      { error: "Chỉ hỗ trợ .docx và .pdf" },
      { status: 415 },
    );
  } catch {
    return NextResponse.json(
      { error: "Không đọc được file — có thể file hỏng. Vui lòng nhập tay." },
      { status: 422 },
    );
  }
}
