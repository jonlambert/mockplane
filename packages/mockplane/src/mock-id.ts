import { createHash } from 'node:crypto';
import type { TestInfo } from '@playwright/test';

export interface MockId {
  /** Short SHA-256 hash used as the filename and cookie value. */
  hash: string;
  /** Human-readable test identifier stored in the mock file for debuggability. */
  label: string;
}

/**
 * Generates a stable, filesystem-safe mock ID for a given test.
 * The hash is derived from the test's file path and title, which Playwright
 * guarantees to be unique across the suite.
 */
export function generateMockId(testInfo: TestInfo): MockId {
  const label = `${testInfo.file} - ${testInfo.title}`;
  const hash = createHash('sha256').update(label).digest('hex').slice(0, 16);
  return { hash, label };
}
