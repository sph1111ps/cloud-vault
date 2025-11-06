# 🌙 Continue Tonight - Security Hardening

## ✅ What We Accomplished Today

### Application Status: ✅ FULLY WORKING!
- ✅ Infrastructure deployed in us-east-2
- ✅ Application running and accessible
- ✅ Database connected and working
- ✅ Login/authentication working
- ✅ **File uploads WORKING** 🎉
- ✅ S3 storage configured
- ✅ CORS issue resolved
- ✅ Swap space added (2GB) for npm installs

### Issues Fixed Today
1. ✅ Corrupted tarball - recreated and reuploaded
2. ✅ XMLStringifier dependency issue - resolved with --legacy-peer-deps
3. ✅ Upload URL response nesting bug - fixed in routes.ts
4. ✅ S3 CORS configuration - applied directly to bucket
5. ✅ EC2 memory issues - added 2GB swap space

---

## 🎯 Current System Status

### Infrastructure (us-east-2)
```
EC2 IP:       18.116.87.179
Instance:     i-0ff1683d2b4f7d143
ALB URL:      filemanager-alb-141865427.us-east-2.elb.amazonaws.com
DB Endpoint:  filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com:5432
S3 Bucket:    filemanager-b3e86327
Region:       us-east-2
```

### Application Access
**URL:** `http://filemanager-alb-141865427.us-east-2.elb.amazonaws.com`

**Login Credentials:**
- Username: `admin`
- Password: `Admin123!`

### File Upload Support
All file types are working:
- ✅ Images: `.png`, `.jpg`, `.gif`, `.webp`, `.svg`
- ✅ Documents: `.pdf`, `.txt`, `.md`, `.docx`, `.xlsx`, `.pptx`
- ✅ Archives: `.zip`, `.rar`, `.7z`, `.tar`, `.gz`
- ✅ Audio: `.mp3`, `.wav`, `.m4a`, `.aac`
- ✅ Video: `.mp4`, `.mov`, `.avi`, `.webm`
- ✅ Code: `.json`, `.xml`, `.html`, `.css`, `.js`

---

## 🔐 TONIGHT: Security Hardening

### Current Security Score: **5.5/10** ⚠️

### Critical Security Issues to Fix

#### 1. Make RDS Database Private (HIGH PRIORITY)
**Current:** Database is publicly accessible from the internet
**Risk:** Anyone can attempt to connect to your database

**Fix:**
```bash
# Update RDS to be private
aws rds modify-db-instance \
  --db-instance-identifier filemanager-db \
  --no-publicly-accessible \
  --region us-east-2

# This will take 5-10 minutes to apply
aws rds describe-db-instances \
  --db-instance-identifier filemanager-db \
  --region us-east-2 \
  --query 'DBInstances[0].PubliclyAccessible'
```

