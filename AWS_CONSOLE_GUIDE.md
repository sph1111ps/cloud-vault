# AWS Console Step-by-Step Deployment Guide

This guide provides detailed, click-by-click instructions for deploying your file management application using the AWS Management Console.

## Part 1: Create RDS PostgreSQL Database

### Step 1: Navigate to RDS
1. Log into AWS Management Console
2. Search for "RDS" in the services search bar
3. Click on "RDS" from the dropdown

### Step 2: Create Database
1. Click **"Create database"** button (orange button)
2. Choose **"Standard create"**
3. Select **"PostgreSQL"** as engine type
4. Select **"PostgreSQL 15.x"** (latest stable version)

### Step 3: Configure Database Settings
**Templates:**
- For testing: Choose **"Free tier"**
- For production: Choose **"Production"**

**Settings:**
- DB instance identifier: `filemanager-db`
- Master username: `filemanager`
- Check **"Auto generate a password"** (IMPORTANT: Save this password!)

**DB instance class:**
- Free tier: `db.t3.micro`
- Production: `db.t3.small` or larger

**Storage:**
- Storage type: `gp2` (General Purpose SSD)
- Allocated storage: `20` GiB minimum
- Enable storage autoscaling: ✓

### Step 4: Configure Connectivity
**Network type:** IPv4
**Virtual private cloud (VPC):** Default VPC
**DB subnet group:** Default
**Public access:** **Yes** (for initial setup)
**VPC security group:** Create new
- New VPC security group name: `filemanager-db-sg`

**Availability zone:** No preference
**Database port:** `5432`

### Step 5: Database Authentication & Additional Configuration
**Database authentication:** Password authentication
**Monitoring:** Enable Enhanced monitoring
**Initial database name:** `filemanager`
**Backup retention period:** 7 days
**Encryption:** Enable encryption (recommended)

