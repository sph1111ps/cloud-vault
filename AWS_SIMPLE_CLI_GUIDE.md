# Simple AWS EC2 + S3 Deployment - CLI Version

Quick deployment using AWS CLI with EC2 and S3 only.

## Prerequisites
- AWS CLI installed and configured
- Git repository with your application

## Phase 1: S3 Bucket Setup

### Create and Configure S3
```bash
# Create unique bucket name
BUCKET_NAME="filemanager-$(whoami)-$(date +%s)"
echo "Using bucket: $BUCKET_NAME"

# Create bucket
aws s3 mb s3://$BUCKET_NAME

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Configure CORS
cat > cors-config.json << 'EOF'
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}
EOF

aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://cors-config.json

# Set bucket policy for public folder access
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$BUCKET_NAME/public/*"
  }]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file://bucket-policy.json

echo "✓ S3 bucket created: $BUCKET_NAME"
```

## Phase 2: IAM Role for S3

### Create EC2 Role
```bash
# Trust policy for EC2
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name FileManagerS3Role \
  --assume-role-policy-document file://trust-policy.json

# Attach S3 full access policy
aws iam attach-role-policy \
  --role-name FileManagerS3Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name FileManagerS3Profile

aws iam add-role-to-instance-profile \
  --instance-profile-name FileManagerS3Profile \
  --role-name FileManagerS3Role

echo "✓ IAM role created"
```

## Phase 3: Security Group

### Create Security Group
```bash
# Get default VPC ID
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=is-default,Values=true" \
  --query 'Vpcs[0].VpcId' --output text)

# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name filemanager-simple-sg \
  --description "FileManager Simple Security Group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

# Add rules
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5000 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

echo "✓ Security group created: $SG_ID"
```

## Phase 4: EC2 Instance Launch

### Create User Data Script
```bash
cat > user-data.sh << 'EOF'
#!/bin/bash
yum update -y
yum install -y git postgresql15 postgresql15-server

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
npm install -g pm2

# Initialize PostgreSQL
postgresql-setup --initdb
systemctl enable postgresql
systemctl start postgresql

# Configure PostgreSQL
sudo -u postgres psql << 'PSQL'
CREATE DATABASE filemanager;
CREATE USER filemanager WITH PASSWORD 'filemanager123';
GRANT ALL PRIVILEGES ON DATABASE filemanager TO filemanager;
ALTER USER filemanager CREATEDB;
\q
PSQL

# Configure PostgreSQL connections
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /var/lib/pgsql/data/postgresql.conf
echo "host all filemanager 127.0.0.1/32 md5" >> /var/lib/pgsql/data/pg_hba.conf
systemctl restart postgresql

# Prepare app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

# Log completion
echo "$(date): User data script completed" >> /var/log/user-data.log
EOF
```

### Launch Instance
```bash
# Get latest Amazon Linux 2023 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-*-x86_64" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

# Create key pair if needed
KEY_NAME="filemanager-key-$(date +%s)"
aws ec2 create-key-pair \
  --key-name $KEY_NAME \
  --query 'KeyMaterial' \
  --output text > ${KEY_NAME}.pem
chmod 600 ${KEY_NAME}.pem

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --count 1 \
  --instance-type t3.micro \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --iam-instance-profile Name=FileManagerS3Profile \
  --user-data file://user-data.sh \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3,Encrypted=true}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=FileManager-Simple}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✓ Launching instance: $INSTANCE_ID"
echo "  Waiting for instance to be running..."

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "✓ Instance running at: $PUBLIC_IP"
echo "  SSH: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
```

## Phase 5: Application Deployment

### Connect and Deploy
```bash
echo "Waiting 3 minutes for user data script to complete..."
sleep 180

# SSH and deploy (you can also do this manually)
cat > deploy.sh << EOF
#!/bin/bash
ssh -i ${KEY_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'DEPLOY'
# Wait for user data to complete
while [ ! -f /var/log/user-data.log ]; do
  echo "Waiting for user data script..."
  sleep 30
done

echo "Cloning application..."
cd /home/ec2-user
git clone https://github.com/your-username/your-repo.git app
cd app

echo "Installing dependencies..."
npm install
npm run build

echo "Creating environment file..."
cat > .env << 'ENV'
DATABASE_URL=postgresql://filemanager:filemanager123@localhost:5432/filemanager
PGHOST=localhost
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=filemanager123
PGDATABASE=filemanager
SESSION_SECRET=\$(openssl rand -base64 32)
AWS_REGION=\$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
AWS_S3_BUCKET=$BUCKET_NAME
DEFAULT_OBJECT_STORAGE_BUCKET_ID=$BUCKET_NAME
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/
NODE_ENV=production
PORT=5000
ENV

echo "Initializing database..."
npm run db:push

echo "Creating admin user..."
node -e "
const { AuthService } = require('./server/auth');
(async () => {
  try {
    await AuthService.createUser({
      username: 'admin',
      password: 'Admin123!',
      role: 'admin'
    });
    console.log('Admin user created');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
"

echo "Setting up PM2..."
cat > ecosystem.config.js << 'PM2'
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
    max_memory_restart: '800M'
  }]
}
PM2

pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "Deployment complete!"
echo "Application URL: http://$PUBLIC_IP:5000"
echo "Login: admin / Admin123!"
DEPLOY
EOF

chmod +x deploy.sh
./deploy.sh
```

## Phase 6: Verification

### Test Deployment
```bash
# Check if application is responding
echo "Testing application..."
curl -s -o /dev/null -w "%{http_code}" http://$PUBLIC_IP:5000

# Test S3 access
aws s3 ls s3://$BUCKET_NAME

echo "=== Deployment Summary ==="
echo "Application URL: http://$PUBLIC_IP:5000"
echo "S3 Bucket: $BUCKET_NAME"
echo "SSH Key: ${KEY_NAME}.pem"
echo "SSH Command: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
echo "Login Credentials: admin / Admin123!"
```

## Phase 7: Basic Monitoring Setup

### CloudWatch Alarm
```bash
# Create CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "FileManager-HighCPU" \
  --alarm-description "FileManager High CPU Usage" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID \
  --evaluation-periods 2 \
  --treat-missing-data notBreaching

echo "✓ CloudWatch alarm created"
```

## Management Commands

### Application Management
```bash
# Check application status
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP "pm2 status"

# View logs
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP "pm2 logs filemanager"

# Restart application
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP "cd app && git pull && pm2 restart filemanager"

# Database backup
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP "sudo -u postgres pg_dump filemanager > backup-\$(date +%Y%m%d).sql"
```

### Cleanup (when no longer needed)
```bash
# Terminate instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Delete S3 bucket (remove all objects first)
aws s3 rm s3://$BUCKET_NAME --recursive
aws s3api delete-bucket --bucket $BUCKET_NAME

# Delete security group
aws ec2 delete-security-group --group-id $SG_ID

# Delete IAM resources
aws iam remove-role-from-instance-profile --instance-profile-name FileManagerS3Profile --role-name FileManagerS3Role
aws iam delete-instance-profile --instance-profile-name FileManagerS3Profile
aws iam detach-role-policy --role-name FileManagerS3Role --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam delete-role --role-name FileManagerS3Role

# Delete key pair
aws ec2 delete-key-pair --key-name $KEY_NAME
rm ${KEY_NAME}.pem
```

## Troubleshooting

### Debug Instance Issues
```bash
# Check instance logs
aws ec2 get-console-output --instance-id $INSTANCE_ID

# SSH and check services
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP "sudo systemctl status postgresql"
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP "pm2 status"
```

Your simple file management application is now deployed on AWS with automated CLI scripts!