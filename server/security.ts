import crypto from 'crypto';
import path from 'path';

// File type validation
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
  
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
  
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  
  // Video
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/ogg',
  
  // Code/Text
  'application/json',
  'application/xml',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'text/markdown',
  
  // 3D Models
  'application/octet-stream', // For .fbx, .obj, .dae and other 3D formats
  'model/gltf+json',
  'model/gltf-binary',
  'application/x-blender'
]);

const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff',
  
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf',
  
  // Archives
  '.zip', '.rar', '.7z', '.gz', '.tar',
  
  // Audio
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
  
  // Video
  '.mp4', '.mpeg', '.mov', '.avi', '.webm', '.ogv',
  
  // Code/Text
  '.json', '.xml', '.html', '.css', '.js', '.md',
  
  // 3D Models
  '.fbx', '.obj', '.dae', '.3ds', '.ply', '.stl', '.x3d', '.gltf', '.glb', '.blend'
]);

// Dangerous file signatures (magic numbers)
const DANGEROUS_SIGNATURES = [
  Buffer.from([0x4D, 0x5A]), // PE/EXE files
  Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (check contents)
  Buffer.from([0xFF, 0xE0]), // JPEG with potential script
  Buffer.from([0x47, 0x49, 0x46, 0x38]), // GIF (check for scripts)
  Buffer.from([0x3C, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), // <script
  Buffer.from([0x3C, 0x68, 0x74, 0x6D, 0x6C]), // <html
  Buffer.from([0x3C, 0x3F, 0x70, 0x68, 0x70]), // <?php
];

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  'image/*': 10 * 1024 * 1024, // 10MB for images
  'video/*': 100 * 1024 * 1024, // 100MB for videos
  'audio/*': 50 * 1024 * 1024, // 50MB for audio
  'application/pdf': 20 * 1024 * 1024, // 20MB for PDFs
  'application/octet-stream': 200 * 1024 * 1024, // 200MB for 3D models and binary files
  'model/*': 200 * 1024 * 1024, // 200MB for 3D model files
  'default': 25 * 1024 * 1024 // 25MB default
};

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedFilename: string;
  detectedMimeType?: string;
}

export class FileSecurityValidator {
  
  /**
   * Validate file upload security
   */
  static validateFile(
    originalFilename: string,
    fileSize: number,
    mimeType: string,
    fileBuffer?: Buffer
  ): FileValidationResult {
    const errors: string[] = [];
    
    // 1. Validate filename
    const filenameValidation = this.validateFilename(originalFilename);
    if (!filenameValidation.isValid) {
      errors.push(...filenameValidation.errors);
    }
    
    // 2. Validate file extension
    const extension = path.extname(originalFilename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      errors.push(`File extension '${extension}' is not allowed`);
    }
    
    // 3. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      errors.push(`File type '${mimeType}' is not allowed`);
    }
    
    // 4. Validate file size
    const sizeValidation = this.validateFileSize(fileSize, mimeType);
    if (!sizeValidation.isValid) {
      errors.push(...sizeValidation.errors);
    }
    
    // 5. Validate file content (if buffer provided)
    if (fileBuffer) {
      const contentValidation = this.validateFileContent(fileBuffer, mimeType);
      if (!contentValidation.isValid) {
        errors.push(...contentValidation.errors);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedFilename: filenameValidation.sanitizedFilename,
      detectedMimeType: mimeType
    };
  }
  
  /**
   * Validate and sanitize filename
   */
  private static validateFilename(filename: string): { isValid: boolean; errors: string[]; sanitizedFilename: string } {
    const errors: string[] = [];
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\./g, // Directory traversal
      /[<>:"|?*]/g, // Invalid filename characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
      /\.(bat|cmd|exe|scr|pif|com|msi|dll|jar)$/i, // Executable extensions
      /\.(php|asp|aspx|jsp|py|rb|pl|sh|bash)$/i, // Script files
      /^\./, // Hidden files starting with dot
    ];
    
    // Check filename length
    if (filename.length > 255) {
      errors.push('Filename is too long (max 255 characters)');
    }
    
    if (filename.length === 0) {
      errors.push('Filename cannot be empty');
    }
    
    // Check for dangerous patterns
    dangerousPatterns.forEach((pattern, index) => {
      if (pattern.test(filename)) {
        const patternNames = [
          'directory traversal attempts',
          'invalid filename characters',
          'Windows reserved names',
          'executable file extensions',
          'script file extensions',
          'hidden files'
        ];
        errors.push(`Filename contains ${patternNames[index]}`);
      }
    });
    
    // Sanitize filename
    let sanitized = filename
      .replace(/[<>:"|?*]/g, '_') // Replace invalid chars
      .replace(/\.\./g, '_') // Replace directory traversal
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/[^\w\s.-]/g, ''); // Remove special characters except word chars, spaces, dots, hyphens
    
    // Ensure extension is preserved and valid
    const originalExt = path.extname(filename);
    const sanitizedExt = path.extname(sanitized);
    
    if (originalExt && !sanitizedExt) {
      sanitized += originalExt;
    }
    
    // Add timestamp prefix to avoid conflicts
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    sanitized = `${timestamp}_${randomSuffix}_${sanitized}`;
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedFilename: sanitized
    };
  }
  
