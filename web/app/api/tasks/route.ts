import { NextRequest, NextResponse } from "next/server";
import { getTaskManager } from "../_task-manager";

export async function GET() {
  const tasks = await getTaskManager().listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title?: string; workflow?: string; prompt?: string };
    const task = await getTaskManager().createTask({
      title: body.title,
      workflow: body.workflow,
      prompt: body.prompt ?? "",
    });
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
