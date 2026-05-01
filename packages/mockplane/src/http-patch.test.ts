import http from 'node:http';
import https from 'node:https';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockIdStore } from './store';
import { patchNodeHttp } from './http-patch';

// ---------------------------------------------------------------------------
// Strategy: spy on the module properties BEFORE patchNodeHttp wraps them.
// patchNodeHttp stores a reference to whatever is on the module at call time as
// "originalRequest / originalGet". Our spy IS that reference, so every call
// made through the patched export flows into the spy. We can then assert on
// the arguments it received.
// ---------------------------------------------------------------------------

const TEST_MOCK_ID = 'deadbeef12345678';

const fakeReq = { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };

/**
 * Runs `fn` inside the mockIdStore so patchNodeHttp sees the test's mockId.
 */
function withStore<T>(mockId: string, fn: () => T): T {
  return mockIdStore.run(mockId, fn);
}

// Spies installed before each test (before patchNodeHttp wraps them)
let httpRequestSpy: ReturnType<typeof vi.spyOn>;
let httpGetSpy: ReturnType<typeof vi.spyOn>;
let httpsRequestSpy: ReturnType<typeof vi.spyOn>;
let httpsGetSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Install spies on the raw exports first — these become the "originals" that
  // patchNodeHttp will wrap and delegate to.
  httpRequestSpy = vi.spyOn(http, 'request').mockReturnValue(fakeReq as never);
  httpGetSpy = vi.spyOn(http, 'get').mockReturnValue(fakeReq as never);
  httpsRequestSpy = vi
    .spyOn(https, 'request')
    .mockReturnValue(fakeReq as never);
  httpsGetSpy = vi.spyOn(https, 'get').mockReturnValue(fakeReq as never);

  // Now wrap with our patch — it captures the spies as its "originals"
  patchNodeHttp();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// http.request
// ---------------------------------------------------------------------------

describe('patchNodeHttp — http.request', () => {
  it('injects mockId header when options object is the first arg', () => {
    withStore(TEST_MOCK_ID, () => {
      http.request({ hostname: 'example.com', path: '/' });
    });

    const [options] = httpRequestSpy.mock.calls[0] as [http.RequestOptions];
    expect((options.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
  });

  it('preserves existing headers alongside the injected mockId', () => {
    withStore(TEST_MOCK_ID, () => {
      http.request({
        hostname: 'example.com',
        path: '/',
        headers: { Authorization: 'Bearer token' },
      });
    });

    const [options] = httpRequestSpy.mock.calls[0] as [http.RequestOptions];
    const headers = options.headers as Record<string, string>;
    expect(headers['mockId']).toBe(TEST_MOCK_ID);
    expect(headers['Authorization']).toBe('Bearer token');
  });

  it('injects mockId header when called with a string URL and a separate options object', () => {
    withStore(TEST_MOCK_ID, () => {
      http.request('http://example.com/', { method: 'POST' });
    });

    // args passed through: [url, options, ...rest]
    const [, options] = httpRequestSpy.mock.calls[0] as [
      string,
      http.RequestOptions,
    ];
    expect((options.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
  });

  it('injects mockId header when called with a string URL and only a callback (synthesises options)', () => {
    const callback = vi.fn();

    withStore(TEST_MOCK_ID, () => {
      http.request('http://example.com/', callback as never);
    });

    // patchNodeHttp rewrites args to [url, syntheticOptions, callback]
    const args = httpRequestSpy.mock.calls[0] as [
      string,
      http.RequestOptions,
      unknown,
    ];
    expect(args).toHaveLength(3);
    const [, syntheticOptions, passthroughCallback] = args;
    expect((syntheticOptions.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
    expect(passthroughCallback).toBe(callback);
  });

  it('injects mockId header when called with a URL instance and options', () => {
    withStore(TEST_MOCK_ID, () => {
      http.request(new URL('http://example.com/'), { method: 'GET' });
    });

    const [, options] = httpRequestSpy.mock.calls[0] as [
      URL,
      http.RequestOptions,
    ];
    expect((options.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
  });

  it('does NOT inject mockId header when the store is empty', () => {
    // No withStore — store is empty
    http.request({ hostname: 'example.com', path: '/' });

    const [options] = httpRequestSpy.mock.calls[0] as [http.RequestOptions];
    expect(
      (options.headers as Record<string, string> | undefined)?.['mockId'],
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// http.get
// ---------------------------------------------------------------------------

describe('patchNodeHttp — http.get', () => {
  it('injects mockId header when store is populated', () => {
    withStore(TEST_MOCK_ID, () => {
      http.get({ hostname: 'example.com', path: '/' });
    });

    const [options] = httpGetSpy.mock.calls[0] as [http.RequestOptions];
    expect((options.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
  });

  it('does NOT inject mockId header when the store is empty', () => {
    http.get({ hostname: 'example.com', path: '/' });

    const [options] = httpGetSpy.mock.calls[0] as [http.RequestOptions];
    expect(
      (options.headers as Record<string, string> | undefined)?.['mockId'],
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// https.request
// ---------------------------------------------------------------------------

describe('patchNodeHttp — https.request', () => {
  it('injects mockId header when store is populated', () => {
    withStore(TEST_MOCK_ID, () => {
      https.request({ hostname: 'example.com', path: '/' });
    });

    const [options] = httpsRequestSpy.mock.calls[0] as [https.RequestOptions];
    expect((options.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
  });

  it('does NOT inject mockId header when the store is empty', () => {
    https.request({ hostname: 'example.com', path: '/' });

    const [options] = httpsRequestSpy.mock.calls[0] as [https.RequestOptions];
    expect(
      (options.headers as Record<string, string> | undefined)?.['mockId'],
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// https.get
// ---------------------------------------------------------------------------

describe('patchNodeHttp — https.get', () => {
  it('injects mockId header when store is populated', () => {
    withStore(TEST_MOCK_ID, () => {
      https.get({ hostname: 'example.com', path: '/' });
    });

    const [options] = httpsGetSpy.mock.calls[0] as [https.RequestOptions];
    expect((options.headers as Record<string, string>)['mockId']).toBe(
      TEST_MOCK_ID,
    );
  });

  it('does NOT inject mockId header when the store is empty', () => {
    https.get({ hostname: 'example.com', path: '/' });

    const [options] = httpsGetSpy.mock.calls[0] as [https.RequestOptions];
    expect(
      (options.headers as Record<string, string> | undefined)?.['mockId'],
    ).toBeUndefined();
  });
});
