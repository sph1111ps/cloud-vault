# Cloud Vault AWS Deployment Gameplan

**Last Updated:** November 2, 2025  
**Status:** Ready for deployment with minor setup required

---

## 📊 Current Status - What You Have

### ✅ Complete Terraform Infrastructure (terraform/)
Your Terraform configuration is production-ready and includes:

- **VPC & Networking**: VPC with subnets across 2 availability zones
- **Security Groups**: Configured for EC2, RDS, and ALB
- **RDS PostgreSQL**: Database with encryption and subnet groups
- **S3 Bucket**: With versioning, CORS, and proper policies
- **IAM Roles**: EC2 instance profiles with S3 and RDS access
- **EC2 Instance**: With automated user data script for initial setup
- **Application Load Balancer**: With health checks and target groups
- **SSH Key Pair**: Auto-generated TLS keys for secure access

### ✅ Complete CLI Deployment Guide
- **AWS_COMPLETE_CLI_GUIDE.md**: Manual bash script approach
- Matches Terraform infrastructure 1:1
- Good for learning or manual deployment

### ✅ Full Application Code
- **Frontend**: React + TypeScript with shadcn/ui components
- **Backend**: Express.js with Drizzle ORM
- **AWS Integration**: S3 storage service fully configured
- **Authentication**: User auth with sessions
- **Database**: PostgreSQL schema ready
- **Deployment Script**: `scripts/deploy.sh` ready to use

---

## ⚠️ What's Missing - Action Items

### 1. **Terraform Variables File** (CRITICAL)

Your `terraform/variables.tf` file is **empty**. Create it with this content:

```hcl
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "filemanager"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "bucket_name" {
  description = "S3 bucket name (leave empty for auto-generated)"
  type        = string
  default     = ""
}

variable "key_pair_name" {
  description = "EC2 key pair name"
  type        = string
  default     = "filemanager-key"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}
```

### 2. **Terraform Variables Values File**

Create `terraform/terraform.tfvars` (DO NOT commit this to git):

```hcl
# Sensitive values - DO NOT COMMIT
db_password = "YourSecurePassword123!"
region      = "us-east-1"

# Optional overrides
# bucket_name    = "my-custom-bucket-name"
# instance_type  = "t3.small"
```

### 3. **Application Environment File Template**

Create `.env.example` in project root:

```bash
# Database Configuration
DATABASE_URL=postgresql://filemanager:PASSWORD@RDS_ENDPOINT:5432/filemanager
PGHOST=RDS_ENDPOINT
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=PASSWORD
PGDATABASE=filemanager

# AWS Configuration
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name

# Storage Paths
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/

# Application Configuration
NODE_ENV=production
PORT=5000
SESSION_SECRET=generate-with-openssl-rand-base64-32

# Optional: For local development
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
```

### 4. **Windows Script Compatibility Fix**

Update `package.json` scripts for Windows PowerShell:

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "cross-env NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  }
}
```

Then install cross-env:
```bash
npm install --save-dev cross-env
```

### 5. **Update Deploy Script with Your Repo**

Edit `scripts/deploy.sh` line 9:
```bash
REPO_URL="https://github.com/YOUR_USERNAME/cloud-vault.git"
```

---

## 🎯 Deployment Gameplan - Two Options

### **Option A: Terraform Deployment (RECOMMENDED)**

**Why Terraform?**
- Infrastructure as Code (IaC) - repeatable and version controlled
- Easy to destroy and recreate
- State management for tracking changes
- Best practice for production

**Time Required:** ~35-45 minutes total

#### **Phase 1: Local Setup** (5-10 minutes)

```powershell
# 1. Install prerequisites (if not already installed)
choco install terraform
choco install awscli

# 2. Configure AWS credentials
aws configure
# Enter your:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (us-east-1)
# - Default output format (json)

# 3. Verify AWS access
aws sts get-caller-identity

# 4. Navigate to project
cd C:\Users\Sean\cloud-vault

# 5. Create missing files (see "What's Missing" section above)
# - terraform/variables.tf
# - terraform/terraform.tfvars
# - .env.example
```

#### **Phase 2: Deploy Infrastructure** (15-20 minutes)

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform (downloads providers)
terraform init

# Validate configuration
terraform validate

# Preview what will be created
terraform plan

# Deploy infrastructure (type 'yes' when prompted)
terraform apply

# Save outputs for later use
terraform output > ../deployment-outputs.txt
terraform output -raw private_key > ../filemanager-key.pem

# On Windows with Git Bash or WSL:
chmod 600 ../filemanager-key.pem
```

**What gets created:**
- VPC with 2 public subnets
- Internet Gateway and routing
- 3 Security Groups (EC2, RDS, ALB)
- RDS PostgreSQL database (10-15 min to provision)
- S3 bucket with versioning
- IAM role and instance profile
- EC2 t3.micro instance
- Application Load Balancer
- Target group and listener

#### **Phase 3: Deploy Application** (10-15 minutes)

