import { getTaskManager } from "../../../_task-manager";

type RouteContext = { params: Promise<{ taskId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let sending = false;
      let pending = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let unsubscribe: (() => void) | undefined;

      const close = () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
      };
      cleanup = close;

      const enqueue = (payload: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          close();
          return false;
        }
      };

      const send = async () => {
        if (closed) return;
        if (sending) {
          pending = true;
          return;
        }
        sending = true;
        try {
          do {
            pending = false;
            const task = await getTaskManager().getTask(taskId);
            if (!enqueue(`data: ${JSON.stringify({ task })}\n\n`)) return;
          } while (pending && !closed);
        } catch (error) {
          enqueue(`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
        } finally {
          sending = false;
        }
      };
      unsubscribe = getTaskManager().subscribe(() => { void send(); });
      void send();
      heartbeat = setInterval(() => {
        enqueue(`: ping\n\n`);
      }, 15000);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
