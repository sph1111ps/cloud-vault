# 🔒 Security Audit & Enhancement Guide

## ✅ Current Status - DEPLOYMENT SUCCESSFUL!

### Live Application
- **URL:** http://filemanager-alb-141865427.us-east-2.elb.amazonaws.com
- **Admin:** `admin` / `Admin123!`
- **Status:** ✅ Fully operational

### Infrastructure (us-east-2)
```
EC2 IP:       18.116.87.179
Instance:     i-0ff1683d2b4f7d143
ALB URL:      filemanager-alb-141865427.us-east-2.elb.amazonaws.com
DB Endpoint:  filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com:5432
S3 Bucket:    filemanager-b3e86327
Region:       us-east-2
```

---

## 🔐 SECURITY AUDIT CHECKLIST

### 🚨 CRITICAL ISSUES (Fix Tonight)

#### 1. **Database Publicly Accessible**
**Risk:** Anyone can try to connect to your RDS instance from the internet
**Status:** ⚠️ VULNERABLE

**Fix:**
```bash
aws rds modify-db-instance \
  --db-instance-identifier filemanager-db \
  --no-publicly-accessible \
  --apply-immediately \
  --region us-east-2
```

**Alternative (Terraform):**
Edit `terraform/rds.tf`:
```hcl
resource "aws_db_instance" "this" {
  # ... existing config ...
  publicly_accessible    = false  # Change from true
}
```

Then run:
```bash
cd terraform
terraform apply
```

---

#### 2. **Weak Admin Password**
**Risk:** Default password is easy to guess
**Status:** ⚠️ VULNERABLE

**Fix:**
1. Login to application: http://filemanager-alb-141865427.us-east-2.elb.amazonaws.com
2. Navigate to user settings/profile
3. Change password to something stronger (20+ characters recommended)

---

#### 3. **No HTTPS/SSL**
**Risk:** All traffic is unencrypted, passwords sent in plaintext
**Status:** ⚠️ VULNERABLE

**Fix Options:**

**Option A: Use AWS Certificate Manager (Recommended)**
1. Request a certificate (requires domain)
2. Attach to ALB listener

**Option B: Self-Signed Certificate (For testing)**
```bash
# Will provide commands tonight
```

**Option C: Use CloudFront with ACM**
- Adds HTTPS without needing a custom domain
- We'll configure tonight

---

#### 4. **Missing Security Headers**
**Risk:** Vulnerable to XSS, clickjacking, MIME sniffing
**Status:** ⚠️ NEEDS IMPROVEMENT

**Fix:** Add security middleware to Express app
- Will update `server/index.ts` tonight

---

#### 5. **Hardcoded SESSION_SECRET**
**Risk:** Session hijacking if secret is compromised
**Status:** ⚠️ NEEDS UPDATE

**Fix:**
```bash
# Generate strong secret
openssl rand -base64 48

# Update .env on EC2 with the new secret
# Restart PM2
```

---

### 🔍 MEDIUM PRIORITY ISSUES

#### 6. **EC2 SSH Key Permissions**
**Risk:** SSH key potentially compromised if stored insecurely
**Status:** ⚠️ REVIEW NEEDED

**Fix:**
- Verify key permissions are 600
- Consider rotating the key
- Enable SSH key rotation policy

---

#### 7. **No Database Encryption in Transit Enforcement**
**Risk:** Database connections could fall back to unencrypted
**Status:** ⚠️ NEEDS IMPROVEMENT

**Fix:**
Update RDS parameter group to require SSL:
```bash
# Commands provided tonight
```

---

#### 8. **S3 Bucket CORS Too Permissive**
**Risk:** Any website can access your S3 bucket
**Status:** ⚠️ NEEDS TIGHTENING

**Current CORS:**
```json
{
  "allowed_origins": ["*"],
  "allowed_methods": ["GET", "PUT", "POST", "DELETE"]
}
```

**Fix:** Restrict to your ALB domain
```hcl
# Update terraform/s3.tf
cors_rule {
  allowed_origins = ["http://filemanager-alb-141865427.us-east-2.elb.amazonaws.com"]
  allowed_methods = ["GET", "PUT", "POST", "DELETE"]
}
```

---

#### 9. **No Rate Limiting**
**Risk:** Brute force attacks, DDoS
**Status:** ⚠️ NEEDS IMPLEMENTATION

**Fix:** Add express-rate-limit middleware
- Will implement tonight

