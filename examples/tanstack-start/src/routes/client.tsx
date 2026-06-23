import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

export const Route = createFileRoute('/client')({
  component: ClientFetchPage,
});

function ClientFetchPage() {
  const [todos, setTodos] = useState<Todo[] | null>(null);

  const loadTodos = async () => {
    const res = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=3');
    setTodos(await res.json());
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">mockplane — client-side</h1>
      <p className="mb-6 text-sm text-gray-500">
        Requests below are made directly from the browser, intercepted by{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">page.route()</code>.
      </p>
      <button
        onClick={loadTodos}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
      >
        Load Todos
      </button>
      {todos !== null && (
        <ul className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {todos.map((todo) => (
            <li key={todo.id} className="px-4 py-3 text-sm">
              {todo.title}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
