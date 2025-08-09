import { Request, Response, NextFunction } from 'express';
import { FileSecurityValidator, UploadRateLimiter } from './security';
import crypto from 'crypto';

// Extended Request interface for file validation
interface FileValidationRequest extends Request {
  fileValidation?: {
    isValid: boolean;
    errors: string[];
    sanitizedFilename: string;
    secureKey: string;
  };
  clientId?: string;
}

/**
 * Middleware to validate file uploads before processing
 */
export function validateFileUpload(req: FileValidationRequest, res: Response, next: NextFunction) {
  try {
    const { fileName, fileSize, contentType } = req.body;
    
    if (!fileName || !fileSize || !contentType) {
      return res.status(400).json({
        error: 'Missing required file information',
        details: 'fileName, fileSize, and contentType are required'
      });
    }
    
    // Generate client ID for rate limiting (based on IP and user agent)
    const clientId = crypto
      .createHash('sha256')
      .update(req.ip + (req.get('User-Agent') || ''))
      .digest('hex');
    
    req.clientId = clientId;
    
    // Check rate limiting
    const rateLimitResult = UploadRateLimiter.checkRateLimit(clientId);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too many upload attempts',
        details: `Rate limit exceeded. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`,
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      });
    }
    
    // Validate file
    const validation = FileSecurityValidator.validateFile(
      fileName,
      parseInt(fileSize),
      contentType
    );
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'File validation failed',
        details: validation.errors
      });
    }
    
    // Generate secure key for this upload
    const secureKey = crypto.randomBytes(32).toString('hex');
    
    // Attach validation results to request
    req.fileValidation = {
      isValid: validation.isValid,
      errors: validation.errors,
      sanitizedFilename: validation.sanitizedFilename,
      secureKey
    };
    
    // Add security headers
    res.set({
      'X-Upload-Validation': 'passed',
      'X-Rate-Limit-Remaining': rateLimitResult.remainingUploads.toString(),
      'X-Rate-Limit-Reset': rateLimitResult.resetTime.toString()
    });
    
    next();
  } catch (error) {
    console.error('File validation middleware error:', error);
    res.status(500).json({
      error: 'File validation failed',
      details: 'Internal server error during validation'
    });
  }
}

/**
 * Middleware to validate folder operations
 */
export function validateFolderOperation(req: Request, res: Response, next: NextFunction) {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Folder name is required'
      });
    }
    
    const validation = FileSecurityValidator.validateFolderName(name);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid folder name',
        details: validation.errors
      });
    }
    
    // Update request body with sanitized name
    req.body.sanitizedName = validation.sanitizedName;
    
    next();
  } catch (error) {
    console.error('Folder validation middleware error:', error);
    res.status(500).json({
      error: 'Folder validation failed',
      details: 'Internal server error during validation'
    });
  }
}

/**
 * Middleware to add security headers
 */
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for React
      "style-src 'self' 'unsafe-inline'", // Needed for styled components
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://storage.googleapis.com https://*.amazonaws.com",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  });
  
  next();
}

/**
 * Middleware to validate file access requests
 */
export function validateFileAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const filePath = req.params.key || req.params.objectPath;
    
    if (!filePath) {
      return res.status(400).json({
        error: 'File path is required'
      });
    }
    
    // Check for directory traversal attempts
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      return res.status(403).json({
        error: 'Invalid file path',
        details: 'Path contains forbidden characters'
      });
    }
    
    // Check for suspicious file extensions
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.php', '.asp', '.jsp'];
    const hasSupiciousExtension = suspiciousExtensions.some(ext => 
      filePath.toLowerCase().includes(ext)
    );
    
    if (hasSupiciousExtension) {
      return res.status(403).json({
        error: 'File type not allowed for access'
      });
    }
    
    next();
  } catch (error) {
    console.error('File access validation error:', error);
    res.status(500).json({
      error: 'File access validation failed'
    });
  }
}

/**
 * Middleware to log security events
 */
export function logSecurityEvents(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security-related responses
    if (res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 429) {
      const logData = {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        body: req.body,
        params: req.params,
        query: req.query
      };
      
      console.warn('SECURITY EVENT:', JSON.stringify(logData, null, 2));
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}