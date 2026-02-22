import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { MoreVertical, Pencil, Trash2, PlusIcon } from "lucide-react";

import { getUser } from "@/functions/get-user";
import { authClient } from "@/lib/auth-client";
import { trpc, queryClient } from "@/router";
import TopNav from "@/components/top-nav";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/")({
  component: HomeComponent,
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/signin" });
    }
  },
});

function HomeComponent() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "settings">(
    "overview"
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);

  const { data: projects } = useQuery(trpc.projects.getAll.queryOptions());
  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: () => {
        setIsDialogOpen(false);
        setProjectName("");
        queryClient.invalidateQueries();
      },
    })
  );

  const updateProject = useMutation(
    trpc.projects.update.mutationOptions({
      onSuccess: () => {
        setEditingProject(null);
        queryClient.invalidateQueries();
      },
    })
  );

  const deleteProject = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        setEditingProject(null);
        queryClient.invalidateQueries();
      },
    })
  );

  const user = session?.user;

  const handleCreateProject = () => {
    if (projectName.trim()) {
      createProject.mutate({ name: projectName.trim() });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={() => {
          authClient.signOut({
            fetchOptions: {
              onSuccess: () => {
                navigate({ to: "/signin" });
              },
            },
          });
        }}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === "overview" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Projects</h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PlusIcon className="mr-1 h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Enter a name for your new project.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="Project name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateProject();
                        }
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateProject}
                      disabled={!projectName.trim() || createProject.isPending}
                    >
                      {createProject.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Project</DialogTitle>
                    <DialogDescription>
                      Enter a new name for your project.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="Project name"
                      value={editingProject?.name || ""}
                      onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingProject?.name.trim()) {
                          updateProject.mutate({ id: editingProject.id, name: editingProject.name.trim() });
                        }
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setEditingProject(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => editingProject?.name.trim() && updateProject.mutate({ id: editingProject.id, name: editingProject.name.trim() })}
                      disabled={!editingProject?.name.trim() || updateProject.isPending}
                    >
                      {updateProject.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects?.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingProject({ id: project.id, name: project.name })}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit name
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => deleteProject.mutate({ id: project.id })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="text-sm">
                      {project.description || "No description"}
                    </CardDescription>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Updated {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "Never"}
                    </p>
                  </CardHeader>
                </Card>
              ))}
              {(!projects || projects.length === 0) && (
                <p className="text-muted-foreground col-span-full text-center py-8">
                  No projects yet. Create your first project!
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold">Settings</h2>
            <p className="text-muted-foreground">
              Settings content will go here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
