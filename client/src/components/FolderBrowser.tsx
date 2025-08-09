import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { File, Folder } from "@shared/schema";

interface FolderBrowserProps {
  currentFolderId?: string;
  onFolderChange: (folderId?: string) => void;
}

export function FolderBrowser({ currentFolderId, onFolderChange }: FolderBrowserProps) {
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folder contents
  const { data: folderContents, isLoading } = useQuery<{ files: File[]; folders: Folder[] }>({
    queryKey: ["/api/folders", currentFolderId || "root"],
    queryFn: async () => {
      const response = await fetch(`/api/folders/${currentFolderId || "root"}/contents`);
      if (!response.ok) throw new Error("Failed to fetch folder contents");
      return response.json();
    },
  });

  // Fetch all folders for breadcrumb navigation
  const { data: allFolders = [] } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: { name: string; parentId?: string; color: string }) => {
      return apiRequest("POST", "/api/folders", folderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setNewFolderName("");
      setSelectedColor("#3B82F6");
      setIsCreateFolderOpen(false);
      toast({
        title: "Folder Created",
        description: "New folder has been created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  // Rename folder mutation
  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest("PATCH", `/api/folders/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setRenamingFolder(null);
      setRenameValue("");
      toast({
        title: "Folder Renamed",
        description: "Folder has been renamed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rename folder",
        variant: "destructive",
      });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder Deleted",
        description: "Folder and its contents have been moved to root",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    },
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate({
        name: newFolderName.trim(),
        parentId: currentFolderId,
        color: selectedColor,
      });
    }
  };

  const handleRenameFolder = (folderId: string) => {
    if (renameValue.trim()) {
      renameFolderMutation.mutate({
        id: folderId,
        name: renameValue.trim(),
      });
    }
  };

  const startRenaming = (folder: Folder) => {
    setRenamingFolder(folder.id);
    setRenameValue(folder.name);
  };

  // Build breadcrumb path
  const buildBreadcrumbs = () => {
    if (!currentFolderId) return [{ id: "root", name: "Home" }];
    
    const breadcrumbs: { id: string; name: string }[] = [];
    let currentId: string | undefined = currentFolderId;
    
    while (currentId) {
      const folder = allFolders.find((f: Folder) => f.id === currentId);
      if (folder) {
        breadcrumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId || undefined;
      } else {
        break;
      }
    }
    
    breadcrumbs.unshift({ id: "root", name: "Home" });
    return breadcrumbs;
  };

  const colorOptions = [
    { value: "#3B82F6", name: "Blue" },
    { value: "#EF4444", name: "Red" },
    { value: "#10B981", name: "Green" },
    { value: "#F59E0B", name: "Amber" },
    { value: "#8B5CF6", name: "Purple" },
    { value: "#EC4899", name: "Pink" },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const breadcrumbs = buildBreadcrumbs();
  const { folders = [], files = [] } = folderContents || {};

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id} className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFolderChange(crumb.id === "root" ? undefined : crumb.id)}
              className="text-blue-600 hover:text-blue-800"
            >
              {crumb.name}
            </Button>
            {index < breadcrumbs.length - 1 && (
              <span className="text-gray-400">/</span>
            )}
          </div>
        ))}
      </div>

      {/* Create Folder Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {currentFolderId ? "Current Folder" : "All Files & Folders"}
        </h3>
        
        <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
          <DialogTrigger asChild>
            <Button>
              <i className="fas fa-folder-plus mr-2"></i>
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Folder Color</label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: color.value }}
                          />
                          <span>{color.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateFolderOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending}
                >
                  Create Folder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Folders Grid */}
      {folders.length > 0 && (
        <div>
          <h4 className="text-md font-medium mb-3">Folders</h4>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div 
                    className="flex items-center space-x-2"
                    onClick={() => onFolderChange(folder.id)}
                  >
                    <i 
                      className="fas fa-folder text-2xl"
                      style={{ color: folder.color }}
                    ></i>
                    <div>
                      {renamingFolder === folder.id ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameFolder(folder.id);
                            if (e.key === "Escape") {
                              setRenamingFolder(null);
                              setRenameValue("");
                            }
                          }}
                          onBlur={() => handleRenameFolder(folder.id)}
                          className="h-6 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{folder.name}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenaming(folder);
                      }}
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolderMutation.mutate(folder.id);
                      }}
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </Button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  Created {new Date(folder.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Count */}
      {files.length > 0 && (
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">{files.length} files</Badge>
          <span className="text-sm text-gray-500">in this location</span>
        </div>
      )}
    </div>
  );
}