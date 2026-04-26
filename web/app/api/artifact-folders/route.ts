import { NextRequest, NextResponse } from "next/server";
import { getTaskManager } from "../_task-manager";

export async function GET() {
  const folders = await getTaskManager().listArtifactFolders();
  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string };
    const folders = await getTaskManager().createArtifactFolder(body.name ?? "");
    return NextResponse.json({ folders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
