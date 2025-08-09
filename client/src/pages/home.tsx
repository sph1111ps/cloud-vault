import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ObjectUploader } from "@/components/ObjectUploader";
import { FolderBrowser } from "@/components/FolderBrowser";
import { FileContextMenu } from "@/components/FileContextMenu";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UploadResult } from "@uppy/core";
import type { File } from "@shared/schema";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fileType, setFileType] = useState("All Files");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"list" | "folders">("list");
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();

  const { data: files = [], isLoading } = useQuery<File[]>({
    queryKey: ["/api/files", searchQuery, fileType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (fileType !== "All Files") params.append("type", fileType);
      
      const url = params.toString() 
        ? `/api/files/search?${params.toString()}`
        : "/api/files";
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch files");
      return response.json();
    },
    refetchInterval: autoSyncEnabled ? 5000 : false, // Auto-refresh every 5 seconds when enabled
  });

  const uploadMutation = useMutation({
    mutationFn: async (fileData: any) => {
      return apiRequest("POST", "/api/files", fileData);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "Upload Complete",
        description: `${variables.originalName} has been uploaded successfully`,
      });
    },
    onError: (error, variables) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: `There was an error uploading ${variables.originalName}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest("DELETE", `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File Deleted",
        description: "File has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed", 
        description: "There was an error deleting the file",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      return apiRequest("POST", "/api/files/bulk-delete", { fileIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setSelectedFiles(new Set());
      toast({
        title: "Files Deleted",
        description: `${data.deletedCount} files have been deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Bulk Delete Failed",
        description: "There was an error deleting the selected files",
        variant: "destructive",
      });
    },
  });

  // Auto-sync effect to monitor file status changes
  useEffect(() => {
    if (autoSyncEnabled && files.length > 0) {
      const processingFiles = files.filter(f => f.status === "processing");
      const failedFiles = files.filter(f => f.status === "failed");
      
      if (processingFiles.length > 0) {
        console.log(`Auto-sync: ${processingFiles.length} files are still processing`);
      }
      
      if (failedFiles.length > 0) {
        toast({
          title: "Sync Warning",
          description: `${failedFiles.length} files failed to sync`,
          variant: "destructive",
        });
      }
    }
  }, [files, autoSyncEnabled, toast]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/files/sync", { method: "POST" });
      if (!response.ok) throw new Error("Sync failed");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "Sync Complete",
        description: `Synchronized ${data.syncedCount || 0} files`,
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Unable to sync files with cloud storage",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async (file: any) => {
    // Extract file information for security validation
    const fileInfo = {
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream"
    };

    const response = await fetch("/api/files/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fileInfo)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details ? errorData.details.join(', ') : "Failed to get upload URL");
    }
    
    const { uploadURL } = await response.json();
    return {
      method: "PUT" as const,
      url: uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      // Process all successful uploads
      result.successful.forEach(file => {
        const uploadURL = file.uploadURL as string;
        
        uploadMutation.mutate({
          name: file.name,
          originalName: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          objectPath: uploadURL,
          status: "synced",
        });
      });
    }
  };

  const handleFileSelect = (fileId: string, selected: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (selected) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedFiles(new Set(files.map(f => f.id)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} day${Math.floor(diffInHours / 24) > 1 ? "s" : ""} ago`;
    return `${Math.floor(diffInHours / 168)} week${Math.floor(diffInHours / 168) > 1 ? "s" : ""} ago`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return "fas fa-file-pdf text-red-500";
    if (mimeType.includes("image")) return "fas fa-file-image text-blue-500";
    if (mimeType.includes("video")) return "fas fa-file-video text-purple-500";
    if (mimeType.includes("zip") || mimeType.includes("archive")) return "fas fa-file-archive text-green-500";
    if (mimeType.includes("word") || mimeType.includes("document")) return "fas fa-file-word text-blue-600";
    return "fas fa-file text-gray-500";
  };

  const totalStorage = 10 * 1024 * 1024 * 1024; // 10GB
  const usedStorage = files.reduce((total, file) => total + file.size, 0);
  const storagePercentage = (usedStorage / totalStorage) * 100;

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  <i className="fas fa-cloud-upload-alt text-blue-500 mr-2"></i>
                  CloudSync
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {formatFileSize(usedStorage)} / {formatFileSize(totalStorage)} used
              </span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                ></div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  <i className="fas fa-user mr-1"></i>
                  {user?.username}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user?.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {user?.role === 'admin' ? 'Admin' : 'Guest'}
                </span>
                {user?.role === 'admin' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowChangePasswordModal(true)}
                  >
                    <i className="fas fa-key mr-1"></i>
                    Change Password
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    try {
                      await logout();
                      toast({
                        title: "Logged out",
                        description: "You have been successfully logged out.",
                      });
                    } catch (error) {
                      toast({
                        title: "Logout failed",
                        description: "There was an error logging out.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <i className="fas fa-sign-out-alt mr-1"></i>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Upload Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Secure File Storage</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Upload, store, and manage your files securely in the cloud with enterprise-grade security and reliability.
            </p>
          </div>

          {/* Primary Upload Area */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors p-8 text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-cloud-upload-alt text-blue-500 text-2xl"></i>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Your Files</h3>
            <p className="text-gray-500 mb-6">Drag and drop files here or click to browse</p>
            
            <ObjectUploader
              maxNumberOfFiles={10}
              maxFileSize={104857600} // 100MB
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonClassName="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
            >
              <i className="fas fa-plus mr-2"></i>
              Choose Files
            </ObjectUploader>
            
            <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-400">
              <div className="flex items-center">
                <i className="fas fa-shield-alt mr-1"></i>
                Encrypted
              </div>
              <div className="flex items-center">
                <i className="fas fa-tachometer-alt mr-1"></i>
                Fast Upload
              </div>
              <div className="flex items-center">
                <i className="fas fa-infinity mr-1"></i>
                No Size Limit
              </div>
            </div>
          </div>

          {/* Upload Specifications */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="text-green-500 text-2xl mb-3">
                <i className="fas fa-check-circle"></i>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Supported Formats</h4>
              <p className="text-sm text-gray-600">Documents, Images, Videos, Archives, and more</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="text-blue-500 text-2xl mb-3">
                <i className="fas fa-bolt"></i>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Lightning Fast</h4>
              <p className="text-sm text-gray-600">Optimized upload speeds with resume capability</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="text-purple-500 text-2xl mb-3">
                <i className="fas fa-lock"></i>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Bank-Level Security</h4>
              <p className="text-sm text-gray-600">End-to-end encryption and secure access</p>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "folders")} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="flex items-center space-x-2">
              <i className="fas fa-list"></i>
              <span>File List</span>
            </TabsTrigger>
            <TabsTrigger value="folders" className="flex items-center space-x-2">
              <i className="fas fa-folder-open"></i>
              <span>Folder View</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="folders" className="mt-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <FolderBrowser 
                currentFolderId={currentFolderId}
                onFolderChange={setCurrentFolderId}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="mt-6">
            {/* File Management */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Your Files</h3>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                </div>
                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Files">All Files</SelectItem>
                    <SelectItem value="Documents">Documents</SelectItem>
                    <SelectItem value="Images">Images</SelectItem>
                    <SelectItem value="Videos">Videos</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm">
                  <i className="fas fa-list"></i>
                </Button>
                <Button variant="ghost" size="sm" className="text-blue-500">
                  <i className="fas fa-th"></i>
                </Button>
              </div>
            </div>
          </div>

          {/* File List */}
          <div className="overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading files...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <i className="fas fa-folder-open text-gray-400 text-3xl"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No files uploaded yet</h3>
                <p className="text-gray-500 mb-6">Start by uploading your first file to get started</p>
                <ObjectUploader
                  maxNumberOfFiles={10}
                  maxFileSize={104857600}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonClassName="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Upload Your First File
                </ObjectUploader>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <Checkbox
                        checked={selectedFiles.size === files.length && files.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modified</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Checkbox
                          checked={selectedFiles.has(file.id)}
                          onCheckedChange={(checked) => handleFileSelect(file.id, !!checked)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <i className={`${getFileIcon(file.mimeType)} text-lg`}></i>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{file.originalName}</div>
                            <div className="text-sm text-gray-500">/uploads/</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(file.uploadedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          file.status === "synced" 
                            ? "bg-green-100 text-green-800" 
                            : file.status === "processing"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          <i className={`fas ${
                            file.status === "synced" 
                              ? "fa-check" 
                              : file.status === "processing"
                              ? "fa-spinner fa-spin"
                              : "fa-exclamation-triangle"
                          } mr-1`}></i>
                          {file.status === "synced" ? "Synced" : file.status === "processing" ? "Processing" : "Failed"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <FileContextMenu 
                          file={file} 
                          onFileSelect={(fileId) => handleFileSelect(fileId, true)}
                        >
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                              const link = document.createElement("a");
                              link.href = file.objectPath;
                              link.download = file.originalName;
                              link.target = "_blank";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}>
                              <i className="fas fa-download"></i>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => deleteMutation.mutate(file.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </FileContextMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedFiles.size > 0 && (
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {selectedFiles.size} file{selectedFiles.size > 1 ? "s" : ""} selected
                </div>
                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      selectedFiles.forEach(fileId => {
                        const file = files.find(f => f.id === fileId);
                        if (file) {
                          const link = document.createElement("a");
                          link.href = file.objectPath;
                          link.download = file.originalName;
                          link.target = "_blank";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      });
                    }}
                  >
                    <i className="fas fa-download mr-2"></i>
                    Download Selected
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      bulkDeleteMutation.mutate(Array.from(selectedFiles));
                      setSelectedFiles(new Set());
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Delete Selected
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>

        {/* Bulk Actions Bar */}
        {selectedFiles.size > 0 && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFiles(new Set())}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Download selected files
                    selectedFiles.forEach(fileId => {
                      const file = files.find(f => f.id === fileId);
                      if (file) window.open(file.objectPath, "_blank");
                    });
                  }}
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => bulkDeleteMutation.mutate(Array.from(selectedFiles))}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-trash mr-2"></i>
                  )}
                  Delete Selected
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Bulk Operations</h3>
                <p className="text-blue-100 text-sm mb-4">Use checkboxes to select multiple files for batch operations</p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                  disabled={files.length === 0}
                >
                  Select All Files
                </Button>
              </div>
              <i className="fas fa-tasks text-3xl text-blue-200"></i>
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Auto Sync</h3>
                <p className="text-green-100 text-sm mb-4">
                  {autoSyncEnabled ? "Files sync every 5 seconds" : "Manual sync only"}
                </p>
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoSyncEnabled}
                      onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-green-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white"></div>
                    <span className="ml-3 text-sm font-medium">
                      {autoSyncEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                  >
                    {syncMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                    ) : (
                      <i className="fas fa-sync mr-2"></i>
                    )}
                    Sync Now
                  </Button>
                </div>
              </div>
              <i className="fas fa-sync-alt text-3xl text-green-200"></i>
            </div>
          </div>
        </div>
      </main>

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </div>
  );
}
