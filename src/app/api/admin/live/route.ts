import { subscribeToAdminChanges } from "@/lib/admin-live";
import { getAdminSession } from "@/lib/auth";

const headers = { "Cache-Control": "private, no-store, no-transform" };
const heartbeatMs = 15_000;
const connectionMs = 60_000;
const encoder = new TextEncoder();

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return new Response(null, { status: 401, headers });
  const { isActive } = session;

  const topic = new URL(request.url).searchParams.get("topic");
  if (topic !== "analytics" && topic !== "widgets") {
    return new Response(null, { status: 400, headers });
  }

  let cancel: () => void;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      function send(message: string) {
        if (closed) return;
        try {
          // Keep the authorization check and delivery in the same synchronous turn.
          if (!isActive()) {
            close();
            return;
          }
          if ((controller.desiredSize ?? 0) > 0) {
            controller.enqueue(encoder.encode(message));
          }
        } catch {
          close();
        }
      }

      const unsubscribe = subscribeToAdminChanges((change) => {
        if (change.topic === topic || topic === "analytics") {
          send(`event: change\ndata: ${change.widgetId}\n\n`);
        }
      });
      const heartbeat = setInterval(() => send(": heartbeat\n\n"), heartbeatMs);
      const timeout = setTimeout(close, connectionMs);

      function cleanup() {
        if (closed) return false;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", close);
        return true;
      }

      function close() {
        if (cleanup()) controller.close();
      }

      cancel = cleanup;
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) close();
      else send("retry: 2000\nevent: ready\ndata: connected\n\n");
    },
    cancel() { cancel(); },
  });

  return new Response(stream, {
    headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8" },
  });
}
