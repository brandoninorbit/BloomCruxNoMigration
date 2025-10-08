/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Hoisted mock so dynamic import('next/headers') inside fetchWithAuth
// receives this mock during tests.
vi.mock('next/headers', () => {
  return {
    cookies: () => ({
      getAll: () => [
        { name: 'sb:token', value: 'fake-token' },
        { name: 'other', value: 'x' },
      ],
    }),
  };
});

// Use dynamic import to test server branch of fetchWithAuth
describe('fetchWithAuth (server-side cookie forwarding)', () => {
  let originalFetch: typeof global.fetch | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (originalFetch) global.fetch = originalFetch;
  });

  it('forwards cookies as cookie header on server', async () => {
    // Force server-side branch by removing `window` from global scope so
    // `typeof window === 'undefined'` is true in the module under test.
  // Use globalThis to access the global window if present. Cast to any to avoid `any`.
  const originalWindow = (globalThis as any).window;
    try {
      // Simulate server environment by setting window to undefined. Some test
      // runners define a read-only window; assigning undefined is more robust
      // than deleting the property.
  (globalThis as any).window = undefined;
    // Mock global.fetch and capture headers
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fetchMock = vi.fn(async (_input: RequestInfo, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    // assign to global.fetch with a cast to avoid TS errors in the test
    (global as any).fetch = fetchMock;

    // Import the function under test (after mocking next/headers)
    const mod = await import('@/lib/supabase/fetchWithAuth');
  const { fetchWithAuth } = mod as { fetchWithAuth: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };

    await fetchWithAuth('http://example.local/test', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalled();
  const calledArgs = fetchMock.mock.calls[0] as [RequestInfo, RequestInit | undefined];
  const passedInit = calledArgs[1];
    const headersInit = passedInit?.headers as any;
    let cookieHeader: string | null = null;
    if (headersInit instanceof Headers) {
      cookieHeader = headersInit.get('cookie');
    } else if (headersInit && typeof headersInit === 'object') {
      // Could be a plain object of header entries
      const asObj = headersInit as Record<string, unknown>;
      if (typeof asObj['cookie'] === 'string') cookieHeader = asObj['cookie'] as string;
      // Could be an array of tuples or array-like; try to stringify
      if (!cookieHeader) {
        try {
          const maybe = JSON.stringify(asObj);
          if (maybe.includes('sb:token')) cookieHeader = maybe;
        } catch {}
      }
    }
          // If headers is a Headers instance, convert to object for easier inspection
        if (passedInit && (passedInit as any).headers instanceof Headers) {
            // nothing; kept for parity when debugging locally
          }

  expect(cookieHeader).toBeTruthy();
  expect(String(cookieHeader)).toContain('sb:token=fake-token');
  expect(String(cookieHeader)).toContain('other=x');
    } finally {
      // restore global.window
  if (originalWindow !== undefined) (globalThis as any).window = originalWindow;
    }
  });
});
