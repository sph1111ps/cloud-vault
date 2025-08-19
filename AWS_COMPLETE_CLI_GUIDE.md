# Complete AWS Deployment Guide - CLI Version

Deploy your file management application with full production architecture using AWS CLI.

## Prerequisites
- AWS CLI installed and configured
- Domain name (optional)

## Phase 1: Infrastructure Setup

### Create VPC and Networking
```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)
aws ec2 create-tags --resources $VPC_ID --tags Key=Name,Value=FileManagerVPC

# Create subnets
SUBNET1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --query 'Subnet.SubnetId' --output text)
SUBNET2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --query 'Subnet.SubnetId' --output text)

# Create and attach internet gateway
IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# Create route table and routes
RT_ID=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --subnet-id $SUBNET1 --route-table-id $RT_ID
aws ec2 associate-route-table --subnet-id $SUBNET2 --route-table-id $RT_ID
```

### Create Security Groups
```bash
# EC2 Security Group
EC2_SG=$(aws ec2 create-security-group --group-name filemanager-ec2 --description "FileManager EC2" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $EC2_SG --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG --protocol tcp --port 5000 --cidr 0.0.0.0/0

# RDS Security Group  
RDS_SG=$(aws ec2 create-security-group --group-name filemanager-rds --description "FileManager RDS" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $EC2_SG

# ALB Security Group
ALB_SG=$(aws ec2 create-security-group --group-name filemanager-alb --description "FileManager ALB" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
```

## Phase 2: Database Setup

### Create RDS PostgreSQL
```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name filemanager-subnet-group \
  --db-subnet-group-description "FileManager DB Subnet Group" \
  --subnet-ids $SUBNET1 $SUBNET2

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier filemanager-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username filemanager \
  --master-user-password "YourSecurePassword123!" \
  --allocated-storage 20 \
  --db-name filemanager \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name filemanager-subnet-group \
  --publicly-accessible \
  --storage-encrypted

# Wait for DB to be available (10-15 minutes)
aws rds wait db-instance-available --db-instance-identifier filemanager-db

# Get endpoint
DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier filemanager-db --query 'DBInstances[0].Endpoint.Address' --output text)
echo "Database endpoint: $DB_ENDPOINT"
```

## Phase 3: File Storage

### Create S3 Bucket
```bash
# Create bucket (replace with unique name)
BUCKET_NAME="filemanager-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME

# Enable versioning
aws s3api put-bucket-versioning --bucket $BUCKET_NAME --versioning-configuration Status=Enabled

# Configure CORS
cat > cors.json << 'EOF'
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}
EOF
aws s3api put-bucket-cors --bucket $BUCKET_NAME --cors-configuration file://cors.json

# Set bucket policy for public folder
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
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json

echo "S3 bucket: $BUCKET_NAME"
```

## Phase 4: IAM Role

### Create EC2 Role
```bash
# Create trust policy
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

# Create role
aws iam create-role --role-name FileManagerRole --assume-role-policy-document file://trust-policy.json

# Attach policies
aws iam attach-role-policy --role-name FileManagerRole --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-role-policy --role-name FileManagerRole --policy-arn arn:aws:iam::aws:policy/AmazonRDSDataFullAccess
aws iam attach-role-policy --role-name FileManagerRole --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

# Create instance profile
aws iam create-instance-profile --instance-profile-name FileManagerProfile
aws iam add-role-to-instance-profile --instance-profile-name FileManagerProfile --role-name FileManagerRole
```

## Phase 5: Application Server

### Launch EC2 Instance
```bash
# Get latest Amazon Linux AMI
AMI_ID=$(aws ec2 describe-images --owners amazon --filters "Name=name,Values=amzn2-ami-hvm-*" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' --output text)

# Create key pair (if needed)
aws ec2 create-key-pair --key-name filemanager-key --query 'KeyMaterial' --output text > filemanager-key.pem
chmod 600 filemanager-key.pem

# Create user data script
cat > user-data.sh << 'EOF'
#!/bin/bash
yum update -y
yum install -y git postgresql15
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
npm install -g pm2
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app
EOF

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --count 1 \
  --instance-type t3.micro \
  --key-name filemanager-key \
  --security-group-ids $EC2_SG \
  --subnet-id $SUBNET1 \
  --iam-instance-profile Name=FileManagerProfile \
  --user-data file://user-data.sh \
  --associate-public-ip-address \
  --query 'Instances[0].InstanceId' --output text)

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Instance IP: $PUBLIC_IP"
```

## Phase 6: Deploy Application

### Connect and Setup
```bash
# SSH to instance
ssh -i filemanager-key.pem ec2-user@$PUBLIC_IP

# On the EC2 instance, run:
git clone https://github.com/your-repo.git app
cd app
npm install
npm run build

# Create environment file
cat > .env << EOF
DATABASE_URL=postgresql://filemanager:YourSecurePassword123!@$DB_ENDPOINT:5432/filemanager
PGHOST=$DB_ENDPOINT
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YourSecurePassword123!
PGDATABASE=filemanager
SESSION_SECRET=$(openssl rand -base64 32)
AWS_REGION=us-east-1
AWS_S3_BUCKET=$BUCKET_NAME
DEFAULT_OBJECT_STORAGE_BUCKET_ID=$BUCKET_NAME
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

# Setup PM2
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

## Phase 7: Load Balancer

### Create Target Group and ALB
```bash
# Create target group
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
  --name filemanager-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id $VPC_ID \
  --health-check-path /api/auth/me \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Register EC2 instance
aws elbv2 register-targets --target-group-arn $TARGET_GROUP_ARN --targets Id=$INSTANCE_ID,Port=5000

# Create load balancer
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name filemanager-alb \
  --subnets $SUBNET1 $SUBNET2 \
  --security-groups $ALB_SG \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)
echo "Load Balancer URL: http://$ALB_DNS"
```

## Phase 8: Monitoring

### CloudWatch Alarms
```bash
# CPU Utilization Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name filemanager-high-cpu \
  --alarm-description "FileManager High CPU" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID \
  --evaluation-periods 2
```

## Phase 9: Security Hardening

### Update Security Groups
```bash
# Remove direct access to EC2
aws ec2 revoke-security-group-ingress --group-id $EC2_SG --protocol tcp --port 5000 --cidr 0.0.0.0/0

# Allow ALB to EC2
aws ec2 authorize-security-group-ingress --group-id $EC2_SG --protocol tcp --port 5000 --source-group $ALB_SG
```

## Deployment Summary
```bash
echo "=== Deployment Complete ==="
echo "Application URL: http://$ALB_DNS"  
echo "Direct EC2 URL: http://$PUBLIC_IP:5000"
echo "Database Endpoint: $DB_ENDPOINT"
echo "S3 Bucket: $BUCKET_NAME"
echo "Login: admin / Admin123!"
```

Your production file management application is now deployed with full AWS architecture via CLI automation.