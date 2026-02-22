import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { projectMembers, projects } from "@penslate/db/schema/editor";
import { eq } from "drizzle-orm";

export const projectRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) return [];

    const userProjects = await ctx.db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    return userProjects;
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [project] = await ctx.db
        .insert(projects)
        .values({
          name: input.name,
        })
        .returning();

      if (!project) throw new Error("Failed to create project");

      await ctx.db.insert(projectMembers).values({
        projectId: project.id,
        userId: userId,
        role: "owner",
      });

      return project;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [project] = await ctx.db
        .update(projects)
        .set({ name: input.name })
        .where(eq(projects.id, input.id))
        .returning();

      if (!project) throw new Error("Failed to update project");

      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      await ctx.db
        .delete(projectMembers)
        .where(eq(projectMembers.projectId, input.id));

      await ctx.db
        .delete(projects)
        .where(eq(projects.id, input.id));

      return { success: true };
    }),
});
