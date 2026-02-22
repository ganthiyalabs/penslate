import type { Context as HonoContext } from "hono";

import { auth } from "@penslate/auth";
import { db } from "@penslate/db";

export type CreateContextOptions = {
  context: HonoContext;
};

export type Context = {
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
  db: typeof db;
};

export async function createContext({ context }: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    session,
    db,
  };
}
