# Security Guide: Preventing Malicious Uploads

## 🔒 Comprehensive Security Implementation

Your file management application now includes enterprise-grade security measures to prevent malicious uploads and protect against various attack vectors.

---

## 🛡️ Security Features Implemented

### 1. File Type Validation
**Whitelist Approach:** Only explicitly allowed file types can be uploaded.

**Allowed File Types:**
- **Images:** JPEG, PNG, GIF, WebP, SVG, BMP, TIFF
- **Documents:** PDF, Word, Excel, PowerPoint, Text, CSV, RTF
- **Archives:** ZIP, RAR, 7Z, GZIP, TAR
- **Audio:** MP3, WAV, M4A, AAC, OGG, FLAC
- **Video:** MP4, MPEG, MOV, AVI, WebM, OGV
- **Code/Text:** JSON, XML, HTML, CSS, JavaScript

**Protection Against:**
- Executable files (.exe, .bat, .cmd, .scr)
- Script files (.php, .asp, .jsp, .py, .rb)
- System files (.dll, .sys, .msi)

### 2. File Signature Validation
**Magic Number Detection:** Validates file content against declared MIME type.

**Protection Against:**
- File extension spoofing
- Hidden executable code in images
- Polyglot files (files that are valid in multiple formats)

**Example:** A `.jpg` file that's actually an executable will be rejected.

### 3. Filename Security
**Sanitization Process:**
- Removes directory traversal attempts (`../`, `~/`)
- Strips invalid characters (`<>:"|?*`)
- Prevents Windows reserved names (CON, PRN, AUX, etc.)
- Adds timestamp and random prefix to prevent conflicts

**Before:** `../../etc/passwd.txt`
**After:** `1699123456_abc123de_passwd.txt`

### 4. File Size Limits
**Type-Specific Limits:**
- Images: 10MB maximum
- Videos: 100MB maximum
- Audio: 50MB maximum
- PDFs: 20MB maximum
- Default: 25MB maximum

### 5. Rate Limiting
**Upload Protection:**
- Maximum 10 uploads per minute per client
- IP-based tracking with user-agent fingerprinting
- Automatic cleanup of expired rate limit records

### 6. Content Scanning
**Script Detection in Images:**
- Scans for embedded JavaScript, VBScript
- Detects HTML event handlers (onload, onerror)
- Prevents XSS attacks through image files

**Example Blocked Content:**
```html
<script>alert('XSS')</script>
<img src="x" onerror="evil()">
javascript:alert(1)
```

### 7. Security Headers
**HTTP Security Headers Applied:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy` with strict rules
- `Referrer-Policy: strict-origin-when-cross-origin`

### 8. Access Control
**File Access Validation:**
- Path traversal prevention for downloads
- Suspicious file extension blocking
- Request logging for security events

### 9. Folder Security
**Folder Name Validation:**
- Prevents directory traversal attempts
- Removes invalid characters
- Blocks Windows reserved names
- Sanitizes folder names automatically

---

## 🚨 Attack Vectors Prevented

### 1. **File Upload Attacks**
- **Malicious Executables:** Prevented by file type whitelist
- **Web Shells:** PHP/ASP scripts blocked by extension and content validation
- **Polyglot Files:** Detected by magic number validation

### 2. **Path Traversal Attacks**
- **Directory Traversal:** `../` sequences blocked in filenames and paths
- **Absolute Paths:** Files starting with `/` or `~` rejected
- **Windows Paths:** `C:\` and similar paths prevented

### 3. **Cross-Site Scripting (XSS)**
- **Embedded Scripts:** JavaScript in image files detected and blocked
- **HTML Injection:** HTML tags in filenames sanitized
- **Event Handlers:** onclick, onload, etc. detected in file content

### 4. **Denial of Service (DoS)**
- **Large Files:** Size limits prevent storage exhaustion
- **Upload Flooding:** Rate limiting prevents rapid file uploads
- **Resource Exhaustion:** Memory and processing limits enforced

### 5. **File System Attacks**
- **Reserved Names:** Windows system files (CON, PRN) blocked
- **Hidden Files:** Files starting with `.` prevented
- **Special Characters:** Invalid filename characters sanitized

---

## 🔍 Security Validation Process

### File Upload Flow:
1. **Pre-upload Validation**
   - File size check
   - Extension validation
   - MIME type verification
   - Rate limit check

2. **Upload Processing**
   - Filename sanitization
   - Content-type validation
   - Secure filename generation

3. **Post-upload Verification**
   - File signature validation
   - Content scanning for malicious code
   - Final security check before storage

4. **Access Control**
   - Path validation on download
   - Security headers on response
   - Event logging for monitoring

---

## 📋 Security Configuration

### Environment Variables:
```bash
# File size limits (in bytes)
MAX_FILE_SIZE_IMAGE=10485760      # 10MB
MAX_FILE_SIZE_VIDEO=104857600     # 100MB
MAX_FILE_SIZE_AUDIO=52428800      # 50MB
MAX_FILE_SIZE_DEFAULT=26214400    # 25MB

