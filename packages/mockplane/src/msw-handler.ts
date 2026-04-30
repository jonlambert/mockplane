import { deepStrictEqual } from 'node:assert';
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { MockFile, MockOptions } from './types';

export const INCORRECT_REQUEST_PREFIX = 'incorrect-request';

export function createMswHandler(options?: MockOptions) {
  const mocksDir = options?.mocksDir ?? join(process.cwd(), 'node_modules', '.mockplane');
  const resultsDir = options?.resultsDir ?? join(process.cwd(), 'test-results');

  async function ensureResultsDir() {
    await mkdir(resultsDir, { recursive: true });
  }

  return http.all('*', async ({ request }) => {
    const hash = request.headers.get('mockId');

    /**
     * If there's no hash, this request is likely coming from outside of the
     * test suite (e.g. an existing tab polling localhost). Pass it through.
     *
     * Clear the mockId cookie from localhost before running the test suite to
     * avoid false leaked-request errors from non-test traffic.
     */
    if (!hash) {
      return;
    }

    const fileName = `${hash}.json`;

    let files: string[];
    try {
      files = await readdir(mocksDir);
    } catch {
      // mocks directory doesn't exist yet — treat as leaked request
      files = [];
    }

    const matchingFile = files.find((file) => file === fileName);

    if (matchingFile) {
      const filePath = join(mocksDir, matchingFile);
      const fileContents = await readFile(filePath, 'utf-8');
      const { label, handlers } = JSON.parse(fileContents) as MockFile;

      const handler = handlers.find(
        (h) => h.request.method === request.method && h.url === request.url,
      );

      if (handler) {
        if (handler.request.headers) {
          const handlerHeaderKeys = Object.keys(handler.request.headers)
            .map((key) => key.toLowerCase())
            .sort();

          const requestHeaderKeys = Object.keys(Object.fromEntries(request.headers.entries()))
            .map((key) => key.toLowerCase())
            .filter((key) => key !== 'mockid')
            .sort();

          try {
            deepStrictEqual(requestHeaderKeys, handlerHeaderKeys);
          } catch (error) {
            await ensureResultsDir();
            await appendFile(
              join(resultsDir, `${INCORRECT_REQUEST_PREFIX}-${hash}.txt`),
              `${JSON.stringify(
                {
                  label,
                  type: 'headers',
                  url: request.url,
                  actual: requestHeaderKeys,
                  expected: handlerHeaderKeys,
                  error: error instanceof Error ? error.message : String(error),
                },
                null,
                2,
              )}\n\n`,
              'utf-8',
            );
          }
        }

        return new HttpResponse(JSON.stringify(handler.response.body), {
          status: handler.response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    await ensureResultsDir();
    await appendFile(
      join(resultsDir, 'leaked-requests.txt'),
      `${request.url} initiated by ${hash}\n`,
      'utf-8',
    );

    return new HttpResponse(JSON.stringify({ error: 'Leaked request' }), {
      status: 500,
    });
  });
}

/**
 * Creates and starts an MSW server to intercept server-side requests during
 * Playwright tests. Call once at server boot when `MOCKPLANE=true`.
 *
 * ```ts
 * import { startServer } from 'mockplane'
 * startServer()
 * ```
 *
 * If you need to provide your own MSW server instance, use `createMswHandler`
 * directly:
 *
 * ```ts
 * import { setupServer } from 'msw/node'
 * import { createMswHandler } from 'mockplane'
 *
 * const server = setupServer(createMswHandler(), ...yourOtherHandlers)
 * server.listen()
 * ```
 */
export function startServer(options?: MockOptions): void {
  const server = setupServer(createMswHandler(options));
  server.listen();
}
