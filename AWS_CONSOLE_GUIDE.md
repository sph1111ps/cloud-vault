# AWS Console Deployment Guide
## Deploy Your File Management App Using AWS Web Interface

This guide walks you through deploying your file management application using the AWS Console (web interface) instead of command line tools.

---

## 🎯 Overview
We'll set up:
- S3 bucket for file storage
- EC2 instance to run your application
- IAM roles for secure access
- Security groups for network access
- Optional: RDS database (or keep your existing Neon database)

**Estimated Time:** 30-45 minutes

---

## Step 1: Create S3 Bucket

### 1.1 Navigate to S3
1. Go to [AWS Console](https://aws.amazon.com/console/)
2. Sign in to your AWS account
3. In the search bar, type "S3" and click on "S3"

### 1.2 Create Bucket
1. Click **"Create bucket"**
2. **Bucket name:** Enter a unique name like `my-filemanager-bucket-2025` (must be globally unique)
3. **Region:** Select your preferred region (e.g., `us-east-1`)
4. **Object Ownership:** Select "ACLs enabled"
5. **Block Public Access:** Uncheck "Block all public access" (we'll configure this properly)
6. Check the acknowledgment box
7. **Bucket Versioning:** Enable (recommended)
8. **Default encryption:** Enable with Amazon S3 managed keys (SSE-S3)
9. Click **"Create bucket"**

### 1.3 Configure CORS
1. Click on your newly created bucket
2. Go to **"Permissions"** tab
3. Scroll down to **"Cross-origin resource sharing (CORS)"**
4. Click **"Edit"**
5. Paste this configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

6. Click **"Save changes"**

### 1.4 Configure Bucket Policy
1. Still in **"Permissions"** tab
2. Scroll to **"Bucket policy"**
3. Click **"Edit"**
4. Paste this policy (replace `YOUR-BUCKET-NAME` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowEC2Access",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR-ACCOUNT-ID:role/FileManager-EC2-Role"
            },
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::YOUR-BUCKET-NAME/*",
                "arn:aws:s3:::YOUR-BUCKET-NAME"
            ]
        }
    ]
}
```

**Note:** We'll get your Account ID and create the role in the next steps. Save this policy draft for now.

---

## Step 2: Create IAM Role

### 2.1 Navigate to IAM
1. In AWS Console search bar, type "IAM" and click on "IAM"
2. In the left sidebar, click **"Roles"**

### 2.2 Create Role
1. Click **"Create role"**
2. **Trusted entity type:** Select "AWS service"
3. **Use case:** Select "EC2"
4. Click **"Next"**

### 2.3 Add Permissions
1. In the search box, type "S3"
2. Check **"AmazonS3FullAccess"** (for simplicity; you can create custom policy later)
3. Also search and add **"CloudWatchAgentServerPolicy"** (for monitoring)
4. Click **"Next"**

### 2.4 Name and Create
1. **Role name:** `FileManager-EC2-Role`
2. **Description:** "Role for EC2 instance to access S3 bucket for file management app"
3. Click **"Create role"**

### 2.5 Get Your Account ID
1. Click on your username in the top right corner
2. Note down your **Account ID** (12-digit number)
3. Go back to your S3 bucket policy and replace `YOUR-ACCOUNT-ID` with this number
4. Replace `YOUR-BUCKET-NAME` with your bucket name
5. Save the bucket policy

---

## Step 3: Create Security Group

### 3.1 Navigate to EC2
1. In AWS Console search bar, type "EC2" and click on "EC2"
2. In the left sidebar, click **"Security Groups"**

### 3.2 Create Security Group
1. Click **"Create security group"**
2. **Security group name:** `filemanager-security-group`
3. **Description:** "Security group for file management application"
4. **VPC:** Leave default

### 3.3 Configure Inbound Rules
Click **"Add rule"** for each of these:

**Rule 1 - SSH:**
- Type: SSH
- Protocol: TCP
- Port: 22
- Source: My IP (automatically detects your IP)

**Rule 2 - HTTP:**
- Type: HTTP
- Protocol: TCP
- Port: 80
- Source: Anywhere-IPv4 (0.0.0.0/0)

**Rule 3 - HTTPS:**
- Type: HTTPS
- Protocol: TCP
- Port: 443
- Source: Anywhere-IPv4 (0.0.0.0/0)

**Rule 4 - Custom (App Port):**
- Type: Custom TCP
- Protocol: TCP
- Port: 5000
- Source: Anywhere-IPv4 (0.0.0.0/0)

### 3.4 Create Security Group
1. Leave **Outbound rules** as default (allows all outbound traffic)
2. Click **"Create security group"**

---

## Step 4: Launch EC2 Instance

### 4.1 Launch Instance
1. In EC2 Dashboard, click **"Launch instance"**

### 4.2 Configure Instance
**Name:** `FileManager-App-Server`

**Application and OS Images:**
- Select **"Amazon Linux 2023 AMI"** (Free tier eligible)

**Instance type:**
- Select **"t3.micro"** (Free tier eligible) or **"t3.small"** for better performance

**Key pair:**
- If you have an existing key pair, select it
- If not, click **"Create new key pair"**:
  - Name: `filemanager-keypair`
  - Type: RSA
  - Format: .pem (for SSH)
  - Click **"Create key pair"** and download the file

**Network settings:**
- Click **"Edit"**
- **VPC:** Leave default
- **Subnet:** Leave default
- **Auto-assign public IP:** Enable
- **Firewall (security groups):** Select existing security group
- Choose `filemanager-security-group` that we created

**Configure storage:**
- Size: 20 GB (or more if you expect large files)
- Volume type: gp3 (General Purpose SSD)

### 4.3 Advanced Details
1. Expand **"Advanced details"**
2. **IAM instance profile:** Select `FileManager-EC2-Role`
3. **User data:** Paste this script to automatically set up the server:

```bash
#!/bin/bash
yum update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# Install PM2 for process management
npm install -g pm2

# Create application directory
mkdir -p /opt/file-manager
cd /opt/file-manager

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
yum install -y unzip
unzip awscliv2.zip
./aws/install

# Create a placeholder for the app (you'll upload your code later)
echo "Application directory created. Upload your code here." > README.txt

# Install and configure Nginx
yum install -y nginx

# Create Nginx configuration
cat > /etc/nginx/conf.d/filemanager.conf << 'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
EOF

# Start and enable Nginx
systemctl enable nginx
systemctl start nginx

# Create systemd service file for the app
cat > /etc/systemd/system/file-manager.service << 'EOF'
[Unit]
Description=File Manager Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/file-manager
Environment=NODE_ENV=production
Environment=PORT=5000
EnvironmentFile=/opt/file-manager/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Set proper ownership
chown -R ec2-user:ec2-user /opt/file-manager

# Enable the service (don't start yet, as we need to upload code first)
systemctl enable file-manager

echo "EC2 instance setup complete!"
```

### 4.4 Launch Instance
1. **Number of instances:** 1
2. Review all settings
3. Click **"Launch instance"**
4. Wait for the instance to be in "Running" state (about 2-3 minutes)

---

## Step 5: Upload Your Application Code

### 5.1 Get Instance IP
1. In EC2 Dashboard, click **"Instances"**
2. Select your instance
3. Note the **"Public IPv4 address"**

### 5.2 Connect to Your Instance
**Option A: EC2 Instance Connect (Browser-based)**
1. Select your instance
2. Click **"Connect"**
3. Choose **"EC2 Instance Connect"**
4. Click **"Connect"**

**Option B: SSH (Local Terminal)**
```bash
ssh -i /path/to/your-keypair.pem ec2-user@YOUR-INSTANCE-IP
```

### 5.3 Upload Your Code
Once connected to your instance:

```bash
# Navigate to app directory
cd /opt/file-manager

# Clone your repository (replace with your GitHub repo)
sudo -u ec2-user git clone https://github.com/your-username/your-repo.git .

# Install dependencies
sudo -u ec2-user npm install

# Install AWS SDK
sudo -u ec2-user npm install aws-sdk

# Create environment file
sudo -u ec2-user cp .env.example .env
```

### 5.4 Configure Environment
Edit the environment file:
```bash
sudo -u ec2-user nano .env
```

Update these values:
```bash
NODE_ENV=production
PORT=5000
S3_BUCKET_NAME=your-actual-bucket-name
AWS_REGION=us-east-1
DATABASE_URL=your-database-url
```

### 5.5 Build and Start Application
```bash
# Build the application
sudo -u ec2-user npm run build

# Start the service
sudo systemctl start file-manager

# Check if it's running
sudo systemctl status file-manager

# Check logs
sudo journalctl -u file-manager -f
```

---

## Step 6: Test Your Application

### 6.1 Health Check
```bash
curl http://localhost:5000/health
```

### 6.2 Access via Browser
1. Open your browser
2. Go to `http://YOUR-INSTANCE-IP`
3. You should see your file management application

---

## Step 7: Set Up Custom Domain (Optional)

### 7.1 Register Domain in Route 53
1. Go to **Route 53** in AWS Console
2. Click **"Registered domains"** > **"Register domain"**
3. Search for your desired domain
4. Complete the registration process

### 7.2 Create Hosted Zone
1. Go to **"Hosted zones"** > **"Create hosted zone"**
2. Enter your domain name
3. Click **"Create hosted zone"**

### 7.3 Create A Record
1. In your hosted zone, click **"Create record"**
2. **Record type:** A
3. **Value:** Your EC2 instance's public IP
4. Click **"Create records"**

### 7.4 Configure SSL Certificate
1. Go to **AWS Certificate Manager**
2. Click **"Request certificate"**
3. **Certificate type:** Request a public certificate
4. **Domain name:** your-domain.com
5. **Validation method:** DNS validation
6. Follow the validation process

---

## Step 8: Monitoring and Maintenance

### 8.1 CloudWatch Monitoring
1. Go to **CloudWatch** in AWS Console
2. Set up dashboards for:
   - EC2 CPU utilization
   - S3 storage usage
   - Application logs

### 8.2 Set Up Billing Alerts
1. Go to **Billing and Cost Management**
2. **Budgets** > **Create budget**
3. Set up alerts for your expected monthly costs

### 8.3 Regular Maintenance
```bash
# SSH into your instance regularly to:

# Update system packages
sudo yum update -y

# Update your application
cd /opt/file-manager
git pull origin main
npm install
npm run build
sudo systemctl restart file-manager

# Check logs
sudo journalctl -u file-manager -f

# Monitor disk space
df -h

# Check memory usage
free -m
```

---

## 🔧 Troubleshooting

### Application Not Starting
```bash
# Check service status
sudo systemctl status file-manager

# View detailed logs
sudo journalctl -u file-manager -f

# Check if port is in use
sudo netstat -tlnp | grep 5000

# Test Node.js directly
cd /opt/file-manager && node server/index.js
```

### Cannot Access Website
1. **Check Security Group:** Ensure port 80 and 443 are open
2. **Check Nginx:** `sudo systemctl status nginx`
3. **Check Instance:** Ensure it's running and has public IP
4. **Check Route 53:** If using custom domain, verify DNS records

### S3 Access Issues
```bash
# Test S3 access from EC2
aws s3 ls s3://your-bucket-name

# Check IAM role
aws sts get-caller-identity

# Test S3 permissions
aws s3 cp test.txt s3://your-bucket-name/test.txt
```

### Database Connection Issues
```bash
# Test database connection
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon('your-database-url');
sql\`SELECT 1\`.then(console.log).catch(console.error);
"
```

---

## 💰 Cost Optimization

### Free Tier Usage
- **EC2:** t3.micro instances (750 hours/month)
- **S3:** 5GB storage, 20,000 GET requests, 2,000 PUT requests
- **Data Transfer:** 15GB outbound per month

### Cost Monitoring
1. Set up billing alerts
2. Use AWS Cost Explorer
3. Review usage monthly
4. Consider Reserved Instances for production

### Optimization Tips
- Use S3 Intelligent Tiering
- Enable S3 lifecycle policies
- Right-size your EC2 instances
- Use CloudFront for static content delivery

---

## 🔒 Security Best Practices

### Immediate Actions
- [ ] Change default SSH port (optional)
- [ ] Set up fail2ban for SSH protection
- [ ] Enable CloudTrail for API logging
- [ ] Set up AWS Config for compliance

### Regular Security Tasks
- [ ] Update system packages monthly
- [ ] Review IAM permissions quarterly
- [ ] Monitor CloudWatch logs
- [ ] Backup database regularly
- [ ] Test disaster recovery procedures

---

## 🚀 Next Steps

1. **SSL Certificate:** Set up HTTPS with Let's Encrypt or AWS Certificate Manager
2. **Auto Scaling:** Configure auto-scaling groups for high availability
3. **Load Balancer:** Add Application Load Balancer for multiple instances
4. **CI/CD Pipeline:** Set up automated deployments with GitHub Actions
5. **Backup Strategy:** Implement automated backups for your data
6. **Monitoring:** Set up comprehensive monitoring and alerting

---

Your file management application is now successfully deployed on AWS! You can access it via your EC2 instance's public IP address or your custom domain if configured.

For support or questions, refer to the troubleshooting section or check the AWS documentation.