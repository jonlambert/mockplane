import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { generateMockId } from './mock-id';
import type { MockHandlerDefinition, MockOptions } from './types';

async function applyHandlers({
  page,
  testInfo,
  handlers,
  options,
}: {
  page: Page;
  testInfo: TestInfo;
  handlers: MockHandlerDefinition[];
  options?: MockOptions;
}): Promise<void> {
  const mocksDir = options?.mocksDir ?? join(process.cwd(), 'node_modules', '.mockplane');
  const { hash, label } = generateMockId(testInfo);

  await page.context().addCookies([
    {
      name: 'mockId',
      value: hash,
      path: '/',
      domain: 'localhost',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  const mockFilePath = join(mocksDir, `${hash}.json`);

  await mkdir(dirname(mockFilePath), { recursive: true });
  await writeFile(mockFilePath, JSON.stringify({ hash, label, handlers }, null, 2), 'utf-8');

  if (options?.interceptClientSide !== false) {
    for (const handler of handlers) {
      await page.route(handler.url, (route) => {
        if (route.request().method() !== handler.request.method) {
          return route.continue();
        }
        return route.fulfill({
          status: handler.response.status,
          contentType: 'application/json',
          body: JSON.stringify(handler.response.body),
        });
      });
    }
  }
}

export interface NetworkMocks {
  handle: (handler: MockHandlerDefinition) => NetworkMocks;
  commit: () => Promise<void>;
}

/**
 * Creates a chainable network mock builder for the current test.
 *
 * ```ts
 * const network = createMockNetwork({ page, testInfo });
 *
 * await network
 *   .handle({ url: 'https://api.example.com/posts', request: { method: 'GET' }, response: { status: 200, body: [] } })
 *   .handle({ url: 'https://api.example.com/posts', request: { method: 'POST' }, response: { status: 201, body: { id: 1 } } })
 *   .commit();
 * ```
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

  const network: NetworkMocks = {
    handle(handler) {
      handlers.push(handler);
      return network;
    },
    commit() {
      return applyHandlers({ page, testInfo, handlers, options });
    },
  };

  return network;
}
