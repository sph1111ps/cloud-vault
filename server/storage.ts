import { type User, type InsertUser, type File, type InsertFile, type Folder, type InsertFolder } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { users, files, folders } from "@shared/schema";
import { eq, like, or, and, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
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

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
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

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // File operations
  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db
      .insert(files)
      .values(insertFile)
      .returning();
    return file;
  }

  async getAllFiles(): Promise<File[]> {
    return await db.select().from(files);
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File | undefined> {
    const [file] = await db
      .update(files)
      .set(updates)
      .where(eq(files.id, id))
      .returning();
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async deleteFiles(ids: string[]): Promise<void> {
    for (const id of ids) {
      await db.delete(files).where(eq(files.id, id));
    }
  }

  async searchFiles(query?: string, type?: string): Promise<File[]> {
    let whereCondition;
    
    if (query && type && type !== "All Files") {
      whereCondition = and(
        like(files.originalName, `%${query}%`),
        like(files.mimeType, type === "Images" ? "image/%" : 
             type === "Videos" ? "video/%" : 
             type === "Documents" ? "application/%" : "%")
      );
    } else if (query) {
      whereCondition = like(files.originalName, `%${query}%`);
    } else if (type && type !== "All Files") {
      whereCondition = like(files.mimeType, type === "Images" ? "image/%" : 
                           type === "Videos" ? "video/%" : 
                           type === "Documents" ? "application/%" : "%");
    }

    if (whereCondition) {
      return await db.select().from(files).where(whereCondition);
    }
    return await db.select().from(files);
  }

  // Folder operations
  async getFolder(id: string): Promise<Folder | undefined> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder;
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const [folder] = await db
      .insert(folders)
      .values(insertFolder)
      .returning();
    return folder;
  }

  async getAllFolders(): Promise<Folder[]> {
    return await db.select().from(folders);
  }

  async updateFolder(id: string, updates: Partial<Folder>): Promise<Folder | undefined> {
    const [folder] = await db
      .update(folders)
      .set(updates)
      .where(eq(folders.id, id))
      .returning();
    return folder;
  }

  async deleteFolder(id: string): Promise<void> {
    await db.delete(folders).where(eq(folders.id, id));
  }

  async getFolderContents(folderId?: string): Promise<{ files: File[]; folders: Folder[] }> {
    const folderFiles = await db
      .select()
      .from(files)
      .where(folderId ? eq(files.folderId, folderId) : isNull(files.folderId));

    const subFolders = await db
      .select()
      .from(folders)
      .where(folderId ? eq(folders.parentId, folderId) : isNull(folders.parentId));

    return { files: folderFiles, folders: subFolders };
  }
}

export const storage = new DatabaseStorage();
