CREATE TABLE "project_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"expires_at" timestamp,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "yjs_state" text;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_invites_token_idx" ON "project_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "project_invites_projectId_idx" ON "project_invites" USING btree ("project_id");