import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Shared AsyncLocalStorage store that holds the current test's `mockId` for
 * the duration of a single incoming server request.
 *
 * Both `patchFetch` and `patchNodeHttp` read from this store, so requests made
 * via `globalThis.fetch` and requests made via `node:http`/`node:https` (e.g.
 * axios) both receive the `mockId` header automatically from a single
 * `withMockplaneContext` call.
 */
export const mockIdStore = new AsyncLocalStorage<string>();

/**
 * Parses the `mockId` cookie value from an incoming Web `Request`.
 */
export function parseMockIdFromCookie(request: Request): string | undefined {
  const cookie = request.headers.get('cookie') ?? '';
  return (
    cookie
      .split(';')
      .find((c) => c.trim().startsWith('mockId='))
      ?.split('=')[1] ?? undefined
  );
}
