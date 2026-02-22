import { z } from "zod";
import { randomUUID } from "crypto";

import { protectedProcedure, router } from "../index";
import { projectInvites, projectMembers } from "@penslate/db/schema/editor";
import { eq, and, sql } from "drizzle-orm";

export const inviteRouter = router({
    create: protectedProcedure
        .input(
            z.object({
                projectId: z.string(),
                role: z.enum(["editor", "viewer"]).default("editor"),
                expiresInHours: z.number().positive().optional(),
                maxUses: z.number().int().positive().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id;
            if (!userId) throw new Error("Not authenticated");

            // Check user is owner or admin of the project
            const [member] = await ctx.db
                .select()
                .from(projectMembers)
                .where(
                    and(
                        eq(projectMembers.projectId, input.projectId),
                        eq(projectMembers.userId, userId)
                    )
                )
                .limit(1);

            if (!member || (member.role !== "owner" && member.role !== "admin")) {
                throw new Error("Only owners and admins can create invite links");
            }

            const token = randomUUID();
            const expiresAt = input.expiresInHours
                ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
                : null;

            const [invite] = await ctx.db
                .insert(projectInvites)
                .values({
                    projectId: input.projectId,
                    createdBy: userId,
                    token,
                    role: input.role,
                    expiresAt,
                    maxUses: input.maxUses ?? null,
                })
                .returning();

            return invite;
        }),

    accept: protectedProcedure
        .input(z.object({ token: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id;
            if (!userId) throw new Error("Not authenticated");

            // Find the invite
            const [invite] = await ctx.db
                .select()
                .from(projectInvites)
                .where(eq(projectInvites.token, input.token))
                .limit(1);

            if (!invite) {
                throw new Error("Invite link is invalid or has been revoked");
            }

            // Check expiry
            if (invite.expiresAt && new Date() > invite.expiresAt) {
                throw new Error("This invite link has expired");
            }

            // Check max uses
            if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
                throw new Error("This invite link has reached its maximum number of uses");
            }

            // Check if user is already a member
            const [existingMember] = await ctx.db
                .select()
                .from(projectMembers)
                .where(
                    and(
                        eq(projectMembers.projectId, invite.projectId),
                        eq(projectMembers.userId, userId)
                    )
                )
                .limit(1);

            if (existingMember) {
                // Already a member, just redirect them
                return { projectId: invite.projectId, alreadyMember: true };
            }

            // Add user as project member
            await ctx.db.insert(projectMembers).values({
                projectId: invite.projectId,
                userId,
                role: invite.role,
            });

            // Increment use count
            await ctx.db
                .update(projectInvites)
                .set({ useCount: sql`${projectInvites.useCount} + 1` })
                .where(eq(projectInvites.id, invite.id));

            return { projectId: invite.projectId, alreadyMember: false };
        }),

    listByProject: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id;
            if (!userId) throw new Error("Not authenticated");

            // Check user is owner or admin
            const [member] = await ctx.db
                .select()
                .from(projectMembers)
                .where(
                    and(
                        eq(projectMembers.projectId, input.projectId),
                        eq(projectMembers.userId, userId)
                    )
                )
                .limit(1);

            if (!member || (member.role !== "owner" && member.role !== "admin")) {
                throw new Error("Only owners and admins can view invite links");
            }

            const invites = await ctx.db
                .select()
                .from(projectInvites)
                .where(eq(projectInvites.projectId, input.projectId));

            return invites;
        }),

    revoke: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session?.user?.id;
            if (!userId) throw new Error("Not authenticated");

            // Find the invite to get its projectId
            const [invite] = await ctx.db
                .select()
                .from(projectInvites)
                .where(eq(projectInvites.id, input.id))
                .limit(1);

            if (!invite) throw new Error("Invite not found");

            // Check user is owner or admin of the project
            const [member] = await ctx.db
                .select()
                .from(projectMembers)
                .where(
                    and(
                        eq(projectMembers.projectId, invite.projectId),
                        eq(projectMembers.userId, userId)
                    )
                )
                .limit(1);

            if (!member || (member.role !== "owner" && member.role !== "admin")) {
                throw new Error("Only owners and admins can revoke invite links");
            }

            await ctx.db
                .delete(projectInvites)
                .where(eq(projectInvites.id, input.id));

            return { success: true };
        }),
});
