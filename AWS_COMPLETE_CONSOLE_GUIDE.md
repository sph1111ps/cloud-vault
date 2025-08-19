# Complete AWS Deployment Guide - Console Version

Deploy your file management application with full production architecture using AWS Management Console.

## Architecture
- **EC2**: Application hosting
- **RDS PostgreSQL**: Database 
- **S3**: File storage
- **Application Load Balancer**: High availability
- **Route 53**: DNS (optional)

## Phase 1: Database Setup

### Create RDS PostgreSQL
1. Navigate to **RDS Console**
2. Click **Create database**
3. **Engine**: PostgreSQL 15.x
4. **Template**: Production or Free tier
5. **Settings**:
   - DB identifier: `filemanager-db`
   - Master username: `filemanager`
   - Auto-generate password (save it!)
6. **Instance**: db.t3.micro (free) or db.t3.small (production)
7. **Storage**: 20 GiB, enable autoscaling
8. **Connectivity**: Public access = Yes, create new security group
9. **Database name**: `filemanager`
10. **Create database** (wait 10-15 minutes)

## Phase 2: File Storage

### Create S3 Bucket
1. Navigate to **S3 Console**
2. **Create bucket**
3. **Name**: `your-app-files-[random-numbers]` (globally unique)
4. **Region**: Choose your preferred region
5. **Settings**:
   - Block public access: Checked
   - Versioning: Enabled
   - Encryption: SSE-S3
6. **Create bucket**

### Configure CORS
1. Go to bucket → **Permissions** → **CORS**
2. Add configuration:
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
3. **Save changes**

## Phase 3: IAM Role

### Create EC2 Role
1. Navigate to **IAM Console**
2. **Roles** → **Create role**
3. **Service**: EC2
4. **Policies**: Attach these:
   - `AmazonS3FullAccess`
   - `AmazonRDSDataFullAccess` 
   - `CloudWatchAgentServerPolicy`
5. **Name**: `FileManagerRole`
6. **Create role**

## Phase 4: Application Server

### Launch EC2 Instance
1. Navigate to **EC2 Console**
2. **Launch instance**
3. **Name**: `FileManager-App`
4. **AMI**: Amazon Linux 2023 (free tier eligible)
5. **Instance type**: t3.micro (free) or t3.small (production)
6. **Key pair**: Create new or select existing
7. **Security group**: Create new with rules:
   - SSH (22): My IP
   - HTTP (80): Anywhere
   - HTTPS (443): Anywhere
   - Custom TCP (5000): Anywhere
8. **Storage**: 20 GiB, encryption enabled
9. **Advanced**: IAM role = `FileManagerRole`
10. **User data**:
```bash
#!/bin/bash
yum update -y
yum install -y git postgresql15
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
npm install -g pm2
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app
```
11. **Launch instance**

## Phase 5: Deploy Application

### Connect to Instance
1. Select instance → **Connect** → **EC2 Instance Connect**

### Setup Application
```bash
# Clone your repository
git clone https://github.com/your-repo.git app
cd app

# Install dependencies
npm install
npm run build

# Create environment file
cat > .env << 'EOF'
DATABASE_URL=postgresql://filemanager:YOUR_DB_PASSWORD@YOUR_RDS_ENDPOINT:5432/filemanager
PGHOST=YOUR_RDS_ENDPOINT
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YOUR_DB_PASSWORD
PGDATABASE=filemanager
SESSION_SECRET=your-long-random-secret-key-here
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/
NODE_ENV=production
PORT=5000
EOF

# Initialize database
npm run db:push

# Create admin user
node -e "
const { AuthService } = require('./server/auth');
AuthService.createUser({
  username: 'admin',
  password: 'Admin123!',
  role: 'admin'
}).then(() => console.log('Admin created'));
"

# Start with PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'filemanager',
    script: 'server/index.js',
    env: { NODE_ENV: 'production', PORT: 5000 },
    instances: 1,
    autorestart: true
  }]
}
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Test Application
Visit `http://YOUR-EC2-IP:5000` and login with admin/Admin123!

## Phase 6: Load Balancer (Production)

### Create Target Group
1. **EC2** → **Target Groups** → **Create**
2. **Name**: `filemanager-tg`
3. **Protocol**: HTTP, **Port**: 5000
4. **Health check**: `/api/auth/me`
5. Register your EC2 instance

### Create Load Balancer
1. **EC2** → **Load Balancers** → **Create**
2. **Type**: Application Load Balancer
3. **Name**: `filemanager-alb`
4. **Scheme**: Internet-facing
5. **Network**: Default VPC, select 2+ availability zones
6. **Security groups**: Allow HTTP (80) and HTTPS (443)
7. **Listener**: HTTP:80 → Forward to target group
8. **Create**

## Phase 7: Security Hardening

### Update S3 Policy
1. Bucket → **Permissions** → **Bucket policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/public/*"
  }]
}
```

### Secure EC2 Access
1. Remove port 5000 rule from EC2 security group
2. Traffic now flows through load balancer only

## Phase 8: Domain Setup (Optional)

### Route 53
1. Create hosted zone for your domain
2. Create A record pointing to load balancer DNS
3. Update nameservers at domain registrar

## Phase 9: Monitoring

### CloudWatch Alarms
1. **CloudWatch** → **Alarms** → **Create**
2. **Metric**: EC2 CPU Utilization
3. **Threshold**: > 80%
4. **Action**: SNS notification

## Maintenance Commands
```bash
# Check status
pm2 status

# View logs
pm2 logs filemanager

# Update application
git pull
npm install
npm run build
pm2 restart filemanager

# System updates
sudo yum update -y
```

Your production-ready file management application is now deployed on AWS with full redundancy and monitoring.