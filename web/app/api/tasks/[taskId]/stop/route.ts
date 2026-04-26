import { NextResponse } from "next/server";
import { getTaskManager } from "../../../_task-manager";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { taskId } = await context.params;
  await getTaskManager().stopTask(taskId);
  return NextResponse.json({ ok: true });
}
