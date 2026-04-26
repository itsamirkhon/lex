import { NextResponse } from "next/server";
import { getTaskManager } from "../../../_task-manager";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    await getTaskManager().archiveTask(taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
