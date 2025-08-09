import type { Express } from "express";
import { createServer, type Server } from "http";
import { awsStorageService } from "./aws-storage";
import { randomUUID } from "crypto";

/**
 * AWS S3 Routes for File Management
 * This replaces the current Google Cloud Storage routes
 */
export async function registerAWSRoutes(app: Express): Promise<Server> {
  
  // Endpoint to serve files from S3
  app.get("/objects/:key(*)", async (req, res) => {
    try {
      const key = req.params.key;
      await awsStorageService.streamObject(key, res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(404).json({ error: "File not found" });
    }
  });

  // Endpoint to get upload URL for S3
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const { uploadURL, key } = await awsStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, key });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Endpoint for file upload completion (sets metadata)
  app.put("/api/objects/:key(*)", async (req, res) => {
    try {
      const key = req.params.key;
      const { fileName, fileSize, contentType } = req.body;

      // Verify the file exists in S3
      const exists = await awsStorageService.objectExists(key);
      if (!exists) {
        return res.status(404).json({ error: "File not found in storage" });
      }

      // Generate the public path for the uploaded file
      const objectPath = `/objects/${key}`;

      res.json({ 
        objectPath,
        key,
        fileName,
        fileSize,
        contentType,
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error processing file upload completion:", error);
      res.status(500).json({ error: "Failed to process upload completion" });
    }
  });

  // Endpoint to delete files from S3
  app.delete("/api/objects/:key(*)", async (req, res) => {
    try {
      const key = req.params.key;
      await awsStorageService.deleteObject(key);
      res.json({ success: true, message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Endpoint to move/rename files in S3
  app.post("/api/objects/:key(*)/move", async (req, res) => {
    try {
      const sourceKey = req.params.key;
      const { destinationKey } = req.body;

      if (!destinationKey) {
        return res.status(400).json({ error: "Destination key is required" });
      }

      await awsStorageService.moveObject(sourceKey, destinationKey);
      
      res.json({ 
        success: true, 
        message: "File moved successfully",
        newObjectPath: `/objects/${destinationKey}`
      });
    } catch (error) {
      console.error("Error moving file:", error);
      res.status(500).json({ error: "Failed to move file" });
    }
  });

  // Endpoint to copy files in S3
  app.post("/api/objects/:key(*)/copy", async (req, res) => {
    try {
      const sourceKey = req.params.key;
      const { destinationKey } = req.body;

      if (!destinationKey) {
        return res.status(400).json({ error: "Destination key is required" });
      }

      await awsStorageService.copyObject(sourceKey, destinationKey);
      
      res.json({ 
        success: true, 
        message: "File copied successfully",
        newObjectPath: `/objects/${destinationKey}`
      });
    } catch (error) {
      console.error("Error copying file:", error);
      res.status(500).json({ error: "Failed to copy file" });
    }
  });

  // Endpoint to list objects in S3 (for folder contents)
  app.get("/api/objects", async (req, res) => {
    try {
      const { prefix } = req.query;
      const objects = await awsStorageService.listObjects(prefix as string);
      
      const formattedObjects = objects.map(obj => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        objectPath: `/objects/${obj.Key}`,
        publicUrl: awsStorageService.getPublicUrl(obj.Key || '')
      }));

      res.json({ objects: formattedObjects });
    } catch (error) {
      console.error("Error listing objects:", error);
      res.status(500).json({ error: "Failed to list objects" });
    }
  });

  // Endpoint to get object metadata
  app.get("/api/objects/:key(*)/metadata", async (req, res) => {
    try {
      const key = req.params.key;
      const metadata = await awsStorageService.getObjectMetadata(key);
      
      res.json({
        key,
        size: metadata.ContentLength,
        contentType: metadata.ContentType,
        lastModified: metadata.LastModified,
        etag: metadata.ETag,
        metadata: metadata.Metadata
      });
    } catch (error: any) {
      console.error("Error getting object metadata:", error);
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
        res.status(404).json({ error: "File not found" });
      } else {
        res.status(500).json({ error: "Failed to get file metadata" });
      }
    }
  });

  // Endpoint for presigned POST (alternative upload method)
  app.post("/api/objects/presigned-post", async (req, res) => {
    try {
      const { fileName, contentType } = req.body;
      const key = `uploads/${randomUUID()}-${fileName}`;
      
      const presignedPost = await awsStorageService.getPresignedPost(key, contentType);
      
      res.json({
        ...presignedPost,
        key,
        objectPath: `/objects/${key}`
      });
    } catch (error) {
      console.error("Error generating presigned POST:", error);
      res.status(500).json({ error: "Failed to generate presigned POST" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}