# Rate limiting
UPLOAD_RATE_LIMIT=10              # uploads per minute
RATE_LIMIT_WINDOW=60000           # 1 minute in ms

# Security settings
ENABLE_VIRUS_SCANNING=true        # Future: virus scanning
ENABLE_CONTENT_SCANNING=true      # Script detection in files
STRICT_MIME_VALIDATION=true       # Enforce MIME type matching
```

### Customizing Allowed File Types:
```typescript
// In server/security.ts, modify these sets:
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'application/pdf',
  // Add your specific types here
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.pdf',
  // Add your extensions here
]);
```

---

## 🎯 Security Best Practices

### 1. **Regular Updates**
- Keep security rules updated
- Monitor for new attack vectors
- Update allowed file types as needed

### 2. **Monitoring**
- Review security event logs regularly
- Set up alerts for multiple failed uploads
- Monitor unusual file upload patterns

### 3. **Storage Security**
- Use separate storage buckets for different file types
- Implement virus scanning for uploaded files
- Regular backup and integrity checks

### 4. **Network Security**
- Use HTTPS for all file uploads
- Implement CDN with DDoS protection
- Monitor bandwidth usage

### 5. **User Education**
- Inform users about allowed file types
- Provide clear error messages for rejected files
- Educate about security best practices

---

## 🔧 Testing Security

### Manual Testing:
```bash
# Test file extension spoofing
curl -X POST \
  -F "file=@malicious.exe.jpg" \
  -F "contentType=image/jpeg" \
  http://your-domain/api/files/upload-url

# Test directory traversal
curl -X POST \
  -F "fileName=../../../etc/passwd" \
  -F "fileSize=1024" \
  -F "contentType=text/plain" \
  http://your-domain/api/files/upload-url

# Test oversized file
curl -X POST \
  -F "fileSize=999999999" \
  -F "fileName=large.jpg" \
  -F "contentType=image/jpeg" \
  http://your-domain/api/files/upload-url
```

### Expected Responses:
- **File Extension Spoofing:** `400 Bad Request` with validation error
- **Directory Traversal:** `400 Bad Request` with filename error
- **Oversized File:** `400 Bad Request` with size limit error

---

## 📈 Monitoring & Logging

### Security Events Logged:
- Failed file validations
- Rate limit violations
- Suspicious filename attempts
- Content scanning detections

### Log Format:
```json
{
  "timestamp": "2025-01-09T12:00:00Z",
  "event": "SECURITY_VIOLATION",
  "type": "INVALID_FILE_TYPE",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "fileName": "malicious.exe",
  "details": "Executable file extension not allowed"
}
```

### Alerts to Set Up:
- Multiple failed uploads from same IP
- Unusual file types attempted
- Rate limit violations
- Large file upload attempts

---

## 🚀 Advanced Security (Future Enhancements)

### Virus Scanning Integration:
```typescript
// Future implementation with ClamAV or similar
import { scanFileForViruses } from './virus-scanner';

const scanResult = await scanFileForViruses(fileBuffer);
if (scanResult.infected) {
  throw new Error('Virus detected');
}
```

### Machine Learning Detection:
- File content analysis for anomalies
- Behavioral pattern detection
- Automatic threat classification

### Enterprise Features:
- Integration with SIEM systems
- Advanced threat intelligence
- Real-time security dashboard
- Automated incident response

---

Your file management application is now secured against malicious uploads with enterprise-grade protection measures. The multi-layered security approach ensures comprehensive protection while maintaining usability for legitimate users.