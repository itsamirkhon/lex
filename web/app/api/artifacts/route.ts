import { NextRequest, NextResponse } from "next/server";
import { getTaskManager } from "../_task-manager";

export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") ?? undefined;
  const artifacts = await getTaskManager().listArtifacts(folder);
  return NextResponse.json({ artifacts });
}