```bash
# Get deployment information
cd C:\Users\Sean\cloud-vault
$EC2_IP = terraform -chdir=terraform output -raw ec2_public_ip
$DB_ENDPOINT = terraform -chdir=terraform output -raw db_endpoint
$S3_BUCKET = terraform -chdir=terraform output -raw s3_bucket

# SSH to EC2 instance (use Git Bash or WSL on Windows)
ssh -i filemanager-key.pem ec2-user@$EC2_IP

# === ON EC2 INSTANCE ===

# Clone your repository
git clone https://github.com/YOUR_USERNAME/cloud-vault.git app
cd app

# Install dependencies
npm install

# Build application
npm run build

# Create production environment file
cat > .env << EOF
DATABASE_URL=postgresql://filemanager:YourSecurePassword123!@YOUR_DB_ENDPOINT:5432/filemanager
PGHOST=YOUR_DB_ENDPOINT
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YourSecurePassword123!
PGDATABASE=filemanager
SESSION_SECRET=$(openssl rand -base64 32)
AWS_REGION=us-east-1
S3_BUCKET_NAME=YOUR_S3_BUCKET
DEFAULT_OBJECT_STORAGE_BUCKET_ID=YOUR_S3_BUCKET
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/
NODE_ENV=production
PORT=5000
EOF

# Initialize database schema
npm run db:push

# Install PM2 process manager
npm install -g pm2

# Start application
pm2 start dist/index.js --name cloud-vault
pm2 save
pm2 startup  # Follow the command it shows

# Check status
pm2 status
pm2 logs cloud-vault
```

#### **Phase 4: Verify Deployment** (5 minutes)

```bash
# Get ALB DNS name
cd C:\Users\Sean\cloud-vault\terraform
terraform output alb_dns

# Access your application
# Open browser to: http://[ALB_DNS_NAME]

# Direct EC2 access (for testing)
# http://[EC2_IP]:5000

# Check health endpoint
curl http://[EC2_IP]:5000/api/auth/me
```

---

### **Option B: CLI Manual Deployment**

Follow **AWS_COMPLETE_CLI_GUIDE.md** step-by-step for manual deployment using AWS CLI commands. This creates the same infrastructure but requires executing each command individually.

**Pros:**
- Good for learning AWS services
- Understand each component being created

**Cons:**
- More time consuming
- Harder to replicate
- Manual cleanup required
- No state tracking

---

## 📋 Pre-Deployment Checklist

Before running `terraform apply`, ensure:

- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Terraform installed (`terraform --version`)
- [ ] AWS credentials have proper permissions (EC2, RDS, S3, VPC, IAM)
- [ ] Created `terraform/variables.tf` file
- [ ] Created `terraform/terraform.tfvars` with DB password
- [ ] Updated `scripts/deploy.sh` with your GitHub repo URL
- [ ] Code pushed to GitHub (or have deployment plan)
- [ ] Decided on AWS region (default: us-east-1)
- [ ] Created `.gitignore` entry for `terraform.tfvars` and `.env`

---

## 📋 Post-Deployment Checklist

After infrastructure is deployed:

- [ ] EC2 instance running and accessible via SSH
- [ ] RDS database endpoint accessible from EC2
- [ ] S3 bucket created and accessible
- [ ] Application built successfully on EC2
- [ ] Database schema initialized (`npm run db:push`)
- [ ] Application running via PM2
- [ ] Load Balancer health checks passing
- [ ] Can access application via ALB DNS
- [ ] Create first admin user account
- [ ] Test file upload functionality
- [ ] Test file download functionality

---

## 🔧 Required Environment Variables

Your application requires these environment variables to run:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AWS_REGION` | AWS region for S3 | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket name | `filemanager-abc123` |
| `SESSION_SECRET` | Express session secret | Generate with `openssl rand -base64 32` |
| `PORT` | Application port | `5000` |
| `NODE_ENV` | Environment | `production` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public file paths | `public/` |
| `PRIVATE_OBJECT_DIR` | Private file directory | `private/` |

---

## 💰 Cost Estimate (AWS Free Tier)

**First 12 months (Free Tier eligible):**
- EC2 t3.micro: **FREE** (750 hours/month)
- RDS t3.micro: **FREE** (750 hours/month)
- S3 storage: **FREE** (5GB)
- Load Balancer: ~$16/month (not free tier eligible)
- Data transfer: First 100GB free

**After Free Tier:**
- EC2 t3.micro: ~$7.50/month
- RDS t3.micro: ~$15/month
- S3: ~$0.50/month (20GB)
- Load Balancer: ~$16/month
- **Total: ~$39/month**

**Cost Savings Tips:**
- Remove ALB and use EC2 directly (saves $16/month)
- Use smaller RDS instance during development
- Enable S3 Intelligent Tiering
- Set up billing alerts

---

## 🚦 Next Steps After Reading This

### **Immediate (Tonight/Tomorrow Morning)**

1. **Create missing Terraform files** (10 minutes)
   - `terraform/variables.tf`
   - `terraform/terraform.tfvars`
   - `.env.example`

2. **Verify prerequisites** (5 minutes)
   ```powershell
   # Check installations
   terraform --version
   aws --version
   node --version
   npm --version
   
   # Verify AWS access
   aws sts get-caller-identity
   ```

3. **Push code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Prepare for AWS deployment"
   git push origin main
   ```

