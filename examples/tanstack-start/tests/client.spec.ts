import { expect, test } from "@playwright/test";
import type { Todo } from "@/routes/client";
import { createMockNetwork } from "mockplane";

const todosA: Todo[] = [
  { id: 1, title: "Mock Todo 1", completed: false },
  { id: 2, title: "Mock Todo 2", completed: true },
  { id: 3, title: "Mock Todo 3", completed: false },
];

const todosB: Todo[] = [
  { id: 4, title: "Override Todo 4", completed: false },
  { id: 5, title: "Override Todo 5", completed: true },
];

/**
 * Client-side: the browser makes a direct fetch to jsonplaceholder.
 * Intercepted by page.route() — MSW never sees it.
 */
test("client-side: page.route() intercepts browser fetch", async ({
  page,
}, testInfo) => {
  await createMockNetwork({ page, testInfo }).handle({
    url: "https://jsonplaceholder.typicode.com/todos?_limit=3",
    request: { method: "GET" },
    response: { status: 200, body: todosA },
  });

  await page.goto("/client");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Load Todos" }).click();

  for (const todo of todosA) {
    await expect(page.getByText(todo.title)).toBeVisible();
  }
});

/**
 * Same-URL override: register /todos → todosA, assert, then re-register /todos → todosB.
 * The latest registration wins for both client-side (Playwright LIFO) and
 * server-side (MSW findLast).
 */
test("client-side: later handle() overrides earlier for same URL", async ({
  page,
}, testInfo) => {
  const network = createMockNetwork({ page, testInfo });

  await network.handle({
    url: "https://jsonplaceholder.typicode.com/todos?_limit=3",
    request: { method: "GET" },
    response: { status: 200, body: todosA },
  });

  await page.goto("/client");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Load Todos" }).click();

  for (const todo of todosA) {
    await expect(page.getByText(todo.title)).toBeVisible();
  }

  // Re-register the same URL with different data — this should override.
  await network.handle({
    url: "https://jsonplaceholder.typicode.com/todos?_limit=3",
    request: { method: "GET" },
    response: { status: 200, body: todosB },
  });

  await page.getByRole("button", { name: "Load Todos" }).click();

  for (const todo of todosB) {
    await expect(page.getByText(todo.title)).toBeVisible();
  }
  // todosA titles should no longer be visible
  for (const todo of todosA) {
    await expect(page.getByText(todo.title)).not.toBeVisible();
  }
});

/**
 * Server-side: the server fetches via createServerFn; MSW intercepts using mockId.
 * page.route() is also set up for the same URL but the browser never calls it directly.
 */
test("server-side: MSW intercepts createServerFn fetch", async ({
  page,
}, testInfo) => {
  const posts = [
    { id: 1, title: "Post 1", body: "Body 1", userId: 1 },
    { id: 2, title: "Post 2", body: "Body 2", userId: 2 },
  ];

  await createMockNetwork({ page, testInfo }).handle({
    url: "https://jsonplaceholder.typicode.com/posts?_limit=5",
    request: { method: "GET" },
    response: { status: 200, body: posts },
  });

  await page.goto("/");

  for (const post of posts) {
    await expect(page.getByText(post.title)).toBeVisible();
    await expect(page.getByText(post.body)).toBeVisible();
  }
});
