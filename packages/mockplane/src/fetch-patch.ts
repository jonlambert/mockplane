import { mockIdStore, parseMockIdFromCookie } from './store';

/**
 * Patches the global `fetch` to automatically forward the `mockId` header on
 * every outgoing request when one is present in the current async context.
 *
 * Call once at server boot when `MOCKPLANE=true`, before handling any requests:
 *
 * ```ts
 * import { patchFetch } from 'mockplane'
 * patchFetch()
 * ```
 *
 * Must be used alongside `withMockplaneContext` to populate the async context
 * per incoming request.
 */
export function patchFetch(): void {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const mockId = mockIdStore.getStore();
    if (!mockId) return original(input, init);
    const headers = new Headers(init?.headers);
    headers.set('mockId', mockId);
    return original(input, { ...init, headers });
  };
}

/**
 * Wraps an incoming request handler with the mock async context, making the
 * `mockId` cookie value available to `patchFetch`'s global fetch override for
 * the duration of the request.
 *
 * If you are also using `patchNodeHttp`, this single wrapper covers both —
 * there is no separate context function needed for node:http.
 *
 * ```ts
 * // src/server.ts
 * createServerEntry({
 *   fetch(request) {
 *     return withMockplaneContext(request, () => handler.fetch(request))
 *   }
 * })
 * ```
 */
export function withMockplaneContext(
  request: Request,
  fn: () => unknown,
): unknown {
  const mockId = parseMockIdFromCookie(request);

  if (!mockId) return fn();

  return mockIdStore.run(mockId, fn);
}
