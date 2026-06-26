import { expect, test } from "@playwright/test";
import type { Post } from "@/routes/index";
import { createMockNetwork } from "mockplane";

test("renders posts", async ({ page }, testInfo) => {
  const posts: Post[] = [
    { id: 1, title: "Post 1", body: "Body 1", userId: 1 },
    { id: 2, title: "Post 2", body: "Body 2", userId: 2 },
  ];

  const network = createMockNetwork({ page, testInfo });
  await network.handle({
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

test("creates a post", async ({ page }, testInfo) => {
  const network = createMockNetwork({ page, testInfo });
  await network.handle({
    url: "https://jsonplaceholder.typicode.com/posts?_limit=5",
    request: { method: "GET" },
    response: { status: 200, body: [] },
  });
  await network.handle({
    url: "https://jsonplaceholder.typicode.com/posts",
    request: {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
    },
    response: {
      status: 201,
      body: { id: 3, title: "Post 3", body: "Body 3", userId: 3 },
    },
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.getByRole("textbox", { name: "Title" }).fill("Post 3");
  await page.getByRole("textbox", { name: "Body" }).fill("Body 3");
  await page.getByRole("button", { name: "Create Post" }).click();

  await expect(page.getByText("Post created successfully")).toBeVisible();
  await expect(page.getByText(/ID: 3/)).toBeVisible();
  await expect(page.getByText(/Title: Post 3/)).toBeVisible();
});
