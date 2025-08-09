# AWS Console Deployment Checklist

## Pre-Deployment Preparation
- [ ] AWS account with billing set up
- [ ] Project code ready in GitHub/Git repository
- [ ] Database URL ready (Neon or RDS)
- [ ] Domain name (optional)

---

## ✅ S3 Bucket Setup

### Create S3 Bucket
- [ ] Navigate to S3 service
- [ ] Click "Create bucket"
- [ ] Enter unique bucket name: `____________________`
- [ ] Select region: `____________________`
- [ ] Enable ACLs
- [ ] Uncheck "Block all public access" (with acknowledgment)
- [ ] Enable bucket versioning
- [ ] Enable default encryption (SSE-S3)
- [ ] Create bucket

### Configure Bucket
- [ ] Set up CORS policy
- [ ] Configure bucket policy (after creating IAM role)
- [ ] Note bucket name: `____________________`

---

## ✅ IAM Role Setup

### Create EC2 Role
- [ ] Navigate to IAM service
- [ ] Click "Roles" → "Create role"
- [ ] Select AWS service → EC2
- [ ] Add permissions: AmazonS3FullAccess
- [ ] Add permissions: CloudWatchAgentServerPolicy
- [ ] Name role: `FileManager-EC2-Role`
- [ ] Create role

### Get Account Information
- [ ] Note AWS Account ID: `____________________`
- [ ] Update S3 bucket policy with Account ID and bucket name
- [ ] Save bucket policy

---

## ✅ Security Group Setup

### Create Security Group
- [ ] Navigate to EC2 → Security Groups
- [ ] Click "Create security group"
- [ ] Name: `filemanager-security-group`
- [ ] Add inbound rules:
  - [ ] SSH (22) from My IP
  - [ ] HTTP (80) from Anywhere
  - [ ] HTTPS (443) from Anywhere
  - [ ] Custom TCP (5000) from Anywhere
- [ ] Create security group

---

## ✅ EC2 Instance Setup

### Launch Instance
- [ ] Navigate to EC2 → Launch instance
- [ ] Name: `FileManager-App-Server`
- [ ] Select Amazon Linux 2023 AMI
- [ ] Choose instance type: `t3.micro` (free tier) or `t3.small`
- [ ] Create or select key pair: `____________________`
- [ ] Network settings:
  - [ ] Enable auto-assign public IP
  - [ ] Select security group: `filemanager-security-group`
- [ ] Storage: 20 GB gp3
- [ ] Advanced details:
  - [ ] IAM instance profile: `FileManager-EC2-Role`
  - [ ] Add user data script (from guide)
- [ ] Launch instance

### Instance Information
- [ ] Instance ID: `____________________`
- [ ] Public IP: `____________________`
- [ ] Key pair file location: `____________________`

---

## ✅ Application Deployment

### Connect to Instance
- [ ] Use EC2 Instance Connect (browser) OR
- [ ] SSH with key pair: `ssh -i keypair.pem ec2-user@IP`

### Deploy Code
- [ ] Navigate to `/opt/file-manager`
- [ ] Clone repository: `git clone YOUR_REPO_URL .`
- [ ] Install dependencies: `npm install`
- [ ] Install AWS SDK: `npm install aws-sdk`
- [ ] Copy environment file: `cp .env.example .env`
- [ ] Configure environment variables:
  - [ ] `S3_BUCKET_NAME=____________________`
  - [ ] `AWS_REGION=____________________`
  - [ ] `DATABASE_URL=____________________`
- [ ] Build application: `npm run build`
- [ ] Start service: `sudo systemctl start file-manager`

### Verify Deployment
- [ ] Check service status: `sudo systemctl status file-manager`
- [ ] Check logs: `sudo journalctl -u file-manager -f`
- [ ] Test health endpoint: `curl http://localhost:5000/health`
- [ ] Access application: `http://PUBLIC_IP`

---

## ✅ Domain Setup (Optional)

### Route 53 Configuration
- [ ] Register domain or transfer existing domain
- [ ] Create hosted zone
- [ ] Create A record pointing to EC2 IP
- [ ] Update nameservers if necessary
- [ ] Test domain resolution

### SSL Certificate (Optional)
- [ ] Request certificate in AWS Certificate Manager
- [ ] Validate domain ownership
- [ ] Configure certificate with load balancer or CloudFront

---

## ✅ Monitoring & Security

### CloudWatch Setup
- [ ] Set up basic monitoring
- [ ] Create custom dashboard
- [ ] Set up log groups for application logs
- [ ] Configure billing alerts

### Security Hardening
- [ ] Review security group rules
- [ ] Set up AWS CloudTrail
- [ ] Configure backup strategy
- [ ] Test access controls

---

## ✅ Testing Checklist

### Basic Functionality
- [ ] Application loads in browser
- [ ] File upload works
- [ ] File download works
- [ ] Folder creation works
- [ ] File management operations work

### S3 Integration
- [ ] Files are stored in S3 bucket
- [ ] EC2 can read/write to S3
- [ ] File URLs are accessible
- [ ] File deletion removes from S3

### Performance
- [ ] Page load times acceptable
- [ ] File upload speed reasonable
- [ ] No memory leaks observed
- [ ] Error handling works properly

---

## 📝 Post-Deployment Notes

### Important Information to Save
- **S3 Bucket Name:** `____________________`
- **EC2 Instance ID:** `____________________`
- **Public IP Address:** `____________________`
- **Domain Name:** `____________________` (if applicable)
- **Database URL:** `____________________`
- **Key Pair Name:** `____________________`

### Regular Maintenance Tasks
- [ ] Weekly: Check application logs
- [ ] Weekly: Monitor AWS costs
- [ ] Monthly: Update system packages
- [ ] Monthly: Review security settings
- [ ] Quarterly: Update application dependencies

### Emergency Contacts & Resources
- **AWS Support:** [AWS Support Center](https://console.aws.amazon.com/support/)
- **Documentation:** Check AWS_CONSOLE_GUIDE.md for detailed instructions
- **Troubleshooting:** Refer to troubleshooting section in guide

---

## 🚨 Troubleshooting Quick Reference

### Common Issues
- **502 Bad Gateway:** Check if application is running on port 5000
- **S3 Access Denied:** Verify IAM role permissions and bucket policy
- **Application won't start:** Check environment variables and logs
- **Can't connect to database:** Verify DATABASE_URL and network connectivity

### Key Commands
```bash
# Check application status
sudo systemctl status file-manager

# View application logs
sudo journalctl -u file-manager -f

# Restart application
sudo systemctl restart file-manager

# Test S3 access
aws s3 ls s3://your-bucket-name

# Check system resources
htop
df -h
free -m
```

---

**Deployment Date:** `____________________`
**Deployed By:** `____________________`
**Version:** `____________________`

✅ **Deployment Complete** - Your file management application is now running on AWS!