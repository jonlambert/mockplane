import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { generateMockId } from "./mock-id";
import type { MockHandlerDefinition, MockOptions } from "./types";

const LOCK_POLL_INTERVAL_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;

/**
 * Acquires an exclusive file lock by atomically creating `lockPath`.
 * Retries every {@link LOCK_POLL_INTERVAL_MS}ms until the lock is obtained or
 * {@link LOCK_TIMEOUT_MS} is exceeded, at which point it throws with a clear
 * message. The returned function releases the lock.
 */
async function acquireLock(lockPath: string): Promise<() => Promise<void>> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      const handle = await open(lockPath, "wx");

      return async () => {
        await handle.close();
        await unlink(lockPath).catch(() => {});
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;

      if (Date.now() >= deadline) {
        throw new Error(
          `mockplane: timed out waiting for lock on ${lockPath} after ${LOCK_TIMEOUT_MS}ms. ` +
            "Ensure network.handle() calls are awaited sequentially and are not running concurrently.",
        );
      }

      await new Promise<void>((resolve) =>
        setTimeout(resolve, LOCK_POLL_INTERVAL_MS),
      );
    }
  }
}

export interface NetworkMocks {
  handle: (handler: MockHandlerDefinition) => Promise<void>;
}

/**
 * Creates a network mock builder for the current test. Each `handle()` call
 * applies immediately — no final `.commit()` needed.
 *
 * ```ts
 * const network = createMockNetwork({ page, testInfo });
 *
 * await network.handle({ url: 'https://api.example.com/posts', request: { method: 'GET' }, response: { status: 200, body: [] } });
 * await network.handle({ url: 'https://api.example.com/posts', request: { method: 'POST' }, response: { status: 201, body: { id: 1 } } });
 * ```
 *
 * Single-call shorthand:
 * ```ts
 * await createMockNetwork({ page, testInfo }).handle({ url: '...', request: { method: 'GET' }, response: { status: 200, body: [] } });
 * ```
 *
 * Registering the same URL+method more than once is supported: the latest
 * registration wins for both client-side (Playwright LIFO) and server-side
 * (MSW picks the last matching handler from the file).
 *
 * **Concurrency:** `handle()` calls are serialised per test via a per-hash
 * file lock. Concurrent calls will queue rather than race, but the recommended
 * usage is still to `await` each call sequentially.
 */
export function createMockNetwork({
  page,
  testInfo,
  options,
}: {
  page: Page;
  testInfo: TestInfo;
  options?: MockOptions;
}): NetworkMocks {
  const handlers: MockHandlerDefinition[] = [];
  const { hash, label } = generateMockId(testInfo);
  const mocksDir =
    options?.mocksDir ?? join(process.cwd(), "node_modules", ".mockplane");
  const mockFilePath = join(mocksDir, `${hash}.json`);
  const lockPath = `${mockFilePath}.lock`;
  let initialized = false;

  return {
    async handle(handler) {
      handlers.push(handler);

      const releaseLock = await acquireLock(lockPath);
      try {
        if (!initialized) {
          initialized = true;
          await page.context().addCookies([
            {
              name: "mockId",
              value: hash,
              path: "/",
              domain: "localhost",
              httpOnly: false,
              secure: false,
              sameSite: "Lax",
            },
          ]);
          await mkdir(dirname(mockFilePath), { recursive: true });
        }

        await writeFile(
          mockFilePath,
          JSON.stringify({ hash, label, handlers }, null, 2),
          "utf-8",
        );
      } finally {
        await releaseLock();
      }

      if (options?.interceptClientSide !== false) {
        await page.route(handler.url, (route) => {
          if (route.request().method() !== handler.request.method) {
            return route.continue();
          }

          return route.fulfill({
            status: handler.response.status,
            contentType: "application/json",
            body: JSON.stringify(handler.response.body),
          });
        });
      }
    },
  };
}
