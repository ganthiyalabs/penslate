import { protectedProcedure, publicProcedure, router } from "../index";
import { projectRouter } from "./project";
import { inviteRouter } from "./invite";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  projects: projectRouter,
  invites: inviteRouter,
});
export type AppRouter = typeof appRouter;
