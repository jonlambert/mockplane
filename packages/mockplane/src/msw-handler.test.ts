import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMswHandler } from './msw-handler';
import type { MockFile } from './types';

// ---------------------------------------------------------------------------
// fs/promises mock — controls what "mock files on disk" look like per test
// ---------------------------------------------------------------------------

const mockFileStore = new Map<string, MockFile>();

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi
    .fn()
    .mockImplementation(async () =>
      [...mockFileStore.keys()].map((k) => `${k}.json`),
    ),
  readFile: vi.fn().mockImplementation(async (filePath: string) => {
    const hash = filePath.split('/').pop()?.replace('.json', '');
    const file = hash ? mockFileStore.get(hash) : undefined;
    if (!file) throw new Error(`ENOENT: ${filePath}`);
    return JSON.stringify(file);
  }),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_HASH = 'abc123';
const MOCKS_DIR = '/tmp/mockplane';

function makeMockFile(handlers: MockFile['handlers']): MockFile {
  return { hash: TEST_HASH, label: 'Test file - test title', handlers };
}

function makeRequest(
  url: string,
  method = 'GET',
  headers: Record<string, string> = {},
): Request {
  return new Request(url, {
    method,
    headers: { mockId: TEST_HASH, ...headers },
  });
}

async function invokeHandler(request: Request): Promise<Response | undefined> {
  const handler = createMswHandler({
    mocksDir: MOCKS_DIR,
    resultsDir: '/tmp/results',
  });

  // The resolver is the async function passed to http.all(). We call it directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (handler as any).resolver({ request });
  return response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFileStore.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  mockFileStore.clear();
});

describe('createMswHandler — no mock context', () => {
  it('returns undefined (pass-through) when there is no mockId header', async () => {
    const request = new Request('https://example.com/posts', { method: 'GET' });
    const result = await invokeHandler(request);
    expect(result).toBeUndefined();
  });
});

describe('createMswHandler — exact URL matching (existing behaviour)', () => {
  it('returns the mocked response for an exact URL match', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts',
          request: { method: 'GET' },
          response: { status: 200, body: [{ id: 1, title: 'Hello' }] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts'),
    );
    expect(response?.status).toBe(200);
    const body = await response?.json();
    expect(body).toEqual([{ id: 1, title: 'Hello' }]);
  });

  it('returns a leaked-request 500 when no handler matches the URL', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/comments'),
    );
    expect(response?.status).toBe(500);
    const body = await response?.json();
    expect(body).toEqual({ error: 'Leaked request' });
  });

  it('does not match when the HTTP method differs', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts',
          request: { method: 'POST' },
          response: { status: 201, body: { id: 99 } },
        },
      ]),
    );

    // GET request, but handler is POST — should be a leaked request
    const response = await invokeHandler(
      makeRequest('https://example.com/posts', 'GET'),
    );
    expect(response?.status).toBe(500);
  });

  it('matches a URL with an exact query string', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts?_limit=5',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts?_limit=5'),
    );
    expect(response?.status).toBe(200);
  });

  it('does not match when the query string differs', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts?_limit=5',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts?_limit=10'),
    );
    expect(response?.status).toBe(500);
  });
});

describe('createMswHandler — ** wildcard (crosses slashes)', () => {
  it('matches any path under a host with **', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/**',
          request: { method: 'GET' },
          response: { status: 200, body: { ok: true } },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts'),
    );
    expect(response?.status).toBe(200);

    const response2 = await invokeHandler(
      makeRequest('https://example.com/v1/users/42'),
    );
    expect(response2?.status).toBe(200);
  });

  it('does not match a different host', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/**',
          request: { method: 'GET' },
          response: { status: 200, body: {} },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://other.com/posts'),
    );
    expect(response?.status).toBe(500);
  });

  it('matches with a leading ** (crosses ://)', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: '**/posts',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts'),
    );
    expect(response?.status).toBe(200);

    const response2 = await invokeHandler(
      makeRequest('https://api.example.com/v1/posts'),
    );
    expect(response2?.status).toBe(200);
  });
});

describe('createMswHandler — * wildcard (single segment only)', () => {
  it('matches a single path segment', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/users/*',
          request: { method: 'GET' },
          response: { status: 200, body: { id: 1 } },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/users/42'),
    );
    expect(response?.status).toBe(200);
  });

  it('does not cross a slash with *', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/users/*',
          request: { method: 'GET' },
          response: { status: 200, body: {} },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/users/42/posts'),
    );
    expect(response?.status).toBe(500);
  });
});

describe('createMswHandler — {a,b} alternation', () => {
  it('matches either protocol alternative', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: '{http,https}://example.com/posts',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const responseHttp = await invokeHandler(
      makeRequest('http://example.com/posts'),
    );
    expect(responseHttp?.status).toBe(200);

    const responseHttps = await invokeHandler(
      makeRequest('https://example.com/posts'),
    );
    expect(responseHttps?.status).toBe(200);
  });
});

describe('createMswHandler — ? as a literal query string separator', () => {
  it('matches any query string when using ?**', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts?**',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts?page=1&limit=5'),
    );
    expect(response?.status).toBe(200);
  });

  it('does not match a URL without a query string when ? is required', async () => {
    mockFileStore.set(
      TEST_HASH,
      makeMockFile([
        {
          url: 'https://example.com/posts?**',
          request: { method: 'GET' },
          response: { status: 200, body: [] },
        },
      ]),
    );

    const response = await invokeHandler(
      makeRequest('https://example.com/posts'),
    );
    expect(response?.status).toBe(500);
  });
});
