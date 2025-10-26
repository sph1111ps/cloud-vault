# AWS Deployment Guide

This guide walks you through deploying your file management application to AWS using EC2 for hosting and S3 for file storage.

## Architecture Overview

- **EC2 Instance**: Hosts your Node.js application
- **RDS PostgreSQL**: Managed database for user data and file metadata
- **S3 Bucket**: Stores uploaded files with proper security
- **Application Load Balancer**: SSL termination and traffic distribution
- **Route 53**: DNS management (optional)

## Prerequisites

1. AWS Account with administrative access
2. AWS CLI installed and configured
3. Domain name (optional, for custom domain)

## Step 1: Set Up AWS Infrastructure

### 1.1 Create VPC and Security Groups

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=FileManagerVPC}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=FileManagerIGW}]'

# Create Security Group for EC2
aws ec2 create-security-group --group-name FileManagerEC2 --description "Security group for File Manager EC2"

# Add rules to security group
aws ec2 authorize-security-group-ingress --group-name FileManagerEC2 --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name FileManagerEC2 --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name FileManagerEC2 --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name FileManagerEC2 --protocol tcp --port 5000 --cidr 0.0.0.0/0
```

### 1.2 Create RDS PostgreSQL Database

**Configure Database:**
- Go to AWS RDS Console
- Click "Create database" 
- Choose "Standard create"
- Select "PostgreSQL"
- Choose template: "Free tier" or "Production" based on needs

**Database Settings:**
- DB instance identifier: `filemanager-db`
- Master username: `filemanager`
- Auto generate password: Yes (save the password)
- DB instance class: `db.t3.micro` (free tier) or larger
- Storage: 20 GiB minimum

**Connectivity:**
- VPC: Select your VPC
- Public access: Yes (for initial setup)
- VPC security group: Create new

**Additional Configuration:**
- Initial database name: `filemanager`
- Click "Create database"

### 1.3 Create S3 Bucket for File Storage

```bash
# Create S3 bucket (replace YOUR-BUCKET-NAME with unique name)
aws s3 mb s3://your-filemanager-bucket-unique-name

# Enable versioning
aws s3api put-bucket-versioning --bucket your-filemanager-bucket-unique-name --versioning-configuration Status=Enabled

# Set up CORS for web uploads
aws s3api put-bucket-cors --bucket your-filemanager-bucket-unique-name --cors-configuration file://s3-cors.json
```

Create `s3-cors.json`:
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

### 1.4 Create IAM Role for EC2

**Create IAM Role:**
- Go to IAM Console
- Create role for EC2 service
- Attach policies:
  - `AmazonS3FullAccess` (or custom policy for your bucket)
  - `AmazonRDSDataFullAccess`
- Name: `FileManagerEC2Role`

## Step 2: Launch and Configure EC2 Instance

### 2.1 Launch EC2 Instance

```bash
# Launch instance (replace security-group-id and key-name)
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type t3.micro \
  --key-name YOUR-KEY-NAME \
  --security-group-ids sg-YOUR-SECURITY-GROUP-ID \
  --iam-instance-profile Name=FileManagerEC2Role \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=FileManagerApp}]'
```

### 2.2 Create User Data Script

Create `user-data.sh`:
```bash
#!/bin/bash
yum update -y
yum install -y git

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
yum install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Create app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

# Install PostgreSQL client
yum install -y postgresql

echo "EC2 instance setup complete"
```

### 2.3 Deploy Application Code

SSH into your EC2 instance:
```bash
ssh -i your-key.pem ec2-user@YOUR-EC2-IP
```

Clone and set up your application:
```bash
# Clone your repository (replace with your repo URL)
git clone https://github.com/your-username/your-repo.git app
cd app

# Install dependencies
npm install

# Build the application
npm run build
```

## Step 3: Configure Environment Variables

Create `.env` file on EC2:
```bash
# Database
DATABASE_URL=postgresql://filemanager:YOUR-DB-PASSWORD@your-db-endpoint:5432/filemanager
PGHOST=your-db-endpoint
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YOUR-DB-PASSWORD
PGDATABASE=filemanager

# Session
SESSION_SECRET=your-very-long-random-secret-key-here

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-filemanager-bucket-unique-name
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-filemanager-bucket-unique-name
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/

