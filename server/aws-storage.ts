import AWS from 'aws-sdk';
import { Response } from 'express';
import { randomUUID } from 'crypto';

// Configure AWS SDK
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  // Credentials will be automatically loaded from IAM role when deployed on EC2
  // For local development, you can use AWS credentials file or environment variables
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'your-app-bucket';

export class AWSStorageService {
  /**
   * Generate a signed URL for uploading files to S3
   */
  async getSignedUploadUrl(key: string, contentType?: string): Promise<string> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 900, // 15 minutes
      ContentType: contentType || 'application/octet-stream',
      ServerSideEncryption: 'AES256'
    };
    
    return s3.getSignedUrl('putObject', params);
  }

  /**
   * Generate a signed URL for downloading files from S3
   */
  async getSignedDownloadUrl(key: string): Promise<string> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 3600 // 1 hour
    };
    
    return s3.getSignedUrl('getObject', params);
  }

  /**
   * Generate upload URL for file entities
   */
  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; key: string }> {
    const fileId = randomUUID();
    const key = `uploads/${fileId}`;
    const uploadURL = await this.getSignedUploadUrl(key);
    
    return { uploadURL, key };
  }

  /**
   * Delete an object from S3
   */
  async deleteObject(key: string): Promise<void> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
  }

  /**
   * List objects in S3 bucket with optional prefix
   */
  async listObjects(prefix?: string) {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix || '',
      MaxKeys: 1000
    };
    
    const result = await s3.listObjectsV2(params).promise();
    return result.Contents || [];
  }

  /**
   * Stream an object from S3 to HTTP response
   */
  async streamObject(key: string, res: Response): Promise<void> {
    try {
      // First, get object metadata to set proper headers
      const headParams = {
        Bucket: BUCKET_NAME,
        Key: key
      };
      
      const metadata = await s3.headObject(headParams).promise();
      
      // Set appropriate headers
      res.set({
        'Content-Type': metadata.ContentType || 'application/octet-stream',
        'Content-Length': metadata.ContentLength?.toString() || '0',
        'Cache-Control': 'public, max-age=3600',
        'ETag': metadata.ETag || '',
        'Last-Modified': metadata.LastModified?.toUTCString() || ''
      });

      // Stream the object
      const params = {
        Bucket: BUCKET_NAME,
        Key: key
      };
      
      const stream = s3.getObject(params).createReadStream();
      
      stream.on('error', (err) => {
        console.error('S3 stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });

      stream.pipe(res);
    } catch (error: any) {
      console.error('Error streaming object:', error);
      if (error.code === 'NoSuchKey') {
        res.status(404).json({ error: 'File not found' });
      } else {
        res.status(500).json({ error: 'Error streaming file' });
      }
    }
  }

  /**
   * Check if an object exists in S3
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key
      };
      
      await s3.headObject(params).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get object metadata
   */
  async getObjectMetadata(key: string) {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    return s3.headObject(params).promise();
  }

  /**
   * Copy an object within S3 (useful for move operations)
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const params = {
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${sourceKey}`,
      Key: destinationKey
    };
    
    await s3.copyObject(params).promise();
  }

  /**
   * Move an object within S3 (copy then delete)
   */
  async moveObject(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copyObject(sourceKey, destinationKey);
    await this.deleteObject(sourceKey);
  }

  /**
   * Get public URL for an object (if bucket allows public access)
   */
  getPublicUrl(key: string): string {
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
  }

  /**
   * Normalize object path for consistent handling
   */
  normalizeObjectPath(rawPath: string): string {
    if (rawPath.startsWith('https://')) {
      // Extract key from full S3 URL
      const url = new URL(rawPath);
      return url.pathname.substring(1); // Remove leading slash
    }
    
    return rawPath;
  }

  /**
   * Generate presigned POST data for direct browser uploads
   */
  async getPresignedPost(key: string, contentType?: string) {
    const params = {
      Bucket: BUCKET_NAME,
      Fields: {
        key: key,
        'Content-Type': contentType || 'application/octet-stream'
      },
      Expires: 900, // 15 minutes
      Conditions: [
        ['content-length-range', 0, 10485760], // 10MB max
      ]
    };
    
    return s3.createPresignedPost(params);
  }
}

export const awsStorageService = new AWSStorageService();