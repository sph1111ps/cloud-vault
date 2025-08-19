# AWS Deployment Checklist

Use this checklist to ensure you complete all steps for deploying your file management application to AWS.

## 📋 Pre-Deployment Checklist

### Prerequisites
- [ ] AWS Account with administrative access
- [ ] AWS CLI installed (optional, for advanced users)
- [ ] Domain name registered (optional, for custom domain)
- [ ] SSL certificate ready (optional, for HTTPS)

---

## 🗃️ Phase 1: Database Setup (RDS PostgreSQL)

### Create RDS Database
- [ ] Navigate to RDS Console
- [ ] Click "Create database"
- [ ] Select "PostgreSQL" engine
- [ ] Choose appropriate template (Free tier/Production)
- [ ] Configure database settings:
  - [ ] DB identifier: `filemanager-db`
  - [ ] Master username: `filemanager`
  - [ ] Auto-generate password ✅
  - [ ] **SAVE THE GENERATED PASSWORD** 🔑
- [ ] Configure instance class and storage
- [ ] Set public access to "Yes" (temporary)
- [ ] Create new VPC security group
- [ ] Set initial database name: `filemanager`
- [ ] Enable encryption
- [ ] Click "Create database"
- [ ] Wait for status: "Available" ⏳ (10-15 minutes)

### Database Configuration
- [ ] Note RDS endpoint URL
- [ ] Test connectivity (optional)

---

## 🪣 Phase 2: File Storage Setup (S3)

### Create S3 Bucket
- [ ] Navigate to S3 Console
- [ ] Click "Create bucket"
- [ ] Choose unique bucket name: `filemanager-files-[random]`
- [ ] Select AWS region
- [ ] Configure ownership (ACLs disabled)
- [ ] Block public access initially
- [ ] Enable versioning
- [ ] Enable default encryption (SSE-S3)
- [ ] Click "Create bucket"

### Configure S3 Bucket
- [ ] Go to bucket → Permissions → CORS
- [ ] Add CORS configuration (see guide)
- [ ] Save CORS settings

---

## 🔑 Phase 3: IAM Role Setup

### Create EC2 IAM Role
- [ ] Navigate to IAM Console
- [ ] Click "Roles" → "Create role"
- [ ] Select "AWS service" → "EC2"
- [ ] Attach policies:
  - [ ] `AmazonS3FullAccess` (or custom policy)
  - [ ] `AmazonRDSDataFullAccess`
  - [ ] `CloudWatchAgentServerPolicy`
- [ ] Name role: `FileManagerEC2Role`
- [ ] Click "Create role"

---

## 💻 Phase 4: EC2 Instance Setup

### Launch EC2 Instance
- [ ] Navigate to EC2 Console
- [ ] Click "Launch instance"
- [ ] Name: `FileManager-App`
- [ ] Choose Amazon Linux 2023 AMI
- [ ] Select instance type:
  - [ ] `t3.micro` (free tier)
  - [ ] `t3.small` or larger (production)

### Configure Key Pair
- [ ] Create new key pair OR select existing
- [ ] If new: Name `filemanager-key`
- [ ] **DOWNLOAD and SAVE the .pem file** 🔑

### Configure Security Group
- [ ] Create new security group: `filemanager-ec2-sg`
- [ ] Add inbound rules:
  - [ ] SSH (22) from My IP
  - [ ] HTTP (80) from Anywhere
  - [ ] HTTPS (443) from Anywhere  
  - [ ] Custom TCP (5000) from Anywhere

### Configure Advanced Settings
- [ ] Storage: 20 GiB minimum
- [ ] IAM role: `FileManagerEC2Role`
- [ ] Add User Data script (see guide)
- [ ] Launch instance
- [ ] Wait for status: "Running" ⏳ (2-5 minutes)
- [ ] **Note the Public IPv4 address** 📍

---

## 🚀 Phase 5: Application Deployment

### Connect to EC2 Instance
- [ ] Use EC2 Instance Connect OR
- [ ] SSH: `ssh -i filemanager-key.pem ec2-user@PUBLIC-IP`

### Deploy Application Code
- [ ] Clone repository: `git clone [YOUR-REPO-URL] app`
- [ ] Navigate to app: `cd app`
- [ ] Install dependencies: `npm install`
- [ ] Build application: `npm run build`

### Configure Environment Variables
- [ ] Create `.env` file: `nano .env`
- [ ] Add all required environment variables:
  - [ ] DATABASE_URL (with RDS endpoint)
  - [ ] All PGXXX variables
  - [ ] SESSION_SECRET (generate strong secret)
  - [ ] AWS_S3_BUCKET (your bucket name)
  - [ ] AWS_REGION
  - [ ] NODE_ENV=production
  - [ ] PORT=5000
- [ ] Save environment file ✅

### Initialize Database
- [ ] Run: `npm run db:push`
- [ ] Create admin user (see guide)
- [ ] Verify admin user creation ✅

### Start Application
- [ ] Create PM2 config file
- [ ] Start with PM2: `pm2 start ecosystem.config.js`
- [ ] Save PM2 config: `pm2 save`
- [ ] Enable startup: `pm2 startup`

