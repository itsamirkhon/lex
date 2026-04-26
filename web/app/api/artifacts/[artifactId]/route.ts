import { NextRequest, NextResponse } from "next/server";
import { getTaskManager } from "../../_task-manager";

type RouteContext = { params: Promise<{ artifactId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { artifactId } = await context.params;
    const body = await req.json() as { folder?: string; name?: string };
    await getTaskManager().updateArtifact(artifactId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { artifactId } = await context.params;
    await getTaskManager().deleteArtifact(artifactId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