### Step 6: Create Database
1. Review all settings
2. Click **"Create database"**
3. **SAVE THE AUTO-GENERATED PASSWORD** (you'll need it later)
4. Wait for database status to become "Available" (10-15 minutes)

---

## Part 2: Create S3 Bucket for File Storage

### Step 1: Navigate to S3
1. Search for "S3" in the AWS Console
2. Click on **"S3"** from the services

### Step 2: Create Bucket
1. Click **"Create bucket"** button
2. **Bucket name:** `your-filemanager-files-[random-numbers]` 
   (Must be globally unique - add random numbers)
3. **AWS Region:** Choose your preferred region (e.g., us-east-1)

### Step 3: Configure Bucket Settings
**Object Ownership:** ACLs disabled (recommended)
**Block Public Access settings:**
- ✓ Block all public access (we'll configure specific access later)

**Bucket Versioning:** Enable
**Default encryption:**
- Encryption key type: Amazon S3 managed keys (SSE-S3)

### Step 4: Create Bucket
1. Click **"Create bucket"**
2. Note the bucket name for later use

### Step 5: Configure CORS
1. Go to your newly created bucket
2. Click **"Permissions"** tab
3. Scroll to **"Cross-origin resource sharing (CORS)"**
4. Click **"Edit"**
5. Paste this CORS configuration:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```
6. Click **"Save changes"**

---

## Part 3: Create IAM Role for EC2

### Step 1: Navigate to IAM
1. Search for "IAM" in AWS Console
2. Click on **"IAM"** from services

### Step 2: Create Role
1. Click **"Roles"** in left sidebar
2. Click **"Create role"**
3. **Trusted entity type:** AWS service
4. **Use case:** EC2
5. Click **"Next"**

### Step 3: Attach Policies
Search and select these policies:
- `AmazonS3FullAccess` (or create custom policy for your specific bucket)
- `AmazonRDSDataFullAccess`
- `CloudWatchAgentServerPolicy`

Click **"Next"**

### Step 4: Name and Create Role
- **Role name:** `FileManagerEC2Role`
- **Description:** "Role for File Manager EC2 instance with S3 and RDS access"
- Click **"Create role"**

---

## Part 4: Launch EC2 Instance

### Step 1: Navigate to EC2
1. Search for "EC2" in AWS Console
2. Click **"EC2"** from services

### Step 2: Launch Instance
1. Click **"Launch instance"** button
2. **Name:** `FileManager-App`

### Step 3: Choose AMI
1. **Application and OS Images:** Amazon Linux
2. Select **"Amazon Linux 2023 AMI"** (Free tier eligible)

### Step 4: Choose Instance Type
1. **Instance type:** `t3.micro` (Free tier) or `t3.small` (production)
2. Click **"Next"**

### Step 5: Configure Key Pair
**Key pair (login):**
- If you have a key pair: Select existing
- If not: Click **"Create new key pair"**
  - Name: `filemanager-key`
  - Key pair type: RSA
  - Private key format: .pem
  - Click **"Create key pair"** and DOWNLOAD the file

### Step 6: Network Settings
1. Click **"Edit"** next to Network settings
2. **VPC:** Default VPC
3. **Subnet:** Default subnet
4. **Auto-assign public IP:** Enable

**Security group:**
1. Click **"Create security group"**
2. **Security group name:** `filemanager-ec2-sg`
3. **Description:** "Security group for File Manager EC2"

**Inbound Security Group Rules:**
Add these rules (click "Add security group rule" for each):
1. Type: SSH, Port: 22, Source: My IP
2. Type: HTTP, Port: 80, Source: Anywhere (0.0.0.0/0)
3. Type: HTTPS, Port: 443, Source: Anywhere (0.0.0.0/0)
4. Type: Custom TCP, Port: 5000, Source: Anywhere (0.0.0.0/0)

### Step 7: Configure Storage
**Storage (volumes):**
- Size: 20 GiB (minimum)
- Volume type: gp3
- Encryption: Enabled

### Step 8: Advanced Details
**IAM instance profile:** Select `FileManagerEC2Role`

**User data:** Paste this script:
```bash
#!/bin/bash
yum update -y
yum install -y git postgresql15

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install PM2
npm install -g pm2

# Create app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

echo "EC2 setup complete" > /home/ec2-user/setup.log
```

### Step 9: Launch Instance
1. Review all settings
2. Click **"Launch instance"**
3. Wait for instance state to become "Running"
4. Note the **Public IPv4 address**

---

## Part 5: Deploy Your Application

### Step 1: Connect to EC2 Instance
1. Go to EC2 Console
2. Select your instance
3. Click **"Connect"**
4. Use **"EC2 Instance Connect"** (browser-based) or SSH

For SSH:
```bash
ssh -i filemanager-key.pem ec2-user@YOUR-EC2-PUBLIC-IP
```

### Step 2: Clone and Setup Application
```bash
# Clone your repository (replace with your actual repo URL)
git clone https://github.com/your-username/your-repo.git app
cd app

# Install dependencies
npm install

# Build the application
npm run build
```

### Step 3: Create Environment File
```bash
nano .env
```

Paste this content (replace placeholders with your actual values):
```env
# Database (get endpoint from RDS Console)
DATABASE_URL=postgresql://filemanager:YOUR-DB-PASSWORD@your-rds-endpoint:5432/filemanager
PGHOST=your-rds-endpoint
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YOUR-DB-PASSWORD
PGDATABASE=filemanager

# Session
SESSION_SECRET=your-very-long-random-secret-key-here-make-it-complex

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/

# Application
NODE_ENV=production
PORT=5000
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 4: Initialize Database
```bash
# Push database schema
npm run db:push

# Create admin user
node -e "
const { AuthService } = require('./server/auth');
(async () => {
  try {
    const user = await AuthService.createUser({
      username: 'admin',
      password: 'Admin123!',
      role: 'admin'
    });
    console.log('Admin user created:', user.username);
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
"
```

### Step 5: Start Application with PM2
```bash
# Create PM2 config
cat > ecosystem.config.js << 'EOF'
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
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 6: Test Your Application
1. Open browser
2. Go to `http://YOUR-EC2-PUBLIC-IP:5000`
3. Login with username: `admin`, password: `Admin123!`

---

## Part 6: Set Up Application Load Balancer (Production)

### Step 1: Create Target Group
1. Go to **EC2 Console** → **Target Groups** (left sidebar)
2. Click **"Create target group"**
3. **Target type:** Instances
4. **Target group name:** `filemanager-tg`
5. **Protocol:** HTTP
6. **Port:** 5000
7. **VPC:** Default VPC
8. **Health check path:** `/api/auth/me`
9. Click **"Next"**
10. **Select your EC2 instance**
11. **Port:** 5000
12. Click **"Include as pending below"**
13. Click **"Create target group"**

### Step 2: Create Application Load Balancer
1. Go to **EC2 Console** → **Load Balancers**
2. Click **"Create Load Balancer"**
3. Select **"Application Load Balancer"**
4. **Name:** `filemanager-alb`
5. **Scheme:** Internet-facing
6. **IP address type:** IPv4

**Network mapping:**
- **VPC:** Default VPC
- **Mappings:** Select at least 2 availability zones

**Security groups:**
1. Create new security group or use existing
2. Allow ports 80 (HTTP) and 443 (HTTPS)

**Listeners:**
- **Protocol:** HTTP
- **Port:** 80
- **Default action:** Forward to `filemanager-tg`

### Step 3: Configure DNS (Optional)
If you have a domain:
1. Go to **Route 53**
2. Create **A record** pointing to ALB DNS name

---

## Part 7: Security Hardening

### Step 1: Update S3 Bucket Policy
1. Go to your S3 bucket
2. **Permissions** → **Bucket policy**
3. Add this policy (replace YOUR-BUCKET-NAME):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForPublicFolder",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/public/*"
    }
  ]
}
```

### Step 2: Remove Direct EC2 Access
1. Go to **EC2 Console** → **Security Groups**
2. Find `filemanager-ec2-sg`
3. **Edit inbound rules**
4. Remove the rule for port 5000 (force traffic through load balancer)

---

## Part 8: Monitoring and Maintenance

### Step 1: Set Up CloudWatch Alarms
1. Go to **CloudWatch Console**
2. **Alarms** → **Create alarm**
3. Select metric: EC2 → By Instance → Your instance → CPUUtilization
4. Set threshold: > 80%
5. Configure notifications

### Step 2: Enable RDS Monitoring
1. Go to **RDS Console**
2. Select your database
3. **Modify**
4. Enable **Performance Insights**
5. Set monitoring interval to 60 seconds

### Step 3: Regular Maintenance
Create a maintenance checklist:
- [ ] Update EC2 instance weekly: `sudo yum update -y`
- [ ] Monitor application logs: `pm2 logs`
- [ ] Check disk space: `df -h`
- [ ] Review CloudWatch metrics
- [ ] Test backups monthly

---

## Troubleshooting Common Issues

### Issue: Can't connect to database
**Solution:**
1. Check RDS security group allows port 5432
2. Verify database endpoint in .env file
3. Test connection: `psql -h YOUR-RDS-ENDPOINT -U filemanager -d filemanager`

### Issue: S3 uploads failing
**Solution:**
1. Check IAM role has S3 permissions
2. Verify bucket CORS configuration
3. Check bucket policy allows uploads

### Issue: Application won't start
**Solution:**
1. Check PM2 logs: `pm2 logs filemanager`
2. Verify all environment variables are set
3. Check Node.js version: `node --version`

### Issue: Can't access application
**Solution:**
1. Check security group allows port 5000
2. Verify instance is running: `pm2 status`
3. Check application logs for errors

This completes your AWS deployment! Your file management application should now be running securely on AWS infrastructure.