  /**
   * Validate file size based on type
   */
  private static validateFileSize(fileSize: number, mimeType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Get size limit based on MIME type
    let sizeLimit = FILE_SIZE_LIMITS.default;
    
    for (const [pattern, limit] of Object.entries(FILE_SIZE_LIMITS)) {
      if (pattern !== 'default' && mimeType.startsWith(pattern.replace('*', ''))) {
        sizeLimit = limit;
        break;
      }
    }
    
    if (fileSize > sizeLimit) {
      errors.push(`File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds limit of ${Math.round(sizeLimit / 1024 / 1024)}MB`);
    }
    
    if (fileSize === 0) {
      errors.push('File is empty');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate file content by examining file signatures
   */
  private static validateFileContent(fileBuffer: Buffer, expectedMimeType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for dangerous file signatures
    for (const signature of DANGEROUS_SIGNATURES) {
      if (fileBuffer.subarray(0, signature.length).equals(signature)) {
        errors.push('File contains potentially dangerous content');
        break;
      }
    }
    
    // Validate file signature matches expected MIME type
    const detectedType = this.detectMimeTypeFromSignature(fileBuffer);
    if (detectedType && detectedType !== expectedMimeType) {
      // Allow some flexibility for similar types
      const isFlexibleMatch = this.isFlexibleMimeTypeMatch(detectedType, expectedMimeType);
      if (!isFlexibleMatch) {
        errors.push(`File content doesn't match declared type. Expected: ${expectedMimeType}, Detected: ${detectedType}`);
      }
    }
    
    // Check for embedded scripts in images
    if (expectedMimeType.startsWith('image/')) {
      const scriptPatterns = [
        /(<script[\s\S]*?>[\s\S]*?<\/script>)/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi
      ];
      
      const content = fileBuffer.toString('ascii');
      for (const pattern of scriptPatterns) {
        if (pattern.test(content)) {
          errors.push('Image file contains potentially malicious scripts');
          break;
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Detect MIME type from file signature
   */
  private static detectMimeTypeFromSignature(fileBuffer: Buffer): string | null {
    const signatures: { [key: string]: Buffer } = {
      'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
      'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
      'image/gif': Buffer.from([0x47, 0x49, 0x46]),
      'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
      'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
      'application/zip': Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      'audio/mpeg': Buffer.from([0xFF, 0xFB]),
      'video/mp4': Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])
    };
    
    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (fileBuffer.subarray(0, signature.length).equals(signature)) {
        return mimeType;
      }
    }
    
    return null;
  }
  
  /**
   * Check if MIME types are flexibly compatible
   */
  private static isFlexibleMimeTypeMatch(detected: string, expected: string): boolean {
    const flexibleMatches = [
      ['image/jpeg', 'image/jpg'],
      ['application/javascript', 'text/javascript'],
      ['application/xml', 'text/xml']
    ];
    
    for (const [type1, type2] of flexibleMatches) {
      if ((detected === type1 && expected === type2) || (detected === type2 && expected === type1)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate secure filename for storage
   */
  static generateSecureFilename(originalFilename: string): string {
    const extension = path.extname(originalFilename).toLowerCase();
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    
    return `${timestamp}_${randomBytes}${extension}`;
  }
  
  /**
   * Validate folder name
   */
  static validateFolderName(folderName: string): { isValid: boolean; errors: string[]; sanitizedName: string } {
    const errors: string[] = [];
    
    // Check folder name patterns
    const dangerousPatterns = [
      /\.\./g, // Directory traversal
      /[<>:"|?*\/\\]/g, // Invalid folder characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
      /^\./, // Hidden folders starting with dot
    ];
    
    if (folderName.length > 100) {
      errors.push('Folder name is too long (max 100 characters)');
    }
    
    if (folderName.length === 0 || folderName.trim().length === 0) {
      errors.push('Folder name cannot be empty');
    }
    
    dangerousPatterns.forEach((pattern, index) => {
      if (pattern.test(folderName)) {
        const patternNames = [
          'directory traversal attempts',
          'invalid folder characters',
          'Windows reserved names',
          'hidden folders'
        ];
        errors.push(`Folder name contains ${patternNames[index]}`);
      }
    });
    
    // Sanitize folder name
    const sanitized = folderName
      .trim()
      .replace(/[<>:"|?*\/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/^\.+/, '')
      .replace(/\s+/g, '_')
      .replace(/[^\w\s.-]/g, '');
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedName: sanitized
    };
  }
}

/**
 * Rate limiting for file uploads
 */
export class UploadRateLimiter {
  private static uploadCounts = new Map<string, { count: number; resetTime: number }>();
  private static readonly UPLOAD_LIMIT = 10; // uploads per window
  private static readonly WINDOW_SIZE = 60 * 1000; // 1 minute
  
  static checkRateLimit(clientId: string): { allowed: boolean; remainingUploads: number; resetTime: number } {
    const now = Date.now();
    const clientData = this.uploadCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize counter
      this.uploadCounts.set(clientId, {
        count: 1,
        resetTime: now + this.WINDOW_SIZE
      });
      
      return {
        allowed: true,
        remainingUploads: this.UPLOAD_LIMIT - 1,
        resetTime: now + this.WINDOW_SIZE
      };
    }
    
    if (clientData.count >= this.UPLOAD_LIMIT) {
      return {
        allowed: false,
        remainingUploads: 0,
        resetTime: clientData.resetTime
      };
    }
    
    clientData.count++;
    
    return {
      allowed: true,
      remainingUploads: this.UPLOAD_LIMIT - clientData.count,
      resetTime: clientData.resetTime
    };
  }
  
  static cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.uploadCounts.entries());
    for (const [clientId, data] of entries) {
      if (now > data.resetTime) {
        this.uploadCounts.delete(clientId);
      }
    }
  }
}

// Cleanup rate limiter every 5 minutes
setInterval(() => {
  UploadRateLimiter.cleanup();
}, 5 * 60 * 1000);