### Test Application
- [ ] Open browser: `http://PUBLIC-IP:5000`
- [ ] Login with admin credentials
- [ ] Upload a test file
- [ ] Verify file storage in S3
- [ ] Test file download
- [ ] **Application working** ✅

---

## ⚖️ Phase 6: Load Balancer Setup (Production Only)

### Create Target Group
- [ ] Navigate to EC2 → Target Groups
- [ ] Create target group: `filemanager-tg`
- [ ] Protocol: HTTP, Port: 5000
- [ ] Health check path: `/api/auth/me`
- [ ] Register EC2 instance

### Create Application Load Balancer
- [ ] Navigate to EC2 → Load Balancers
- [ ] Create Application Load Balancer
- [ ] Name: `filemanager-alb`
- [ ] Internet-facing, IPv4
- [ ] Select multiple AZs
- [ ] Create/assign security groups
- [ ] Add HTTP listener → Forward to target group
- [ ] Create load balancer
- [ ] Wait for status: "Active" ⏳

### Test Load Balancer
- [ ] Access via ALB DNS name
- [ ] Verify application works through load balancer

---

## 🔒 Phase 7: Security Hardening

### Update S3 Bucket Policy
- [ ] Go to S3 bucket → Permissions → Bucket policy
- [ ] Add public read policy for public folder only
- [ ] Save bucket policy

### Secure EC2 Access
- [ ] Remove direct port 5000 access from EC2 security group
- [ ] Force traffic through load balancer only

### SSL Certificate (Production)
- [ ] Request certificate in AWS Certificate Manager
- [ ] Add HTTPS listener to load balancer
- [ ] Update DNS records if using custom domain

---

## 🌐 Phase 8: Domain Configuration (Optional)

### Route 53 Setup
- [ ] Create hosted zone for domain
- [ ] Create A record pointing to load balancer
- [ ] Update nameservers at domain registrar
- [ ] Test domain resolution

---

## 📊 Phase 9: Monitoring Setup

### CloudWatch Alarms
- [ ] Create CPU utilization alarm (>80%)
- [ ] Create memory usage alarm
- [ ] Set up SNS notifications
- [ ] Test alarm triggers

### RDS Monitoring
- [ ] Enable Performance Insights
- [ ] Set up database alarms
- [ ] Configure backup retention

### Application Logs
- [ ] Configure log rotation
- [ ] Set up log aggregation
- [ ] Test log accessibility

---

## 🧪 Phase 10: Final Testing

### Functionality Tests
- [ ] User registration works
- [ ] User login works
- [ ] Admin login works
- [ ] File upload works (all file types)
- [ ] File download works
- [ ] File deletion works
- [ ] Bulk operations work
- [ ] Folder management works
- [ ] Change password works (admin)

### Performance Tests
- [ ] Multiple concurrent uploads
- [ ] Large file uploads (test size limits)
- [ ] Multiple user sessions

### Security Tests
- [ ] SQL injection attempts fail
- [ ] XSS attempts fail
- [ ] Unauthorized access blocked
- [ ] File access permissions correct

### Disaster Recovery Test
- [ ] Database backup/restore
- [ ] Application recovery after crash
- [ ] S3 data integrity

---

## 📝 Post-Deployment Tasks

### Documentation
- [ ] Document all passwords/secrets securely
- [ ] Create runbook for common tasks
- [ ] Document backup/restore procedures
- [ ] Create user guide

### Maintenance Schedule
- [ ] Weekly OS updates: `sudo yum update -y`
- [ ] Monthly dependency updates: `npm audit fix`
- [ ] Quarterly security review
- [ ] Regular backup testing

### Cost Optimization
- [ ] Review instance sizing after 1 week
- [ ] Set up billing alerts
- [ ] Consider Reserved Instances for production
- [ ] Review S3 storage classes

---

## 🎉 Deployment Complete!

### Final Checklist
- [ ] Application accessible via domain/IP ✅
- [ ] All features working correctly ✅
- [ ] Security measures in place ✅
- [ ] Monitoring configured ✅
- [ ] Backup strategy implemented ✅
- [ ] Documentation complete ✅

### Success Criteria
- [ ] Users can register and login
- [ ] Files upload and download correctly
- [ ] Admin features work
- [ ] Application is secure
- [ ] Performance is acceptable
- [ ] Monitoring is active

**🎊 Congratulations! Your file management application is now live on AWS!**

### Next Steps
- [ ] Monitor application performance
- [ ] Gather user feedback
- [ ] Plan feature enhancements
- [ ] Schedule regular maintenance

---

## 🚨 Emergency Contacts & Resources

### AWS Support Resources
- AWS Support Center: https://console.aws.amazon.com/support/
- AWS Documentation: https://docs.aws.amazon.com/
- AWS Status Page: https://status.aws.amazon.com/

### Important Commands for Troubleshooting
```bash
# Check application status
pm2 status

# View application logs  
pm2 logs filemanager

# Restart application
pm2 restart filemanager

# Check system resources
htop

# Test database connection
psql -h RDS-ENDPOINT -U filemanager -d filemanager
```

### Emergency Rollback Plan
1. Stop current application: `pm2 stop filemanager`
2. Checkout previous version: `git checkout [previous-commit]`
3. Restart application: `pm2 start filemanager`
4. Verify functionality