# Application
NODE_ENV=production
PORT=5000
```

## Step 4: Set Up Database

Run database migrations:
```bash
# Push database schema
npm run db:push

# Create default admin user (optional)
node -e "
const { AuthService } = require('./server/auth');
AuthService.createUser({
  username: 'admin',
  password: 'your-admin-password',
  role: 'admin'
}).then(() => console.log('Admin user created'));
"
```

## Step 5: Configure Process Management

Create PM2 ecosystem file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'filemanager',
    script: 'server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 6: Set Up Load Balancer (Optional but Recommended)

### 6.1 Create Application Load Balancer

1. Go to EC2 Console → Load Balancers
2. Create Application Load Balancer
3. Configure:
   - Name: `FileManagerALB`
   - Scheme: Internet-facing
   - Listeners: HTTP (80) and HTTPS (443)
   - Availability Zones: Select at least 2
4. Security Groups: Create new or use existing
5. Target Group:
   - Type: Instance
   - Protocol: HTTP
   - Port: 5000
   - Health check path: `/api/health`
6. Register your EC2 instance as target

### 6.2 Configure SSL Certificate

1. Request certificate in AWS Certificate Manager
2. Add certificate to HTTPS listener in load balancer
3. Update security groups to allow HTTPS traffic

## Step 7: Configure Domain (Optional)

### 7.1 Set Up Route 53

1. Create hosted zone for your domain
2. Create A record pointing to load balancer
3. Update nameservers at domain registrar

## Step 8: Security Hardening

### 8.1 Update Security Groups

Remove direct access to EC2:
```bash
# Remove direct HTTP access to EC2 (traffic should go through ALB)
aws ec2 revoke-security-group-ingress --group-name FileManagerEC2 --protocol tcp --port 5000 --cidr 0.0.0.0/0
```

### 8.2 Enable S3 Bucket Policies

Create bucket policy for secure access:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForGetBucketObjects",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-filemanager-bucket-unique-name/public/*"
    },
    {
      "Sid": "DenyInsecureConnections",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::your-filemanager-bucket-unique-name",
        "arn:aws:s3:::your-filemanager-bucket-unique-name/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

## Step 9: Monitoring and Backup

### 9.1 Set Up CloudWatch

1. Install CloudWatch agent on EC2
2. Monitor application logs
3. Set up alerts for high CPU, memory usage

### 9.2 Enable RDS Backups

1. Enable automated backups in RDS
2. Set backup retention period
3. Enable point-in-time recovery

### 9.3 S3 Backup Strategy

1. Enable S3 versioning (already done)
2. Set up S3 lifecycle policies
3. Consider cross-region replication

## Step 10: Deployment Script

Create `deploy.sh` for easy updates:
```bash
#!/bin/bash
echo "Deploying File Manager Application..."

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Run database migrations
npm run db:push

# Restart application
pm2 restart filemanager

echo "Deployment complete!"
```

## Cost Optimization Tips

1. **Use Reserved Instances**: Save up to 75% on EC2 costs
2. **Right-size Instances**: Monitor usage and adjust instance types
3. **S3 Storage Classes**: Move old files to cheaper storage tiers
4. **CloudWatch Monitoring**: Set up billing alerts
5. **Auto Scaling**: Scale EC2 instances based on demand

## Security Best Practices

1. **Regular Updates**: Keep OS and dependencies updated
2. **Access Control**: Use IAM roles, not access keys
3. **Network Security**: Use private subnets for databases
4. **Encryption**: Enable encryption at rest and in transit
5. **Monitoring**: Set up AWS CloudTrail for audit logging

## Troubleshooting

### Common Issues:

1. **Database Connection**: Check security groups and RDS endpoint
2. **S3 Access**: Verify IAM roles and bucket policies  
3. **Application Errors**: Check PM2 logs with `pm2 logs`
4. **Load Balancer**: Verify target group health checks

### Useful Commands:
```bash
# Check application status
pm2 status

# View logs
pm2 logs filemanager

# Restart application
pm2 restart filemanager

# Monitor system resources
htop
```

This deployment setup provides a production-ready, scalable, and secure file management application on AWS infrastructure.