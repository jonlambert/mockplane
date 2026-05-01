import http from 'node:http';
import https from 'node:https';
import { mockIdStore } from './store';

type AnyFn = (...args: unknown[]) => unknown;

/**
 * Injects `mockId` into the headers of a `node:http` / `node:https` request
 * call, handling all three overloads:
 *
 *   mod.request(options, callback?)
 *   mod.request(url, callback?)
 *   mod.request(url, options, callback?)
 *
 * When the `(url, callback?)` form is used there is no options object to
 * mutate, so we synthesise one and rewrite the arguments so the header is
 * still forwarded.
 *
 * Returns the (potentially rewritten) args tuple ready to be spread into the
 * original function.
 */
function injectMockIdHeader(mockId: string, args: unknown[]): unknown[] {
  const [first, second] = args;

  const isUrlArg = typeof first === 'string' || first instanceof URL;

  if (isUrlArg) {
    if (
      second !== null &&
      typeof second === 'object' &&
      !Array.isArray(second)
    ) {
      // mod.request(url, options, callback?) — mutate existing options object
      const opts = second as Record<string, unknown>;
      opts['headers'] = { ...(opts['headers'] as object | undefined), mockId };
    } else {
      // mod.request(url, callback?) — no options object; synthesise one and
      // insert it between the url and the (optional) callback
      const syntheticOptions = { headers: { mockId } };
      return [first, syntheticOptions, ...args.slice(1)];
    }
  } else if (first !== null && typeof first === 'object') {
    // mod.request(options, callback?) — mutate the options object directly
    const opts = first as Record<string, unknown>;
    opts['headers'] = { ...(opts['headers'] as object | undefined), mockId };
  }

  return args;
}

function patchHttpModule(mod: typeof http | typeof https): void {
  const originalRequest = mod.request as AnyFn;
  const originalGet = mod.get as AnyFn;

  (mod as Record<string, unknown>)['request'] = (...args: unknown[]) => {
    const mockId = mockIdStore.getStore();
    const finalArgs = mockId ? injectMockIdHeader(mockId, args) : args;
    return originalRequest(...finalArgs);
  };

  (mod as Record<string, unknown>)['get'] = (...args: unknown[]) => {
    const mockId = mockIdStore.getStore();
    const finalArgs = mockId ? injectMockIdHeader(mockId, args) : args;
    return originalGet(...finalArgs);
  };
}

/**
 * Patches `node:http` and `node:https` to automatically forward the `mockId`
 * header on every outgoing request when one is present in the current async
 * context (populated by `withMockplaneContext`).
 *
 * This covers libraries — such as **axios** — that bypass `globalThis.fetch`
 * and call `node:http`/`node:https` directly. Use it alongside `patchFetch`
 * to ensure all outgoing requests carry the `mockId` header.
 *
 * **Call order matters:** `patchNodeHttp` must be called *after* `startServer`
 * so that our wrapper sits outermost in the call chain and injects the header
 * before MSW's own interceptor processes the request.
 *
 * ```ts
 * if (process.env.MOCKPLANE === 'true') {
 *   const { startServer, patchFetch, patchNodeHttp } = await import('mockplane')
 *   startServer()   // MSW wraps http.request
 *   patchFetch()
 *   patchNodeHttp() // our wrapper wraps MSW's wrapper — runs first
 * }
 * ```
 *
 * The async context is shared with `patchFetch`, so a single
 * `withMockplaneContext` call in your server entry point covers both.
 */
export function patchNodeHttp(): void {
  patchHttpModule(http);
  patchHttpModule(https);
}
