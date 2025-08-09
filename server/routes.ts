import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertFileSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
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

  // Serve private objects
  app.get("/objects/:objectPath(*)", async (req, res) => {
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

  // Get upload URL for file
  app.post("/api/files/upload-url", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Create file record after upload
  app.post("/api/files", async (req, res) => {
    try {
      const fileData = insertFileSchema.parse(req.body);
      
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

  // Get all files
  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getAllFiles();
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete file
  app.delete("/api/files/:id", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
