import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";
import { trpc, queryClient } from "@/router";
import TopNav from "@/components/top-nav";
import MilkdownEditor from "@/components/milkdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FolderPlus, FilePlus, Trash2, Pencil, MoreVertical, UserPlus, Copy, Link, Clock, Users, X } from "lucide-react";
import { Folder01Icon, Folder02Icon, File02Icon } from "hugeicons-react";
import { type TreeViewElement } from "@/components/ui/file-tree";
import { toast } from "sonner";
import { env } from "@penslate/env/web";

interface TreeItemWithFolder extends TreeViewElement {
  isFolder: boolean;
}

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetailComponent,
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context, params }) => {
    if (!context.session) {
      throw redirect({ to: "/signin" });
    }
    return { projectId: params.projectId };
  },
});

interface FolderData {
  id: string;
  name: string;
  parentId: string | null;
  isRoot: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

interface FileData {
  id: string;
  name: string;
  folderId: string | null;
  projectId: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

function buildFileTree(folders: FolderData[], files: FileData[]): TreeItemWithFolder[] {
  const getChildren = (parentId: string | null): TreeItemWithFolder[] => {
    const childFolders = folders.filter(f => f.parentId === parentId);
    const childFiles = files.filter(f => f.folderId === parentId);

    const items: TreeItemWithFolder[] = [];

    childFolders.forEach(folder => {
      items.push({
        id: folder.id,
        name: folder.name,
        isSelectable: false,
        isFolder: true,
        children: getChildren(folder.id),
      });
    });

    childFiles.forEach(file => {
      items.push({
        id: file.id,
        name: file.name,
        isSelectable: true,
        isFolder: false,
      } as TreeItemWithFolder);
    });

    return items;
  };

  return getChildren(null);
}

function ProjectDetailComponent() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const { projectId } = Route.useParams();

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [contextMenuItem, setContextMenuItem] = useState<{ id: string; name: string; isFolder: boolean; parentId: string | null } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteExpiryHours, setInviteExpiryHours] = useState<string>("never");
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery(
    trpc.projects.getById.queryOptions({ id: projectId })
  );

  const { data: filesData, isLoading: filesLoading, refetch } = useQuery(
    trpc.projects.getFoldersAndFiles.queryOptions({ projectId })
  );

  const { data: fileContent, isLoading: fileContentLoading } = useQuery({
    ...trpc.projects.getFileContent.queryOptions({ fileId: selectedFileId! }),
    enabled: !!selectedFileId,
  });

  const { data: invites, refetch: refetchInvites } = useQuery({
    ...trpc.invites.listByProject.queryOptions({ projectId }),
    enabled: isInviteDialogOpen,
  });