### **When Ready to Deploy (Set aside 1 hour)**

1. **Initialize Terraform**
   ```bash
   cd terraform
   terraform init
   terraform plan  # Review what will be created
   ```

2. **Deploy infrastructure**
   ```bash
   terraform apply  # Type 'yes' when prompted
   ```

3. **Deploy application** (SSH to EC2 and follow Phase 3 above)

4. **Test and verify** (Check ALB DNS in browser)

---

## 🐛 Troubleshooting Guide

### **Issue: Terraform apply fails with "InvalidKeyPair.Duplicate"**
```bash
# Solution: Key pair already exists, either delete it or change the name
aws ec2 delete-key-pair --key-name filemanager-key
# Or change key_pair_name in terraform.tfvars
```

### **Issue: Can't SSH to EC2**
```bash
# Check security group allows SSH from your IP
# Verify key permissions (must be 600)
chmod 600 filemanager-key.pem

# Try verbose SSH for debugging
ssh -v -i filemanager-key.pem ec2-user@EC2_IP
```

### **Issue: Application won't start - DATABASE_URL error**
```bash
# On EC2, check if .env file exists and is correct
cat .env

# Verify RDS is accessible
psql $DATABASE_URL -c "SELECT 1"

# Check application logs
pm2 logs cloud-vault
```

### **Issue: ALB health checks failing**
```bash
# On EC2, verify app is running
pm2 status

# Test health endpoint directly
curl http://localhost:5000/api/auth/me

# Check firewall
sudo iptables -L

# Verify security group allows ALB -> EC2 on port 5000
```

### **Issue: S3 upload fails**
```bash
# Verify IAM role is attached to EC2
aws sts get-caller-identity

# Check S3 bucket permissions
aws s3 ls s3://YOUR_BUCKET_NAME

# Verify environment variables
echo $S3_BUCKET_NAME
```

---

## 🔒 Security Hardening (Post-Deployment)

After initial deployment, improve security:

### **1. Restrict SSH Access**
```bash
# Update EC2 security group to only allow SSH from your IP
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 22 \
  --cidr YOUR_IP/32
```

### **2. Remove Direct EC2 Access**
```bash
# Force all traffic through ALB
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 5000 \
  --cidr 0.0.0.0/0
```

### **3. Enable SSL/TLS**
```bash
# Request certificate in AWS Certificate Manager
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS

# Add HTTPS listener to ALB
```

### **4. Database Security**
- Change RDS to private subnets (requires NAT Gateway)
- Rotate database password regularly
- Enable RDS automated backups
- Enable RDS encryption (already enabled in Terraform)

### **5. Enable CloudWatch Monitoring**
```bash
# Enable detailed monitoring
aws ec2 monitor-instances --instance-ids i-xxxxx

# Set up CloudWatch alarms for CPU, memory, disk
```

---

## 📊 Monitoring and Maintenance

### **Check Application Health**
```bash
# SSH to EC2
ssh -i filemanager-key.pem ec2-user@EC2_IP

# Check PM2 status
pm2 status

# View logs
pm2 logs cloud-vault

# Check system resources
htop
df -h
free -m
```

### **Update Application**
```bash
# SSH to EC2
cd /home/ec2-user/app

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart
pm2 restart cloud-vault

# Or use the deploy script
./scripts/deploy.sh
```

### **Database Backups**
```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backups are enabled in RDS
# Retention: 7 days (configurable in Terraform)
```

---

## 🗑️ Cleanup / Destroy Infrastructure

When you want to tear down everything:

```bash
# Navigate to terraform directory
cd terraform

# Destroy all infrastructure (type 'yes' when prompted)
terraform destroy

# This will delete:
# - EC2 instance
# - RDS database (snapshot created first)
# - S3 bucket (must be empty first)
# - Load Balancer
# - VPC and networking
# - IAM roles
```

**Before destroying:**
1. Backup your database
2. Download any files from S3
3. Export any important data

---

## 📞 Support Resources

### **AWS Documentation**
- [EC2 Getting Started](https://docs.aws.amazon.com/ec2/)
- [RDS PostgreSQL](https://docs.aws.amazon.com/rds/)
- [S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/)

### **Terraform Documentation**
- [AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Terraform CLI](https://developer.hashicorp.com/terraform/cli)

### **Application Stack**
- [Express.js Documentation](https://expressjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [React Documentation](https://react.dev/)

---

## ✅ Final Notes

**Your infrastructure is well-designed and production-ready.** The main blockers are:

1. ✏️ Create `terraform/variables.tf` (5 minutes)
2. ✏️ Create `terraform/terraform.tfvars` (2 minutes)
3. ✏️ Update `scripts/deploy.sh` with your GitHub URL (1 minute)
4. ▶️ Run `terraform apply` (20 minutes)
5. ▶️ Deploy app to EC2 (15 minutes)

**Total deployment time: ~45 minutes** (including AWS resource provisioning time)

**Good luck with your deployment! 🚀**

---

**Document Version:** 1.0  
**Created:** November 2, 2025  
**For Project:** Cloud Vault AWS Deployment