---

#### 10. **No Database Backups Enabled**
**Risk:** Data loss if something goes wrong
**Status:** ⚠️ CRITICAL FOR PRODUCTION

**Fix:**
```bash
aws rds modify-db-instance \
  --db-instance-identifier filemanager-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately \
  --region us-east-2
```

---

#### 11. **Security Group Rules Too Open**
**Risk:** Unnecessary exposure to attacks
**Status:** ⚠️ NEEDS REVIEW

**Check Current Rules:**
```bash
# EC2 Security Group
aws ec2 describe-security-groups \
  --group-ids sg-05b429beab5531dbe \
  --region us-east-2

# RDS Security Group
aws ec2 describe-security-groups \
  --group-ids sg-01fac7fee806e0ac1 \
  --region us-east-2
```

**Expected:**
- EC2: Allow 5000 from ALB only, SSH from your IP only
- RDS: Allow 5432 from EC2 only

---

#### 12. **No CloudWatch Alarms**
**Risk:** Won't know if something goes wrong
**Status:** ⚠️ NEEDS SETUP

**Fix:** Set up alarms for:
- CPU > 80%
- Disk space < 20%
- Failed health checks
- Database connections

---

#### 13. **IAM Role Too Permissive**
**Risk:** EC2 has more permissions than needed
**Status:** ⚠️ NEEDS REVIEW

**Check Current Policy:**
```bash
# Will review tonight
aws iam get-role-policy \
  --role-name FileManagerInstanceRole \
  --policy-name S3AccessPolicy \
  --region us-east-2
```

---

### 📋 LOW PRIORITY / BEST PRACTICES

#### 14. **No Web Application Firewall (WAF)**
- Protects against common web exploits
- Cost: ~$5-10/month
- Setup: Attach to ALB

#### 15. **No VPC Flow Logs**
- Network traffic logging for security analysis
- Setup tonight if desired

#### 16. **No Multi-Factor Authentication**
- Would require code changes
- Consider for future enhancement

#### 17. **Secrets in Environment Variables**
- Consider AWS Secrets Manager
- More secure, automatic rotation
- Cost: ~$0.40/secret/month

#### 18. **No Intrusion Detection**
- Consider AWS GuardDuty
- Cost: ~$5-10/month for small deployment

#### 19. **Session Configuration**
- Review session timeout settings
- Implement session invalidation on password change

#### 20. **Input Validation & Sanitization**
- Review all API endpoints
- Ensure proper validation of file uploads

---

## 🎯 TONIGHT'S ACTION PLAN

### Phase 1: Critical Fixes (30-45 minutes)

1. **Make RDS Private**
   - Remove public accessibility
   - Verify EC2 can still connect

2. **Change Admin Password**
   - Use strong password generator
   - Document in secure location

3. **Update SESSION_SECRET**
   - Generate cryptographically secure secret
   - Update .env on EC2
   - Restart application

4. **Enable Database Backups**
   - Set 7-day retention
   - Configure backup window

5. **Review & Tighten Security Groups**
   - Ensure minimum necessary access
   - Remove any 0.0.0.0/0 rules

---

### Phase 2: Add HTTPS (45-60 minutes)

**Option A: Self-Signed Certificate (Quick)**
```bash
# Generate certificate
# Configure ALB listener
# Update app to redirect HTTP -> HTTPS
```

**Option B: CloudFront + ACM (Better)**
```bash
# Create CloudFront distribution
# Point to ALB
# Get free AWS certificate
# Configure HTTPS
```

We'll decide which option based on your needs.

---

### Phase 3: Application Hardening (30 minutes)

1. **Add Security Headers**
   ```javascript
   // Helmet.js middleware
   // CSP, HSTS, X-Frame-Options, etc.
   ```

2. **Add Rate Limiting**
   ```javascript
   // Limit login attempts
   // Limit API requests
   // Prevent brute force
   ```

3. **Improve Error Handling**
   ```javascript
   // Don't leak stack traces
   // Generic error messages
   ```

4. **Add Request Logging**
   ```javascript
   // Log suspicious activity
   // Track failed login attempts
   ```

---

### Phase 4: Monitoring & Alerts (30 minutes)

1. **CloudWatch Alarms**
   - High CPU usage
   - Low disk space
   - Failed health checks
   - High error rates

2. **Log Aggregation**
   - Centralize PM2 logs
   - Set up CloudWatch Logs
   - Enable RDS logs