  const createInviteMutation = useMutation(
    trpc.invites.create.mutationOptions({
      onSuccess: (data) => {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/invite/${data.token}`;
        setGeneratedInviteLink(link);
        refetchInvites();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create invite");
      },
    })
  );

  const revokeInviteMutation = useMutation(
    trpc.invites.revoke.mutationOptions({
      onSuccess: () => {
        toast.success("Invite revoked");
        refetchInvites();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to revoke invite");
      },
    })
  );

  const handleCreateInvite = () => {
    const hours = inviteExpiryHours === "never" ? undefined : parseInt(inviteExpiryHours);
    createInviteMutation.mutate({
      projectId,
      role: inviteRole,
      expiresInHours: hours,
    });
  };

  const handleCopyInviteLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const saveFileContentMutation = useMutation(
    trpc.projects.saveFileContent.mutationOptions()
  );

  const handleSaveContent = useCallback((content: string, yjsState: string) => {
    if (!selectedFileId) return;
    saveFileContentMutation.mutate({
      fileId: selectedFileId,
      content,
      yjsState,
    });
  }, [selectedFileId, saveFileContentMutation]);

  const createFolderMutation = useMutation(
    trpc.projects.createFolder.mutationOptions({
      onSuccess: () => {
        refetch();
        setIsCreatingFolder(false);
        setNewFolderName("");
      },
      onError: (error) => {
        console.error("Failed to create folder:", error);
      },
    })
  );

  const createFileMutation = useMutation(
    trpc.projects.createFile.mutationOptions({
      onSuccess: () => {
        refetch();
        setIsCreatingFile(false);
        setNewFileName("");
      },
      onError: (error) => {
        console.error("Failed to create file:", error);
      },
    })
  );

  const deleteFolderMutation = useMutation(
    trpc.projects.deleteFolder.mutationOptions({
      onSuccess: () => {
        refetch();
        setContextMenuItem(null);
      },
    })
  );

  const deleteFileMutation = useMutation(
    trpc.projects.deleteFile.mutationOptions({
      onSuccess: () => {
        refetch();
        setContextMenuItem(null);
      },
    })
  );

  const updateFolderMutation = useMutation(
    trpc.projects.updateFolder.mutationOptions({
      onSuccess: () => {
        refetch();
        setIsEditing(false);
        setContextMenuItem(null);
      },
    })
  );

  const updateFileMutation = useMutation(
    trpc.projects.updateFile.mutationOptions({
      onSuccess: () => {
        refetch();
        setIsEditing(false);
        setContextMenuItem(null);
      },
    })
  );

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({
      projectId,
      name: newFolderName.trim(),
      parentId: selectedFolderId,
    });
  };

  const handleCreateFile = () => {
    if (!newFileName.trim()) return;
    createFileMutation.mutate({
      projectId,
      name: newFileName.trim(),
      folderId: selectedFolderId,
    });
  };

  const handleDelete = (item?: { id: string; isFolder: boolean }) => {
    const targetItem = item || contextMenuItem;
    if (!targetItem) return;
    if (targetItem.isFolder) {
      deleteFolderMutation.mutate({ id: targetItem.id });
    } else {
      deleteFileMutation.mutate({ id: targetItem.id });
    }
  };

  const handleRename = () => {
    if (!contextMenuItem || !editName.trim()) return;
    if (contextMenuItem.isFolder) {
      updateFolderMutation.mutate({ id: contextMenuItem.id, name: editName.trim() });
    } else {
      updateFileMutation.mutate({ id: contextMenuItem.id, name: editName.trim() });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => {
    e.preventDefault();
    setContextMenuItem(item);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setEditName(item.name);
  };

  useEffect(() => {
    const handleClick = () => {
      setContextMenuItem(null);
      setContextMenuPosition(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const user = session?.user;

  const folders: FolderData[] = (filesData?.folders || []) as FolderData[];
  const files: FileData[] = (filesData?.files || []) as FileData[];
  const fileTree = buildFileTree(folders, files);

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        user={user}
        activeTab="overview"
        onTabChange={() => { }}
        onSignOut={() => { }}
      />

      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-72 border-r bg-card flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Files</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setSelectedFolderId(null);
                  setIsCreatingFolder(true);
                }}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setSelectedFolderId(null);
                  setIsCreatingFile(true);
                }}
              >
                <FilePlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isCreatingFolder && (
            <div className="p-2 border-b bg-muted/50">
              <div className="flex gap-1">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setIsCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" h-8 onClick={handleCreateFolder}>
                  Add
                </Button>
              </div>
            </div>
          )}

          {isCreatingFile && (
            <div className="p-2 border-b bg-muted/50">
              <div className="flex gap-1">
                <Input
                  placeholder="File name"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFile();
                    if (e.key === "Escape") {
                      setIsCreatingFile(false);
                      setNewFileName("");
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" h-8 onClick={handleCreateFile}>
                  Add
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-2">
            {filesLoading ? (
              <p className="text-sm text-muted-foreground p-2">Loading...</p>
            ) : fileTree.length === 0 ? (
              <div className="text-center py-8">
                <Folder01Icon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No files yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a folder or file to get started
                </p>
              </div>
            ) : (
              <FileTreeView
                items={fileTree}
                expandedItems={expandedItems}
                onToggleExpand={(id) => {
                  setExpandedItems(prev =>
                    prev.includes(id)
                      ? prev.filter(i => i !== id)
                      : [...prev, id]
                  );
                }}
                onContextMenu={handleContextMenu}
                onCreateInside={(parentId) => {
                  setSelectedFolderId(parentId);
                  setIsCreatingFolder(true);
                }}
                moreMenuOpen={moreMenuOpen}
                setMoreMenuOpen={setMoreMenuOpen}
                onCreateFile={(parentId) => {
                  setSelectedFolderId(parentId);
                  setIsCreatingFile(true);
                }}
                onRename={(item) => {
                  setContextMenuItem(item);
                  setEditName(item.name);
                  setIsEditing(true);
                }}
                onDelete={(item) => {
                  handleDelete({ id: item.id, isFolder: item.isFolder });
                }}
                onFileClick={(fileId) => setSelectedFileId(fileId)}
              />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {selectedFileId ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-card">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFileId(null)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <span className="text-sm text-muted-foreground">
                  {fileContent?.name || "Loading..."}
                </span>
                {saveFileContentMutation.isPending && (
                  <span className="text-xs text-muted-foreground ml-auto">Saving...</span>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {fileContentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading editor...</p>
                  </div>
                ) : (
                  <MilkdownEditor
                    key={selectedFileId}
                    fileId={selectedFileId}
                    initialContent={fileContent?.content}
                    initialYjsState={fileContent?.yjsState}
                    userName={user?.name || "Anonymous"}
                    onSave={handleSaveContent}
                  />
                )}
              </div>
            </div>
          ) : (
            <main className="mx-auto max-w-4xl px-6 py-8">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/" })}
                className="mb-4"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Projects
              </Button>

              {projectLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : project ? (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-bold">{project.name}</h1>
                      <p className="mt-2 text-muted-foreground">
                        {project.description || "No description"}
                      </p>
                      <p className="mt-4 text-sm text-muted-foreground">
                        Created: {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "Unknown"}
                        {project.updatedAt && ` • Updated: ${new Date(project.updatedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Dialog open={isInviteDialogOpen} onOpenChange={(open) => {
                      setIsInviteDialogOpen(open);
                      if (!open) {
                        setGeneratedInviteLink(null);
                        setInviteRole("editor");
                        setInviteExpiryHours("never");
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="mr-1.5 h-4 w-4" />
                          Invite
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Invite to Project</DialogTitle>
                          <DialogDescription>
                            Create a shareable link to invite others to this project.
                          </DialogDescription>
                        </DialogHeader>

                        {!generatedInviteLink ? (
                          <div className="space-y-4 py-2">
                            <div className="space-y-2">
                              <Label>Role</Label>
                              <Select value={inviteRole} onValueChange={(v: "editor" | "viewer") => setInviteRole(v)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="editor">Editor — can edit files</SelectItem>
                                  <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Expires</Label>
                              <Select value={inviteExpiryHours} onValueChange={setInviteExpiryHours}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="never">Never</SelectItem>
                                  <SelectItem value="1">1 hour</SelectItem>
                                  <SelectItem value="24">24 hours</SelectItem>
                                  <SelectItem value="168">7 days</SelectItem>
                                  <SelectItem value="720">30 days</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              className="w-full"
                              onClick={handleCreateInvite}
                              disabled={createInviteMutation.isPending}
                            >
                              <Link className="mr-2 h-4 w-4" />
                              {createInviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3 py-2">
                            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                              <code className="flex-1 text-xs break-all">
                                {generatedInviteLink}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={() => handleCopyInviteLink(generatedInviteLink)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setGeneratedInviteLink(null)}
                            >
                              Create Another
                            </Button>
                          </div>
                        )}

                        {invites && invites.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                              <Users className="h-4 w-4" />
                              Active Invites ({invites.length})
                            </h4>
                            <div className="space-y-2 max-h-40 overflow-auto">
                              {invites.map((invite) => (
                                <div
                                  key={invite.id}
                                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium capitalize">{invite.role}</span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      {invite.useCount} use{invite.useCount !== 1 ? "s" : ""}
                                      {invite.expiresAt && (
                                        <>
                                          <Clock className="h-3 w-3" />
                                          {new Date(invite.expiresAt) < new Date()
                                            ? "Expired"
                                            : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        const link = `${window.location.origin}/invite/${invite.token}`;
                                        handleCopyInviteLink(link);
                                      }}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => revokeInviteMutation.mutate({ id: invite.id })}
                                      disabled={revokeInviteMutation.isPending}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">Project not found</p>
                  <Button
                    variant="link"
                    onClick={() => navigate({ to: "/" })}
                    className="mt-2"
                  >
                    Go back to projects
                  </Button>
                </div>
              )}
            </main>
          )}
        </div>
      </div>

      {contextMenuItem && contextMenuPosition && (
        <div
          className="fixed z-50"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <Popover open={!!contextMenuItem} onOpenChange={(open) => !open && setContextMenuItem(null)}>
            <PopoverContent className="w-40 p-1" align="start" side="right" onClick={(e) => e.stopPropagation()}>
              {contextMenuItem.isFolder && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 px-2"
                  onClick={() => {
                    setContextMenuItem(null);
                    setSelectedFolderId(contextMenuItem.id);
                    setIsCreatingFolder(true);
                  }}
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </Button>
              )}

              {contextMenuItem.isFolder && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 px-2"
                  onClick={() => {
                    setContextMenuItem(null);
                    setSelectedFolderId(contextMenuItem.id);
                    setIsCreatingFile(true);
                  }}
                >
                  <FilePlus className="mr-2 h-4 w-4" />
                  New File
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => {
                  const item = contextMenuItem;
                  setContextMenuItem(null);
                  setIsEditing(true);
                  setEditName(item.name);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2 text-red-600 hover:text-red-600"
                onClick={() => handleDelete()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {isEditing && contextMenuItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background p-4 rounded-lg shadow-lg w-80">
            <h3 className="font-semibold mb-3">Rename {contextMenuItem.isFolder ? "Folder" : "File"}</h3>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditName("");
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleRename}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileTreeView({
  items,
  expandedItems,
  onToggleExpand,
  onContextMenu,
  onCreateInside,
  moreMenuOpen,
  setMoreMenuOpen,
  onCreateFile,
  onRename,
  onDelete,
  onFileClick,
}: {
  items: TreeViewElement[];
  expandedItems: string[];
  onToggleExpand: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onCreateInside: (parentId: string) => void;
  moreMenuOpen: string | null;
  setMoreMenuOpen: (id: string | null) => void;
  onCreateFile: (parentId: string) => void;
  onRename: (item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onDelete: (item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onFileClick: (fileId: string) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <FileTreeItem
          key={item.id}
          item={item}
          expandedItems={expandedItems}
          onToggleExpand={onToggleExpand}
          onContextMenu={onContextMenu}
          onCreateInside={onCreateInside}
          moreMenuOpen={moreMenuOpen}
          setMoreMenuOpen={setMoreMenuOpen}
          onCreateFile={onCreateFile}
          onRename={onRename}
          onDelete={onDelete}
          onFileClick={onFileClick}
          level={0}
        />
      ))}
    </div>
  );
}

function FileTreeItem({
  item,
  expandedItems,
  onToggleExpand,
  onContextMenu,
  onCreateInside,
  moreMenuOpen,
  setMoreMenuOpen,
  onCreateFile,
  onRename,
  onDelete,
  onFileClick,
  level,
}: {
  item: TreeViewElement;
  expandedItems: string[];
  onToggleExpand: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onCreateInside: (parentId: string) => void;
  moreMenuOpen: string | null;
  setMoreMenuOpen: (id: string | null) => void;
  onCreateFile: (parentId: string) => void;
  onRename: (item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onDelete: (item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onFileClick: (fileId: string) => void;
  level: number;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.includes(item.id);
  const isFolder = (item as any).isFolder !== false;
  const isMenuOpen = moreMenuOpen === item.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded-md text-sm cursor-pointer hover:bg-muted group ${item.isSelectable ? "" : "font-medium"
          }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            onToggleExpand(item.id);
          } else {
            onFileClick(item.id);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, { id: item.id, name: item.name, isFolder, parentId: null })}
      >
        {hasChildren ? (
          isExpanded ? (
            <Folder02Icon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Folder01Icon className="h-4 w-4 text-muted-foreground" />
          )
        ) : item.isSelectable ? (
          <File02Icon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Folder01Icon className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="truncate flex-1">{item.name}</span>
        {isFolder && (
          <Popover open={isMenuOpen} onOpenChange={(open) => setMoreMenuOpen(open ? item.id : null)}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => {
                  setMoreMenuOpen(null);
                  onCreateInside(item.id);
                }}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => {
                  setMoreMenuOpen(null);
                  onCreateFile(item.id);
                }}
              >
                <FilePlus className="mr-2 h-4 w-4" />
                New File
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => {
                  setMoreMenuOpen(null);
                  onRename({ id: item.id, name: item.name, isFolder, parentId: null });
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2 text-red-600 hover:text-red-600"
                onClick={() => {
                  setMoreMenuOpen(null);
                  onDelete({ id: item.id, name: item.name, isFolder, parentId: null });
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
              onCreateInside={onCreateInside}
              moreMenuOpen={moreMenuOpen}
              setMoreMenuOpen={setMoreMenuOpen}
              onCreateFile={onCreateFile}
              onRename={onRename}
              onDelete={onDelete}
              onFileClick={onFileClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
