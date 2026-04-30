import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INCORRECT_REQUEST_PREFIX } from './msw-handler';
import type { MockOptions } from './types';

/**
 * Reads `test-results/leaked-requests.txt` and any
 * `test-results/incorrect-request-*.txt` files, throwing if either is
 * non-empty. Call from your Playwright global teardown file:
 *
 * ```ts
 * // tests/utils/global-teardown.ts
 * import { teardown } from 'mockplane';
 *
 * export default function () {
 *   return teardown();
 * }
 * ```
 */
export async function teardown(options?: MockOptions): Promise<void> {
  const resultsDir = options?.resultsDir ?? join(process.cwd(), 'test-results');

  // Check for leaked requests
  try {
    const content = await readFile(
      join(resultsDir, 'leaked-requests.txt'),
      'utf-8',
    );
    if (content.length > 0) {
      throw new Error('Leaked requests detected:\n' + content);
    }
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error;
    }
  }

  // Check for incorrect request headers
  try {
    const files = await readdir(resultsDir);
    const incorrectFiles = files.filter((file) =>
      file.startsWith(INCORRECT_REQUEST_PREFIX),
    );
    if (incorrectFiles.length > 0) {
      throw new Error(
        'Incorrect request headers detected. See test-results/ for details.',
      );
    }
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error;
    }
  }
}
