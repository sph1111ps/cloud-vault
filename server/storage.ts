import { type User, type InsertUser, type File, type InsertFile, type Folder, type InsertFolder } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getFile(id: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  getAllFiles(): Promise<File[]>;
  updateFile(id: string, updates: Partial<File>): Promise<File | undefined>;
  deleteFile(id: string): Promise<void>;
  deleteFiles(ids: string[]): Promise<void>;
  searchFiles(query?: string, type?: string): Promise<File[]>;

  getFolder(id: string): Promise<Folder | undefined>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  getAllFolders(): Promise<Folder[]>;
  updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<void>;
  getFolderContents(folderId?: string): Promise<{ files: File[]; folders: Folder[] }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private files: Map<string, File>;
  private folders: Map<string, Folder>;

  constructor() {
    this.users = new Map();
    this.files = new Map();
    this.folders = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const id = randomUUID();
    const file: File = { 
      ...insertFile, 
      id, 
      uploadedAt: new Date(),
      status: insertFile.status || "processing",
      metadata: insertFile.metadata || null
    };
    this.files.set(id, file);
    return file;
  }

  async getAllFiles(): Promise<File[]> {
    return Array.from(this.files.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id);
  }

  async deleteFiles(ids: string[]): Promise<void> {
    ids.forEach(id => this.files.delete(id));
  }

  async searchFiles(query?: string, type?: string): Promise<File[]> {
    let files = Array.from(this.files.values());
    
    if (query) {
      files = files.filter(file => 
        file.originalName.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    if (type && type !== "All Files") {
      const typeMap: Record<string, string[]> = {
        "Documents": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        "Images": ["image/jpeg", "image/png", "image/gif", "image/webp"],
        "Videos": ["video/mp4", "video/avi", "video/mov", "video/wmv"]
      };
      
      const mimeTypes = typeMap[type] || [];
      files = files.filter(file => mimeTypes.includes(file.mimeType));
    }
    
    return files.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File | undefined> {
    const existingFile = this.files.get(id);
    if (!existingFile) return undefined;
    
    const updatedFile = { ...existingFile, ...updates };
    this.files.set(id, updatedFile);
    return updatedFile;
  }

  // Folder methods
  async getFolder(id: string): Promise<Folder | undefined> {
    return this.folders.get(id);
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const id = randomUUID();
    const folder: Folder = { 
      ...insertFolder, 
      id, 
      createdAt: new Date()
    };
    this.folders.set(id, folder);
    return folder;
  }

  async getAllFolders(): Promise<Folder[]> {
    return Array.from(this.folders.values());
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    const existingFolder = this.folders.get(id);
    if (!existingFolder) return undefined;
    
    const updatedFolder = { ...existingFolder, ...updates };
    this.folders.set(id, updatedFolder);
    return updatedFolder;
  }

  async deleteFolder(id: string): Promise<void> {
    // Move files in this folder to root (no folder)
    const files = Array.from(this.files.values());
    for (const file of files) {
      if (file.folderId === id) {
        const updatedFile = { ...file, folderId: null };
        this.files.set(file.id, updatedFile);
      }
    }
    
    // Delete subfolders recursively
    const folders = Array.from(this.folders.values());
    for (const folder of folders) {
      if (folder.parentId === id) {
        await this.deleteFolder(folder.id);
      }
    }
    
    this.folders.delete(id);
  }

  async getFolderContents(folderId?: string): Promise<{ files: File[]; folders: Folder[] }> {
    const files = Array.from(this.files.values()).filter(file => 
      folderId ? file.folderId === folderId : !file.folderId
    );
    
    const folders = Array.from(this.folders.values()).filter(folder =>
      folderId ? folder.parentId === folderId : !folder.parentId
    );

    return { files, folders };
  }
}

export const storage = new MemStorage();
