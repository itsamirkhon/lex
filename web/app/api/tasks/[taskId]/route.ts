import { NextResponse } from "next/server";
import { getTaskManager } from "../../_task-manager";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const task = await getTaskManager().getTask(taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    await getTaskManager().deleteTask(taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
