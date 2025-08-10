# Quick Start Guide for AWS EC2 Deployment

## 🚀 Fast Track Deployment (15 minutes)

### Prerequisites
- AWS Account
- AWS CLI configured locally
- SSH key pair in AWS

### Step 1: One-Command Setup
```bash
# Download and run the setup script
curl -sSL https://raw.githubusercontent.com/your-username/your-repo/main/scripts/aws-setup.sh | bash
```

### Step 2: Deploy Your App
```bash
# SSH into your new EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Run the deployment script
curl -sSL https://raw.githubusercontent.com/your-username/your-repo/main/scripts/deploy.sh | bash
```

### Step 3: Configure Environment
```bash
# Edit environment variables
nano /opt/file-manager/.env

# Update these values:
S3_BUCKET_NAME=your-actual-bucket-name
DATABASE_URL=your-database-url

# Restart the application
sudo systemctl restart file-manager
```

### Step 4: Access Your App
Visit `http://your-ec2-ip` in your browser.

---

## 📋 Manual Step-by-Step Process

### 1. Create S3 Bucket
```bash
# Create bucket
aws s3 mb s3://my-filemanager-bucket-$(date +%s) --region us-east-1

# Note your bucket name for later
export BUCKET_NAME=my-filemanager-bucket-XXXXXX
```

### 2. Create IAM Role
```bash
# Create role for EC2 to access S3
aws iam create-role --role-name FileManager-EC2-S3-Role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}'

# Attach S3 policy
aws iam put-role-policy --role-name FileManager-EC2-S3-Role --policy-name S3Access --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": ["arn:aws:s3:::'"$BUCKET_NAME"'/*", "arn:aws:s3:::'"$BUCKET_NAME"'"]
    }
  ]
}'

# Create instance profile
aws iam create-instance-profile --instance-profile-name FileManager-EC2-Profile
aws iam add-role-to-instance-profile --instance-profile-name FileManager-EC2-Profile --role-name FileManager-EC2-S3-Role
```

### 3. Launch EC2 Instance
```bash
# Create security group
aws ec2 create-security-group --group-name filemanager-sg --description "File Manager Security Group"

# Get security group ID
SG_ID=$(aws ec2 describe-security-groups --group-names filemanager-sg --query 'SecurityGroups[0].GroupId' --output text)

# Allow HTTP, HTTPS, and SSH
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1d0 \
    --count 1 \
    --instance-type t3.micro \
    --key-name your-key-pair-name \
    --security-group-ids $SG_ID \
    --iam-instance-profile Name=FileManager-EC2-Profile
```

### 4. Deploy Application
```bash
# SSH into instance
ssh -i your-key.pem ec2-user@your-ec2-public-ip

# Update system and install Node.js
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Clone and setup app
sudo mkdir -p /opt/file-manager
sudo chown ec2-user:ec2-user /opt/file-manager
cd /opt/file-manager

git clone https://github.com/your-username/your-repo.git .
npm install

# Create environment file
cp .env.example .env
nano .env  # Edit with your values

# Build and start
npm run build
npm start
```

### 5. Setup Nginx (Optional)
```bash
sudo amazon-linux-extras install nginx1 -y

sudo tee /etc/nginx/conf.d/filemanager.conf > /dev/null << EOF
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 🔧 Troubleshooting

### Application Won't Start
```bash
# Check logs
sudo journalctl -u file-manager -f

# Check if app is running
ps aux | grep node

# Test direct connection
curl http://localhost:5000/health
```

### S3 Access Issues
```bash
# Test S3 access
aws s3 ls s3://your-bucket-name

# Check IAM role
aws sts get-caller-identity
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

### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx config
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🎯 Quick Commands Reference

```bash
# Restart application
sudo systemctl restart file-manager

# View logs
sudo journalctl -u file-manager -f

# Check status
sudo systemctl status file-manager

# Update application
cd /opt/file-manager && git pull && npm install && npm run build && sudo systemctl restart file-manager

# Check S3 bucket
aws s3 ls s3://your-bucket-name --recursive

# Monitor resources
htop
df -h
free -m
```

---

## 📊 Cost Optimization Tips

1. **Use t3.micro for testing** - Free tier eligible
2. **Enable S3 Intelligent Tiering** - Automatic cost optimization
3. **Set up billing alerts** - Monitor costs
4. **Use spot instances** - For non-production workloads
5. **Schedule auto-shutdown** - For development environments

---

## 🔒 Security Checklist

- [ ] Security groups only allow necessary ports
- [ ] IAM roles follow least privilege principle
- [ ] S3 bucket has proper access policies
- [ ] SSL/TLS certificate installed
- [ ] Regular security updates enabled
- [ ] Backup strategy in place
- [ ] Monitoring and logging configured

---

## 🚦 Next Steps

1. **Set up SSL certificate** with Let's Encrypt
2. **Configure custom domain** via Route 53
3. **Set up monitoring** with CloudWatch
4. **Enable auto-scaling** for high traffic
5. **Implement CI/CD pipeline** with GitHub Actions
6. **Set up database backups** and disaster recovery

Need help? Check the full AWS_DEPLOYMENT_GUIDE.md for detailed instructions!