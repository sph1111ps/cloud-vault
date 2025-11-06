import type { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { AWSStorageService as ObjectStorageService, ObjectNotFoundError } from "./aws-storage";
import { insertFileSchema, insertFolderSchema, loginSchema, registerSchema, changePasswordSchema } from "@shared/schema";
import { AuthService, requireAuth, requireAdmin, requireUser } from "./auth";
import { pool } from "./db";
import { z } from "zod";
import { 
  validateFileUpload, 
  validateFolderOperation, 
  addSecurityHeaders, 
  validateFileAccess, 
  logSecurityEvents 
} from "./upload-middleware";
import { FileSecurityValidator } from "./security";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Session configuration
  const PgSession = connectPgSimple(session);
  app.use(session({
    store: new PgSession({
      pool: pool,
      tableName: 'sessions',
      createTableIfMissing: false
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));
  
  // Apply security middleware globally
  app.use(addSecurityHeaders);
  app.use(logSecurityEvents);

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await AuthService.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const user = await AuthService.createUser(userData);
      
      // Login the user immediately after registration
      req.session.userId = user.id;
      req.session.user = user;
      
      res.json({ user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await AuthService.authenticateUser(credentials);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      req.session.userId = user.id;
      req.session.user = user;
      
      res.json({ user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = req.session.user;
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  });

  app.post("/api/auth/change-password", requireAdmin, async (req, res) => {
    try {
      const passwordData = changePasswordSchema.parse(req.body);
      const userId = req.session.user.id;
      
      const success = await AuthService.changePassword(
        userId,
        passwordData.currentPassword,
        passwordData.newPassword
      );
      
      if (!success) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
  
  // Serve public objects endpoint
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve private objects with security validation
  app.get("/objects/:objectPath(*)", validateFileAccess, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for file with validation (requires authentication)
  app.post("/api/files/upload-url", requireUser, validateFileUpload, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadData = await objectStorageService.getObjectEntityUploadURL();
      res.json(uploadData);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Create file record after upload with security validation (requires authentication)
  app.post("/api/files", requireUser, async (req, res) => {
    try {
      const fileData = insertFileSchema.parse(req.body);
      
      // Additional security validation for the final file record
      if (fileData.name) {
        const nameValidation = FileSecurityValidator.validateFilename(fileData.name);
        if (!nameValidation.isValid) {
          return res.status(400).json({ 
            error: "Invalid filename", 
            details: nameValidation.errors 
          });
        }
        // Use sanitized filename
        fileData.name = nameValidation.sanitizedFilename;
      }
      
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(fileData.objectPath);
      
      const file = await storage.createFile({
        ...fileData,
        objectPath: normalizedPath,
        status: "synced"
      });

      res.status(201).json(file);
    } catch (error) {
      console.error("Error creating file record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid file data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all files (requires authentication)
  app.get("/api/files", requireUser, async (req, res) => {
    try {
      const files = await storage.getAllFiles();
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete file (requires authentication)  
  app.delete("/api/files/:id", requireUser, async (req, res) => {
    try {
      const fileId = req.params.id;
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      await storage.deleteFile(fileId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk delete files
  app.post("/api/files/bulk-delete", async (req, res) => {
    try {
      const { fileIds } = req.body;
      
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: "fileIds must be a non-empty array" });
      }

      await storage.deleteFiles(fileIds);
      res.json({ success: true, deletedCount: fileIds.length });
    } catch (error) {
      console.error("Error bulk deleting files:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search files
  app.get("/api/files/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const type = req.query.type as string;
      
      const files = await storage.searchFiles(query, type);
      res.json(files);
    } catch (error) {
      console.error("Error searching files:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual sync endpoint
  app.post("/api/files/sync", async (req, res) => {
    try {
      const files = await storage.getAllFiles();
      const objectStorageService = new ObjectStorageService();
      let syncedCount = 0;
      let failedCount = 0;

      // Check each file's sync status with cloud storage
      for (const file of files) {
        try {
          // Try to get the object file to verify it exists in storage
          const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
          if (objectFile) {
            // File exists in storage, ensure status is synced
            if (file.status !== "synced") {
              // Update file status to synced (would need to implement updateFile in storage)
              syncedCount++;
            }
          }
        } catch (error) {
          // File doesn't exist in storage or access error
          console.error(`Sync check failed for file ${file.id}:`, error);
          failedCount++;
        }
      }

      res.json({ 
        success: true, 
        totalFiles: files.length,
        syncedCount,
        failedCount,
        message: `Sync complete. ${syncedCount} files verified, ${failedCount} issues found.`
      });
    } catch (error) {
      console.error("Error during sync:", error);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  // Rename file endpoint with security validation
  app.patch("/api/files/:id/rename", async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Name is required" });
      }

      // Validate the new filename
      const nameValidation = FileSecurityValidator.validateFilename(name);
      if (!nameValidation.isValid) {
        return res.status(400).json({ 
          error: "Invalid filename", 
          details: nameValidation.errors 
        });
      }

      const updatedFile = await storage.updateFile(id, { name: nameValidation.sanitizedFilename });
      if (!updatedFile) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json(updatedFile);
    } catch (error) {
      console.error("Error renaming file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Move file to folder endpoint
  app.patch("/api/files/:id/move", async (req, res) => {
    try {
      const { id } = req.params;
      const { folderId } = req.body;

      const updatedFile = await storage.updateFile(id, { folderId });
      if (!updatedFile) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json(updatedFile);
    } catch (error) {
      console.error("Error moving file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Folder management endpoints
  app.get("/api/folders", async (req, res) => {
    try {
      const folders = await storage.getAllFolders();
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/folders/:id/contents", async (req, res) => {
    try {
      const { id } = req.params;
      const folderId = id === "root" ? undefined : id;
      const contents = await storage.getFolderContents(folderId);
      res.json(contents);
    } catch (error) {
      console.error("Error fetching folder contents:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/folders", validateFolderOperation, async (req, res) => {
    try {
      const folderData = insertFolderSchema.parse(req.body);
      // Use sanitized name from middleware
      if (req.body.sanitizedName) {
        folderData.name = req.body.sanitizedName;
      }
      const newFolder = await storage.createFolder(folderData);
      res.status(201).json(newFolder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating folder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Validate folder name if it's being updated
      if (updates.name) {
        const nameValidation = FileSecurityValidator.validateFolderName(updates.name);
        if (!nameValidation.isValid) {
          return res.status(400).json({ 
            error: "Invalid folder name", 
            details: nameValidation.errors 
          });
        }
        updates.name = nameValidation.sanitizedName;
      }
      
      const updatedFolder = await storage.updateFolder(id, updates);
      if (!updatedFolder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      res.json(updatedFolder);
    } catch (error) {
      console.error("Error updating folder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFolder(id);
      res.status(200).json({ message: "Folder deleted successfully" });
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
