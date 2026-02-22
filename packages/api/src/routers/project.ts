import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { projectMembers, projects, folders, files } from "@penslate/db/schema/editor";
import { eq } from "drizzle-orm";

export const projectRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [project] = await ctx.db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
        .where(eq(projects.id, input.id));

      if (!project) throw new Error("Project not found");

      return project;
    }),

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
    .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [project] = await ctx.db
        .insert(projects)
        .values({
          name: input.name,
          description: input.description || null,
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

  getFoldersAndFiles: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const projectFolders = await ctx.db
        .select({
          id: folders.id,
          name: folders.name,
          parentId: folders.parentId,
          isRoot: folders.isRoot,
          projectId: folders.projectId,
          createdAt: folders.createdAt,
          updatedAt: folders.updatedAt,
        })
        .from(folders)
        .where(eq(folders.projectId, input.projectId));

      const projectFiles = await ctx.db
        .select({
          id: files.id,
          name: files.name,
          folderId: files.folderId,
          projectId: files.projectId,
          content: files.content,
          createdAt: files.createdAt,
          updatedAt: files.updatedAt,
        })
        .from(files)
        .where(eq(files.projectId, input.projectId));

      return { folders: projectFolders, files: projectFiles };
    }),

  createFolder: protectedProcedure
    .input(z.object({ 
      projectId: z.string(), 
      name: z.string().min(1),
      parentId: z.string().nullable() 
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [member] = await ctx.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId))
        .limit(1);
      
      if (!member) throw new Error("Not authorized to access this project");

      const [folder] = await ctx.db
        .insert(folders)
        .values({
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId || null,
          isRoot: !input.parentId,
        })
        .returning();

      return folder;
    }),

  createFile: protectedProcedure
    .input(z.object({ 
      projectId: z.string(), 
      name: z.string().min(1),
      folderId: z.string().nullable() 
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [member] = await ctx.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId))
        .limit(1);
      
      if (!member) throw new Error("Not authorized to access this project");

      const [file] = await ctx.db
        .insert(files)
        .values({
          projectId: input.projectId,
          name: input.name,
          folderId: input.folderId || null,
          content: "",
        })
        .returning();

      return file;
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(folders).where(eq(folders.id, input.id));
      return { success: true };
    }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(files).where(eq(files.id, input.id));
      return { success: true };
    }),

  updateFolder: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [folder] = await ctx.db
        .update(folders)
        .set({ name: input.name })
        .where(eq(folders.id, input.id))
        .returning();
      return folder;
    }),

  updateFile: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [file] = await ctx.db
        .update(files)
        .set({ name: input.name })
        .where(eq(files.id, input.id))
        .returning();
      return file;
    }),
});
