import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';

export type Post = {
  id: number;
  title: string;
  body: string;
  userId: number;
};

const fetchPosts = createServerFn().handler(async () => {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
  if (!response.ok) throw new Error('Failed to fetch posts');
  return response.json() as Promise<Post[]>;
});

const createPost = createServerFn({ method: 'POST' })
  .inputValidator((data: { title: string; body: string }) => data)
  .handler(async ({ data }) => {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      body: JSON.stringify({ title: data.title, body: data.body, userId: 1 }),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
    if (!response.ok) throw new Error('Failed to create post');
    return response.json() as Promise<Post>;
  });

export const Route = createFileRoute('/')({
  loader: () => fetchPosts(),
  component: App,
});

function App() {
  const posts = Route.useLoaderData();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [createdPost, setCreatedPost] = useState<Post | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const post = await createPost({ data: { title, body } });
    setCreatedPost(post);
    setTitle('');
    setBody('');
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">mockplane</h1>
      <p className="mb-10 text-sm text-gray-500">
        Both sections below fetch data via{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">createServerFn</code> —
        server-side requests intercepted per test by MSW.
      </p>

      <div className="space-y-8">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-gray-400 uppercase">
            Loader — GET on page load
          </h2>
          <ul className="divide-y divide-gray-100">
            {posts.map((post) => (
              <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                <h3 className="text-sm font-medium capitalize">{post.title}</h3>
                <p className="mt-0.5 text-sm text-gray-500">{post.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-gray-400 uppercase">
            Action — POST on submit
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="body" className="mb-1.5 block text-sm font-medium">
                Body
              </label>
              <textarea
                id="body"
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            >
              Create Post
            </button>
          </form>
          {createdPost && (
            <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
              Post created successfully — ID: {createdPost.id} · Title: {createdPost.title}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
