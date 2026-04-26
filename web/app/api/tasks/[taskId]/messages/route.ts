import { NextRequest, NextResponse } from "next/server";
import { getTaskManager } from "../../../_task-manager";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const body = await req.json() as { message?: string; pendingResponse?: string | boolean; cancelled?: boolean };
    const task = await getTaskManager().sendMessage(taskId, body);
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
