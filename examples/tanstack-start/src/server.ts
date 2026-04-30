import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

if (process.env.MOCKPLANE === 'true') {
  const { startServer, patchFetch } = await import('mockplane');
  startServer();
  patchFetch();
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
