import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_ROOT = resolve(process.env.LEX_WORKSPACE_ROOT ?? resolve(process.cwd(), ".."));

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const uploadsDir = resolve(PROJECT_ROOT, "outputs", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const filename = (file as File).name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = resolve(uploadsDir, filename);
  const buffer = Buffer.from(await (file as File).arrayBuffer());
  await writeFile(dest, buffer);

  const relativePath = `outputs/uploads/${filename}`;
  return NextResponse.json({ path: relativePath, filename });
}
