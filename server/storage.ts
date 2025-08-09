import { type User, type InsertUser, type File, type InsertFile } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getFile(id: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  getAllFiles(): Promise<File[]>;
  deleteFile(id: string): Promise<void>;
  deleteFiles(ids: string[]): Promise<void>;
  searchFiles(query?: string, type?: string): Promise<File[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private files: Map<string, File>;

  constructor() {
    this.users = new Map();
    this.files = new Map();
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
}

export const storage = new MemStorage();
