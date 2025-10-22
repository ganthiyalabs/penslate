import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createRouterClient } from '@orpc/server';
import type { RouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { createContext } from '@sparktown/api/context';
import { appRouter } from '@sparktown/api/routers/index';
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { toast } from 'sonner';

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
  .server(() =>
    createRouterClient(appRouter, {
      context: async ({ req }) => {
        return createContext({ req });
      },
    })
  )
  .client((): RouterClient<typeof appRouter> => {
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

export const client: RouterClient<typeof appRouter> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
