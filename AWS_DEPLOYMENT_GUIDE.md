# AWS EC2 + S3 Deployment Guide

This guide will help you deploy your file management application to AWS EC2 with S3 storage integration.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI installed locally
- Domain name (optional, for custom domain)

## Step 1: Set up AWS S3 Bucket

### Create S3 Bucket
```bash
# Replace 'your-app-bucket' with your desired bucket name
aws s3 mb s3://your-app-bucket --region us-east-1
```

### Configure S3 Bucket Policy
Create a bucket policy to allow your EC2 instance to access the bucket:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowEC2Access",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR-ACCOUNT-ID:role/EC2-S3-Role"
            },
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-app-bucket/*",
                "arn:aws:s3:::your-app-bucket"
            ]
        }
    ]
}
```

### Enable CORS for S3 Bucket
```json
{
    "CORSRules": [
        {
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
            "AllowedHeaders": ["*"],
            "MaxAgeSeconds": 3000
        }
    ]
}
```

## Step 2: Create IAM Role for EC2

### Create IAM Role
```bash
# Create trust policy
cat > ec2-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Create the role
aws iam create-role --role-name EC2-S3-Role --assume-role-policy-document file://ec2-trust-policy.json

# Create S3 access policy
cat > s3-access-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": [
                "arn:aws:s3:::your-app-bucket/*",
                "arn:aws:s3:::your-app-bucket"
            ]
        }
    ]
}
EOF

# Attach policy to role
aws iam put-role-policy --role-name EC2-S3-Role --policy-name S3Access --policy-document file://s3-access-policy.json

# Create instance profile
aws iam create-instance-profile --instance-profile-name EC2-S3-Profile
aws iam add-role-to-instance-profile --instance-profile-name EC2-S3-Profile --role-name EC2-S3-Role
```

## Step 3: Launch EC2 Instance

### Create Security Group
```bash
# Create security group
aws ec2 create-security-group --group-name file-manager-sg --description "Security group for file manager app"

# Get security group ID
SG_ID=$(aws ec2 describe-security-groups --group-names file-manager-sg --query 'SecurityGroups[0].GroupId' --output text)

# Allow SSH (port 22)
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0

# Allow HTTP (port 80)
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0

# Allow HTTPS (port 443)
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0

# Allow app port (5000)
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5000 --cidr 0.0.0.0/0
```

### Launch EC2 Instance
```bash
# Launch EC2 instance (replace with your key pair name)
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1d0 \
    --count 1 \
    --instance-type t3.micro \
    --key-name your-key-pair \
    --security-group-ids $SG_ID \
    --iam-instance-profile Name=EC2-S3-Profile \
    --user-data file://user-data.sh
```

## Step 4: Prepare Application for AWS Deployment

### Create AWS Configuration Files

Create `aws-config.js`:
```javascript
import AWS from 'aws-sdk';

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

export const s3 = new AWS.S3();
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'your-app-bucket';
```

### Update Object Storage Service for AWS S3

Create `server/aws-storage.ts`:
```typescript
import AWS from 'aws-sdk';
import { Response } from 'express';
import { randomUUID } from 'crypto';

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'your-app-bucket';

export class AWSStorageService {
  async getSignedUploadUrl(key: string): Promise<string> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 900, // 15 minutes
      ContentType: 'application/octet-stream'
    };
    
    return s3.getSignedUrl('putObject', params);
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 3600 // 1 hour
    };
    
    return s3.getSignedUrl('getObject', params);
  }

  async deleteObject(key: string): Promise<void> {
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: key
    }).promise();
  }

  async listObjects(prefix?: string) {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix || ''
    };
    
    const result = await s3.listObjectsV2(params).promise();
    return result.Contents || [];
  }

  streamObject(key: string, res: Response) {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };
    
    const stream = s3.getObject(params).createReadStream();
    stream.pipe(res);
  }
}
```

### Update Routes for AWS S3
Update your `server/routes.ts` to use AWS S3 instead of Google Cloud Storage:

```typescript
import { AWSStorageService } from './aws-storage';

// Replace ObjectStorageService with AWSStorageService
const storageService = new AWSStorageService();

// Update upload URL endpoint
app.post("/api/files/upload-url", async (req, res) => {
  try {
    const fileId = randomUUID();
    const key = `uploads/${fileId}`;
    const uploadURL = await storageService.getSignedUploadUrl(key);
    
    res.json({ uploadURL, key });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Update file serving endpoint
app.get("/objects/:key(*)", async (req, res) => {
  try {
    const key = req.params.key;
    storageService.streamObject(key, res);
  } catch (error) {
    console.error("Error serving file:", error);
    res.status(404).json({ error: "File not found" });
  }
});
```

## Step 5: EC2 Setup Script

Create `user-data.sh` for automated EC2 setup:
```bash
#!/bin/bash
yum update -y
yum install -y docker git

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Start Docker
service docker start
usermod -a -G docker ec2-user

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /opt/file-manager
cd /opt/file-manager

# Clone your repository (replace with your repo URL)
git clone https://github.com/your-username/your-repo.git .

# Install dependencies
npm install

# Install AWS SDK
npm install aws-sdk

# Create systemd service
cat > /etc/systemd/system/file-manager.service << EOF
[Unit]
Description=File Manager App
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/file-manager
Environment=NODE_ENV=production
Environment=PORT=5000
Environment=S3_BUCKET_NAME=your-app-bucket
Environment=AWS_REGION=us-east-1
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl enable file-manager
systemctl start file-manager

# Install and configure Nginx
amazon-linux-extras install nginx1 -y

# Configure Nginx
cat > /etc/nginx/conf.d/file-manager.conf << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Start Nginx
systemctl enable nginx
systemctl start nginx
```

## Step 6: Environment Variables

Create `.env` file on your EC2 instance:
```bash
NODE_ENV=production
PORT=5000
S3_BUCKET_NAME=your-app-bucket
AWS_REGION=us-east-1
DATABASE_URL=postgresql://username:password@your-db-host:5432/database
```

## Step 7: Database Setup

### Option A: Amazon RDS PostgreSQL
```bash
# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier file-manager-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --master-username admin \
    --master-user-password your-secure-password \
    --allocated-storage 20 \
    --vpc-security-group-ids $SG_ID
```

### Option B: Use Neon (Current Setup)
Keep your existing Neon database connection and update the DATABASE_URL in your environment variables.

## Step 8: SSL Certificate (Optional)

### Using Let's Encrypt with Certbot
```bash
# Install certbot
yum install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## Step 9: Deployment Commands

### Manual Deployment
```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Navigate to app directory
cd /opt/file-manager

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build the app
npm run build

# Restart the service
sudo systemctl restart file-manager
```

### Automated Deployment Script
Create `deploy.sh`:
```bash
#!/bin/bash
set -e

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Run database migrations if needed
npm run db:migrate

# Restart application
sudo systemctl restart file-manager

# Check status
sudo systemctl status file-manager

echo "Deployment completed!"
```

## Step 10: Monitoring and Logs

### View Application Logs
```bash
# Service logs
sudo journalctl -u file-manager -f

# PM2 logs (if using PM2)
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Check Endpoint
Add to your Express app:
```javascript
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## Security Best Practices

1. **Keep systems updated**: Regularly update EC2 instance and dependencies
2. **Use IAM roles**: Don't hardcode AWS credentials
3. **Enable CloudTrail**: Track API calls for auditing
4. **Set up CloudWatch**: Monitor application metrics
5. **Use Security Groups**: Restrict access to necessary ports only
6. **Enable S3 bucket versioning**: Protect against accidental deletions
7. **Regular backups**: Backup your database regularly

## Scaling Considerations

### Load Balancing
- Use Application Load Balancer for multiple EC2 instances
- Configure auto-scaling groups based on CPU/memory usage

### CDN Setup
- Use CloudFront for static asset delivery
- Configure S3 bucket as CloudFront origin

### Database Scaling
- Use RDS read replicas for read-heavy workloads
- Consider connection pooling for database connections

## Cost Optimization

1. **Use Reserved Instances**: For predictable workloads
2. **S3 Intelligent Tiering**: Automatically move objects to cheaper storage classes
3. **CloudWatch monitoring**: Track costs and set up billing alerts
4. **Right-size instances**: Monitor CPU/memory usage and adjust instance types

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**: Check if application is running on port 5000
2. **S3 Access Denied**: Verify IAM role permissions and bucket policy
3. **Database Connection**: Check security groups and connection strings
4. **SSL Issues**: Verify domain DNS settings and certificate installation

### Debug Commands
```bash
# Check application status
sudo systemctl status file-manager

# Test S3 connectivity
aws s3 ls s3://your-app-bucket

# Check disk space
df -h

# Check memory usage
free -m

# Check network connectivity
netstat -tlnp
```

This guide should help you successfully deploy your file management application to AWS EC2 with S3 storage integration.