After this, update your `.env` file on EC2 to use the private endpoint (it's the same, but only accessible from within the VPC).

**Estimated Time:** 15 minutes

---

#### 2. Change Admin Password (HIGH PRIORITY)
**Current:** Using weak password `Admin123!`
**Risk:** Easy to guess, vulnerable to brute force

**Fix (on EC2):**
```bash
cd /home/ec2-user/app

# Run Node.js to update password
node -e "
const bcrypt = require('bcrypt');
const newPassword = 'YOUR_STRONG_PASSWORD_HERE'; // Change this!
bcrypt.hash(newPassword, 10).then(hash => {
  console.log('New password hash:', hash);
  console.log('Run this SQL:');
  console.log(\`UPDATE users SET password_hash = '\${hash}' WHERE username = 'admin';\`);
});
"
```

Then connect to database and update:
```bash
PGPASSWORD='Sean123!' psql "host=filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com port=5432 dbname=filemanager user=filemanager sslmode=require" -c "UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE username = 'admin';"
```

**Estimated Time:** 10 minutes

---

#### 3. Generate Strong SESSION_SECRET (HIGH PRIORITY)
**Current:** Using placeholder "your-random-secret-here-change-this"
**Risk:** Sessions can be hijacked or forged

**Fix (on EC2):**
```bash
cd /home/ec2-user/app

# Generate a strong random secret
NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Update .env file
sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${NEW_SECRET}/" .env

# Restart app
pm2 restart cloud-vault

# Verify
pm2 logs --lines 10
```

**Note:** This will log out all existing users (including you).

**Estimated Time:** 5 minutes

---

#### 4. Enable HTTPS/SSL (MEDIUM PRIORITY)
**Current:** Only HTTP, all traffic unencrypted
**Risk:** Passwords and data sent in plain text

**Options:**

**Option A: Use AWS Certificate Manager + ALB (Recommended)**
- Request SSL certificate from AWS ACM (free)
- Attach to ALB
- Requires a domain name

**Option B: Use Let's Encrypt on EC2**
- Install certbot
- Configure nginx as reverse proxy with SSL
- Works with IP or domain

**Estimated Time:** 30-60 minutes (depending on option)

For tonight, you can skip this if you don't have a domain name ready.

---

#### 5. Enable Database Backups (MEDIUM PRIORITY)
**Current:** No automated backups
**Risk:** Data loss if something goes wrong

**Fix:**
```bash
# Enable automated backups (7 day retention)
aws rds modify-db-instance \
  --db-instance-identifier filemanager-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --region us-east-2

# Verify
aws rds describe-db-instances \
  --db-instance-identifier filemanager-db \
  --region us-east-2 \
  --query 'DBInstances[0].BackupRetentionPeriod'
```

**Estimated Time:** 5 minutes

---

#### 6. Restrict Security Groups (MEDIUM PRIORITY)
**Current:** Some security groups may be too open
**Risk:** Unnecessary attack surface

**Check current rules:**
```bash
# List security groups
aws ec2 describe-security-groups --region us-east-2 --filters "Name=group-name,Values=*filemanager*" --query 'SecurityGroups[*].[GroupId,GroupName]'

# Check RDS security group rules
aws ec2 describe-security-groups --region us-east-2 --filters "Name=group-name,Values=*rds*" --query 'SecurityGroups[*].IpPermissions'
```

**Review and restrict:**
- RDS should only allow connections from EC2 security group (not 0.0.0.0/0)
- EC2 should only allow SSH from your IP (not 0.0.0.0/0)
- ALB should allow HTTP/HTTPS from anywhere

**Estimated Time:** 20 minutes

---

#### 7. Add Rate Limiting (LOW PRIORITY)
**Current:** No rate limiting
**Risk:** Vulnerable to brute force attacks

**Fix (requires code changes):**
Install express-rate-limit:
```bash
cd /home/ec2-user/app
npm install express-rate-limit --legacy-peer-deps
```

Then update `server/index.ts` to add rate limiting middleware.

**Estimated Time:** 15 minutes (can do later)

---

## 📋 Recommended Order for Tonight

### Phase 1: Quick Wins (30 minutes)
1. ✅ Change admin password (10 min)
2. ✅ Generate strong SESSION_SECRET (5 min)
3. ✅ Enable database backups (5 min)
4. ✅ Make RDS private (10 min)

### Phase 2: Security Review (20 minutes)
5. ✅ Review and restrict security groups (20 min)

### Phase 3: Optional (if time)
6. ⏭️ Set up HTTPS (skip if no domain)
7. ⏭️ Add rate limiting (can do later)

**Total Time: ~50 minutes for critical items**

---

## 🔧 Quick Reference Commands

### SSH to EC2
```bash
ssh -i ~/filemanager-key-east2.pem ec2-user@18.116.87.179
```

### PM2 Management
```bash
pm2 status                    # Check status
pm2 logs cloud-vault          # View logs
pm2 restart cloud-vault       # Restart app
pm2 stop cloud-vault          # Stop app
```

### Database Connection
```bash
PGPASSWORD='Sean123!' psql "host=filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com port=5432 dbname=filemanager user=filemanager sslmode=require"
```

### S3 Operations
```bash
# List uploaded files
aws s3 ls s3://filemanager-b3e86327/uploads/ --region us-east-2

# Check bucket CORS
aws s3api get-bucket-cors --bucket filemanager-b3e86327 --region us-east-2
```

### System Resources
```bash
# Check memory
free -h

# Check disk space
df -h

# Check swap
swapon --show
```

---

## 🐛 Troubleshooting

### If App Stops Responding
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs cloud-vault --lines 50

# Restart if needed
pm2 restart cloud-vault
```

### If Upload Fails
```bash
# Check S3 CORS
aws s3api get-bucket-cors --bucket filemanager-b3e86327 --region us-east-2

# Check browser console (F12) for CORS errors
```

### If Database Connection Fails (After Making Private)
```bash
# Make sure you're using the internal endpoint in .env
# The endpoint stays the same, but it's only accessible from EC2 now

# Test connection from EC2
PGPASSWORD='Sean123!' psql "host=filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com port=5432 dbname=filemanager user=filemanager sslmode=require" -c "SELECT 1;"
```

### If npm install Hangs
```bash
# Check if swap is active
swapon --show

# If not, reactivate it
sudo swapon /swapfile

# Clear cache and retry
npm cache clean --force
npm install --legacy-peer-deps
```

---

## 📊 After Security Hardening

Your security score should improve to **8/10** after completing Phase 1 & 2:

**Fixed:**
- ✅ Database made private
- ✅ Strong admin password
- ✅ Strong session secret
- ✅ Database backups enabled
- ✅ Security groups restricted

**Still Missing (Optional):**
- ⏭️ HTTPS/SSL (need domain)
- ⏭️ Rate limiting
- ⏭️ WAF (Web Application Firewall)
- ⏭️ CloudWatch monitoring/alarms

---

## 🎯 Success Criteria

After tonight's security work, you should have:
1. ✅ Database only accessible from within VPC
2. ✅ Strong admin password
3. ✅ Strong session secret (all users logged out)
4. ✅ Automated database backups enabled
5. ✅ Security groups properly restricted
6. ✅ Application still working after all changes

---

## 📝 Testing After Security Changes

1. **Test Login**
   - Visit the ALB URL
   - Login with new admin password
   - Should work normally

2. **Test File Upload**
   - Upload a test file
   - Verify it appears in file list
   - Download it back
   - Delete it

3. **Test Database Connection**
   - App should still connect (using internal endpoint)
   - No errors in PM2 logs

4. **Test from Outside VPC**
   - Try connecting to RDS from your local machine
   - Should FAIL (this is good! It's private now)

---

## 🚀 Future Enhancements (After Security)

### Performance
- Add CloudFront CDN for static assets
- Implement file caching
- Optimize database queries
- Add database connection pooling

### Features
- Multi-user support with permissions
- File sharing links (public/private)
- File versioning
- Search functionality
- Folder organization
- Bulk operations
- File preview (images/PDFs)

### Operations
- CloudWatch monitoring and alarms
- Cost optimization review
- Automated deployment pipeline
- Staging environment

---

## 📁 Important Files

### On EC2
- `/home/ec2-user/app/.env` - Environment variables (DB password, secrets)
- `/home/ec2-user/app/ecosystem.config.cjs` - PM2 configuration
- `/home/ec2-user/.pm2/logs/` - Application logs

### On Local Machine
- `C:\Users\Sean\cloud-vault\` - Application source code
- `C:\Users\Sean\cloud-vault\terraform\` - Infrastructure as Code
- `C:\Users\Sean\cloud-vault\server\routes.ts` - API routes (upload fix)
- `C:\Users\Sean\cloud-vault\server\aws-storage.ts` - S3 storage service

---

## 💡 Key Learnings from Today

1. **Swap Space is Critical** - t2.micro needs swap for npm installs
2. **CORS Must Match** - S3 CORS must allow ALB origin for uploads
3. **Response Structure Matters** - Don't double-wrap API responses
4. **Dependencies Can Break** - Use --legacy-peer-deps when needed
5. **Tarball Validation** - Always test tarballs with `tar -tzf` before extracting
6. **PM2 Environment** - Use ecosystem.config.cjs to load .env properly

---

Good luck with the security hardening tonight! 🔐

**Start with Phase 1 (30 min) - the quick wins that have the biggest security impact.**

See you tonight! 🌙

