# Mockplane

Intercept and mock both server-side and client-side requests in your Playwright tests.

Playwright supports native interception and mocking of outbound network requests from the browser. This is super useful for client-side requests, but what about requests made by the server? Modern Next.js/TanStack Start apps make use of SSR, server functions, React Server Components, etc. We need a way to mock requests made both the backend and frontend.

This is where Mockplane comes in.

Mockplane allows you to define per-test request mocks. Then, *requests will be intercepted on both the client-side and the server-side*. Mocks are scoped to the test, so can safely be run in parallel.

## Example

```ts
test('renders posts', async ({ page }, testInfo) => {
  // 1. Create your network
  const network = createMockNetwork({ page, testInfo });

  // 2. Define your handlers
  network.handle({
    url: 'https://api.example.com/posts',
    request: { method: 'GET' },
    response: {
      status: 200,
      body: [
        { id: 1, title: 'Post 1', body: 'Body 1' },
        { id: 2, title: 'Post 2', body: 'Body 2' },
      ],
    },
  });

  // 3. Commit handlers
  await network.commit();

  await page.goto('http://localhost:3000/');

  await expect(page.getByRole('heading', { name: 'Post 1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Post 2' })).toBeVisible();
});
```

## Installation

```sh
pnpm add -D mockplane
```

Install peer dependencies:

```sh
pnpm add -D msw playwright @playwright/test
```

## Setup

### 1. Initialise in your server entry point

Call `startServer`, `patchFetch`, and (if your app uses axios or any other library that bypasses `globalThis.fetch`) `patchNodeHttp` when `MOCKPLANE=true`, then wrap each incoming request with `withMockplaneContext`. The example below is for **TanStack Start**:

```ts
// src/server.ts

import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

if (process.env.MOCKPLANE === 'true') {
  const { startServer, patchFetch, patchNodeHttp } = await import('mockplane');
  startServer();
  patchFetch();
  patchNodeHttp();
}

export default createServerEntry({
  async fetch(request) {
    if (process.env.MOCKPLANE === 'true') {
      const { withMockplaneContext } = await import('mockplane');
      return withMockplaneContext(request, () => handler.fetch(request)) as Promise<Response>;
    }
    return handler.fetch(request);
  },
});
```

#### Already using MSW?

If you already have an MSW server set up, use `createMswHandler` directly and add it to your existing server instead of calling `startServer`:

```ts
import { setupServer } from 'msw/node';
import { createMswHandler } from 'mockplane';

export const server = setupServer(
  createMswHandler(),
  ...yourExistingHandlers,
);

server.listen();
```

Then call `patchFetch` and `withMockplaneContext` as normal — just skip `startServer`.

### 2. Add a Playwright teardown file

Mockplane's teardown checks for any requests that leaked to the real network or sent unexpected headers, failing the suite if either occurred.

```ts
// tests/utils/global-teardown.ts
import { teardown } from 'mockplane';

export default function () {
  return teardown();
}
```

### 3. Configure Playwright

In your Playwright config, start your dev server with `MOCKPLANE=true` and point `globalTeardown` at the file above:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalTeardown: './tests/utils/global-teardown.ts',
  webServer: {
    command: 'MOCKPLANE=true pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4. Write your tests

See the [example test](#example) above!

## How does Mockplane work?

When you define mock handlers in your tests using Mockplane, the handlers are serialised and written to a file linked to your unique test ID.

All outbound requests made by the browser will then contain a cookie containing that test ID.

Playwright will boot your app with `MOCKPLANE=true`. Your app will check for that flag, and if present, it will extract the cookie containing the test ID from the request and use it to patch all upstream outbound fetch calls. MSW will then intercept all outbound requests made by the app, extract the test ID from the context, and use it to load and serve your mock handlers for that test.

## Why the name?

"Mockplane" is inspired by the "control plane" concept from networking and Kubernetes: an abstract layer that sits across your infrastructure. Mockplane is that layer for your network requests: a single plane of control that spans both server-side and client-side, deciding what every request sees instead of the real network.

## Acknowledgements

The cookie-forwarding and MSW interception pattern used in Mockplane expands upon Raphael Rafatpanah's great article: [The Server-Side Mocking Gap Nobody Talks About](https://dev.to/rrafatpanah/the-server-side-mocking-gap-nobody-talks-about-36jb), and [demo repository](https://github.com/persianturtle/playwright-with-per-test-server-side-mocks).
