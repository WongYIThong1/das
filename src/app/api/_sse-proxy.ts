/**
 * Wraps an upstream SSE body in a ReadableStream that:
 * - Pipes events to the client as-is
 * - Closes the client stream cleanly when the backend closes (normal or abrupt)
 *   instead of letting Next.js log "failed to pipe response" and return 500
 * - Cancels the upstream read when the client disconnects
 */
export function makeSseResponse(upstreamBody: ReadableStream<Uint8Array>, signal: AbortSignal): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();

      // If the client disconnects, abort the upstream read.
      const onAbort = () => { reader.cancel().catch(() => {}); };
      signal.addEventListener('abort', onAbort, { once: true });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        // Backend closed the connection abruptly (UND_ERR_SOCKET, etc.).
        // Close the client stream cleanly — no 500, no error log.
      } finally {
        signal.removeEventListener('abort', onAbort);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
