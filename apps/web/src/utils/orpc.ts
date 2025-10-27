import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createRouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { toast } from 'sonner';

// Server-side context creation function
async function createServerContext({ req }: { req: Request }) {
  // Import createContext dynamically to avoid bundling issues
  const { createContext } = await import('@sparktown/api/context');

  // Create a minimal mock Hono context that only provides what createContext needs
  const mockContext = {
    req: {
      raw: req,
    },
  } as any; // We only need req.raw.headers, so this minimal mock is sufficient

  return createContext({ context: mockContext });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(`Error: ${error.message}`, {
        action: {
          label: 'retry',
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
});

const getORPCClient = createIsomorphicFn()
  .server(async () => {
    const { appRouter } = await import('@sparktown/api/routers/index');
    return createRouterClient(appRouter, {
      context: async ({ req }) => {
        return createServerContext({ req });
      },
    });
  })
  .client(() => {
    const link = new RPCLink({
      url: `${import.meta.env.VITE_SERVER_URL}/rpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    });

    return createORPCClient(link);
  });

export const client = getORPCClient();

// For the orpc utils, we need to handle the async nature properly
// This will be resolved at runtime based on the environment
export const orpc = createTanstackQueryUtils(
  client as Parameters<typeof createTanstackQueryUtils>[0]
);
