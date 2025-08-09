import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { File, Folder } from "@shared/schema";

interface FileContextMenuProps {
  file: File;
  children: React.ReactNode;
  onFileSelect?: (fileId: string) => void;
}

export function FileContextMenu({ file, children, onFileSelect }: FileContextMenuProps) {
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all folders for move menu
  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const response = await fetch("/api/folders");
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
  });

  // Rename file mutation
  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("PATCH", `/api/files/${file.id}/rename`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setIsRenameDialogOpen(false);
      toast({
        title: "File Renamed",
        description: `File renamed to ${newName}`,
      });
    },
    onError: () => {
      toast({
        title: "Rename Failed",
        description: "Failed to rename file",
        variant: "destructive",
      });
    },
  });

  // Move file mutation
  const moveMutation = useMutation({
    mutationFn: async (folderId: string | null) => {
      return apiRequest("PATCH", `/api/files/${file.id}/move`, { folderId });
    },
    onSuccess: (_, folderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      const folderName = folderId ? folders.find(f => f.id === folderId)?.name : "Root";
      toast({
        title: "File Moved",
        description: `File moved to ${folderName}`,
      });
    },
    onError: () => {
      toast({
        title: "Move Failed",
        description: "Failed to move file",
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/files/${file.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "File Deleted",
        description: "File has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const handleRename = () => {
    if (newName.trim() && newName !== file.name) {
      renameMutation.mutate(newName.trim());
    }
  };

  const handleDownload = () => {
    // Create a download link for the file
    const link = document.createElement("a");
    link.href = file.objectPath;
    link.download = file.originalName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelect = () => {
    if (onFileSelect) {
      onFileSelect(file.id);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleSelect}>
            <i className="fas fa-check-square mr-2 w-4 h-4"></i>
            Select File
          </ContextMenuItem>
          
          <ContextMenuItem onClick={handleDownload}>
            <i className="fas fa-download mr-2 w-4 h-4"></i>
            Download
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem onClick={() => {
            setNewName(file.name);
            setIsRenameDialogOpen(true);
          }}>
            <i className="fas fa-edit mr-2 w-4 h-4"></i>
            Rename
          </ContextMenuItem>
          
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <i className="fas fa-folder-open mr-2 w-4 h-4"></i>
              Move to Folder
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem 
                onClick={() => moveMutation.mutate(null)}
                disabled={!file.folderId}
              >
                <i className="fas fa-home mr-2 w-4 h-4"></i>
                Root (No Folder)
              </ContextMenuItem>
              {folders.map((folder) => (
                <ContextMenuItem
                  key={folder.id}
                  onClick={() => moveMutation.mutate(folder.id)}
                  disabled={file.folderId === folder.id}
                >
                  <i 
                    className="fas fa-folder mr-2 w-4 h-4"
                    style={{ color: folder.color }}
                  ></i>
                  {folder.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem 
            onClick={() => deleteMutation.mutate()}
            className="text-red-600 focus:text-red-600"
          >
            <i className="fas fa-trash mr-2 w-4 h-4"></i>
            Delete
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          <ContextMenuItem disabled className="text-xs text-gray-500">
            Size: {formatFileSize(file.size)}
          </ContextMenuItem>
          <ContextMenuItem disabled className="text-xs text-gray-500">
            Type: {file.mimeType}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New name:</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                placeholder="Enter new file name"
                className="mt-1"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRename}
                disabled={!newName.trim() || newName === file.name || renameMutation.isPending}
              >
                {renameMutation.isPending ? "Renaming..." : "Rename"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}