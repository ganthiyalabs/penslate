import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";
import { trpc } from "@/router";
import TopNav from "@/components/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, FolderPlus, FilePlus, Folder, File, ChevronRight, ChevronDown, Trash2, Pencil, MoreVertical } from "lucide-react";
import { type TreeViewElement } from "@/components/ui/file-tree";

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

  const { data: project, isLoading: projectLoading } = useQuery(
    trpc.projects.getById.queryOptions({ id: projectId })
  );

  const { data: filesData, isLoading: filesLoading, refetch } = useQuery(
    trpc.projects.getFoldersAndFiles.queryOptions({ projectId })
  );

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

  const handleDelete = () => {
    if (!contextMenuItem) return;
    if (contextMenuItem.isFolder) {
      deleteFolderMutation.mutate({ id: contextMenuItem.id });
    } else {
      deleteFileMutation.mutate({ id: contextMenuItem.id });
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
        onTabChange={() => {}}
        onSignOut={() => {}}
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
                <Folder className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
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
              />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
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
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <p className="mt-2 text-muted-foreground">
                  {project.description || "No description"}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Created: {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "Unknown"}
                  {project.updatedAt && ` • Updated: ${new Date(project.updatedAt).toLocaleDateString()}`}
                </p>
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
        </div>
      </div>

      {contextMenuItem && contextMenuPosition && (
        <div
          className="fixed z-50"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        >
          <Popover open={!!contextMenuItem} onOpenChange={(open) => !open && setContextMenuItem(null)}>
            <PopoverTrigger asChild>
              <div className="fixed inset-0" />
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" side="right" align="start">
              <div className="text-xs font-medium px-2 py-1.5 text-muted-foreground">
                {contextMenuItem.name}
              </div>
              <div className="border-t my-1" />
              
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
                  setIsEditing(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2 text-red-600 hover:text-red-600"
                onClick={handleDelete}
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
}: {
  items: TreeViewElement[];
  expandedItems: string[];
  onToggleExpand: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onCreateInside: (parentId: string) => void;
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
  level,
}: {
  item: TreeViewElement;
  expandedItems: string[];
  onToggleExpand: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, item: { id: string; name: string; isFolder: boolean; parentId: string | null }) => void;
  onCreateInside: (parentId: string) => void;
  level: number;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.includes(item.id);
  const isFolder = (item as any).isFolder !== false;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded-md text-sm cursor-pointer hover:bg-muted group ${
          item.isSelectable ? "" : "font-medium"
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            onToggleExpand(item.id);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, { id: item.id, name: item.name, isFolder, parentId: null })}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : item.isSelectable ? (
          <File className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="truncate flex-1">{item.name}</span>
        {isFolder && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onCreateInside(item.id);
            }}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
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
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