3. **SNS Notifications**
   - Email alerts for critical issues
   - Setup topic and subscriptions

---

### Phase 5: S3 Security (15 minutes)

1. **Restrict CORS**
   - Only allow your domain

2. **Review Bucket Policy**
   - Ensure public access is intentional
   - Only for public/ prefix

3. **Enable Versioning** (Already done ✅)
   - Verify it's working

4. **Add Lifecycle Policies**
   - Archive old files to Glacier
   - Cost savings

---

## 📊 SECURITY AUDIT SUMMARY

### Current Security Score: 5/10 ⚠️

**Strengths:**
- ✅ VPC with private subnets
- ✅ Separate security groups
- ✅ IAM roles (EC2 not using root credentials)
- ✅ Database authentication required
- ✅ S3 versioning enabled
- ✅ Application uses bcrypt for passwords

**Weaknesses:**
- ❌ No HTTPS/SSL
- ❌ Database publicly accessible
- ❌ Default admin password
- ❌ No rate limiting
- ❌ No security headers
- ❌ No database backups
- ❌ No monitoring/alerts
- ❌ Permissive CORS
- ❌ Weak session secret

**After Tonight's Fixes: Target Score 8.5/10 🎯**

---

## 🔧 PRE-SESSION CHECKLIST

Before we start tonight, have ready:

1. ✅ Access to AWS Console
2. ✅ Terminal with AWS CLI configured (us-east-2)
3. ✅ SSH access to EC2 instance
4. ✅ Admin access to the application
5. ✅ Coffee ☕ (this will take 2-3 hours)

---

## 📝 COMMANDS QUICK REFERENCE

### Connect to EC2
```bash
ssh -i ~/filemanager-key-east2.pem ec2-user@18.116.87.179
```

### Check App Status
```bash
pm2 status
pm2 logs cloud-vault
```

### Check Security Groups
```bash
aws ec2 describe-security-groups --region us-east-2 --group-ids sg-05b429beab5531dbe sg-01fac7fee806e0ac1
```

### Check RDS Status
```bash
aws rds describe-db-instances --db-instance-identifier filemanager-db --region us-east-2 --query 'DBInstances[0].{Status:DBInstanceStatus,Public:PubliclyAccessible,Endpoint:Endpoint.Address}'
```

### Terraform Commands
```bash
cd C:\Users\Sean\cloud-vault\terraform
terraform plan
terraform apply
terraform output
```

---

## 🎓 LEARNING RESOURCES

While you're working on your other project, you might want to review:

1. **AWS Security Best Practices**
   - https://docs.aws.amazon.com/security/

2. **OWASP Top 10**
   - https://owasp.org/www-project-top-ten/

3. **Node.js Security Checklist**
   - https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html

4. **Express.js Security Best Practices**
   - https://expressjs.com/en/advanced/best-practice-security.html

---

## 💾 BACKUP YOUR WORK

Before we make major changes tonight, let's backup:

```bash
# Backup Terraform state
cd terraform
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d)

# Export current database (on EC2)
PGPASSWORD='Sean123!' pg_dump -h filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com -U filemanager -d filemanager > backup_$(date +%Y%m%d).sql

# Snapshot EC2 (via AWS CLI)
aws ec2 create-snapshot --volume-id $(aws ec2 describe-instances --instance-ids i-0ff1683d2b4f7d143 --region us-east-2 --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' --output text) --description "Pre-security-hardening backup" --region us-east-2
```

---

## 🚀 BONUS ENHANCEMENTS (If Time Permits)

1. **Custom Domain Setup**
   - Register domain or use existing
   - Configure Route 53
   - Point to ALB

2. **Automated Deployments**
   - GitHub Actions workflow
   - Auto-deploy on push

3. **Docker-ize the Application**
   - Create Dockerfile
   - Use ECS instead of EC2
   - Better scalability

4. **Database Read Replica**
   - Improve performance
   - High availability

5. **ElastiCache for Sessions**
   - Redis for session storage
   - Better performance than database

---

## 📞 READY TO CONTINUE?

When you're ready tonight, just say:
- "Let's start the security audit"
- "I'm ready to continue"
- Or any specific item from the checklist

We'll work through this systematically!

**Estimated Total Time:** 2-3 hours  
**Difficulty:** Intermediate  
**Coffee Required:** 2-3 cups ☕☕☕

---

Good luck with your other project! See you tonight! 🌙


