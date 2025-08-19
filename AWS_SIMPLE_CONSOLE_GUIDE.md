# Simple AWS EC2 + S3 Deployment - Console Version

Quick deployment of your file management application using just EC2 and S3.

## Architecture
- **EC2 Instance**: Hosts your complete application
- **S3 Bucket**: File storage only
- **Built-in PostgreSQL**: Database runs on EC2 (simpler setup)

## Phase 1: File Storage Setup

### Create S3 Bucket
1. Navigate to **S3 Console**
2. **Create bucket**
3. **Bucket name**: `your-filemanager-[random-numbers]` (globally unique)
4. **Region**: Choose preferred region
5. **Settings**:
   - Object ownership: ACLs disabled
   - Block public access: Unchecked (we'll configure specific access)
   - Versioning: Enabled  
   - Encryption: Amazon S3 managed keys
6. **Create bucket**

### Configure S3 Access
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

3. **Bucket Policy** (allows public read for public folder):
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

## Phase 2: IAM Role for S3 Access

### Create EC2 Role
1. Navigate to **IAM Console**
2. **Roles** → **Create role**
3. **Service**: EC2
4. **Policies**: Attach `AmazonS3FullAccess`
5. **Role name**: `FileManagerS3Role`
6. **Create role**

## Phase 3: Application Server

### Launch EC2 Instance
1. Navigate to **EC2 Console**
2. **Launch instance**
3. **Name**: `FileManager-Simple`
4. **AMI**: Amazon Linux 2023 
5. **Instance type**: 
   - Free tier: t3.micro
   - Production: t3.small
6. **Key pair**: Create new or select existing
7. **Security group**: Create new with:
   - SSH (22): My IP
   - HTTP (80): Anywhere  
   - Custom TCP (5000): Anywhere
8. **Storage**: 20 GiB (minimum for PostgreSQL data)
9. **Advanced Details**:
   - **IAM instance profile**: `FileManagerS3Role`
   - **User data**:
```bash
#!/bin/bash
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting user data script at $(date)"

# Update system
yum update -y

# Install basic packages
yum install -y git wget curl

# Install PostgreSQL 15
yum install -y postgresql15 postgresql15-server

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install PM2 globally
npm install -g pm2

echo "Packages installed, initializing PostgreSQL..."

# Initialize PostgreSQL with error checking
if postgresql-setup --initdb; then
    echo "PostgreSQL initialized successfully"
else
    echo "PostgreSQL initialization failed, trying alternative method"
    sudo -u postgres /usr/pgsql-15/bin/initdb -D /var/lib/pgsql/15/data
fi

# Enable and start PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Wait for PostgreSQL to start
sleep 10

# Create database and user with error checking
sudo -u postgres psql << 'PSQL'
CREATE DATABASE filemanager;
CREATE USER filemanager WITH PASSWORD 'filemanager123';
GRANT ALL PRIVILEGES ON DATABASE filemanager TO filemanager;
ALTER USER filemanager CREATEDB;
\q
PSQL

if [ $? -eq 0 ]; then
    echo "Database and user created successfully"
else
    echo "Database creation failed"
fi

# Configure PostgreSQL for local connections
PG_CONF="/var/lib/pgsql/data/postgresql.conf"
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"

# Check if files exist and configure
if [ -f "$PG_CONF" ]; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF
    echo "host all filemanager 127.0.0.1/32 md5" >> $PG_HBA
    systemctl restart postgresql
    echo "PostgreSQL configured for local connections"
else
    echo "PostgreSQL config files not found at expected location"
fi

# Create app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

# Create status file
echo "User data script completed successfully at $(date)" > /home/ec2-user/setup-complete.log
echo "Script completed"
```
10. **Launch instance**

## Phase 4: Deploy Application

### Connect to Instance
1. Wait for instance to be "Running" (5-10 minutes for full setup)
2. **Connect** → **EC2 Instance Connect**

### Setup Application
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Clone your repository
git clone https://github.com/your-repo.git app
cd app

# Install dependencies
npm install
npm run build

# Create environment file
cat > .env << 'EOF'
# Local PostgreSQL Database
DATABASE_URL=postgresql://filemanager:filemanager123@localhost:5432/filemanager
PGHOST=localhost
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=filemanager123
PGDATABASE=filemanager

# Session secret
SESSION_SECRET=your-very-long-secure-session-secret-key-here

# AWS S3 (replace with your bucket name)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
DEFAULT_OBJECT_STORAGE_BUCKET_ID=your-bucket-name
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/

# Application settings
NODE_ENV=production
PORT=5000
EOF

# Initialize database schema
npm run db:push

# Create admin user
node -e "
const { AuthService } = require('./server/auth');
(async () => {
  try {
    await AuthService.createUser({
      username: 'admin',
      password: 'Admin123!',
      role: 'admin'
    });
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
})();
"

# Setup PM2 for process management
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
    max_memory_restart: '800M'
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Test Your Application
1. Get your EC2 public IP from the console
2. Visit `http://YOUR-EC2-IP:5000`
3. Login with:
   - Username: `admin`
   - Password: `Admin123!`
4. Test file upload to verify S3 integration

## Phase 5: Basic Monitoring

### Setup CloudWatch (Optional)
1. Navigate to **CloudWatch Console**
2. **Alarms** → **Create alarm**
3. **Metric**: EC2 → CPU Utilization
4. **Threshold**: > 80%
5. **Action**: Email notification

## Maintenance

### Regular Tasks
```bash
# Check application status
pm2 status

# View logs
pm2 logs filemanager

# Restart application
pm2 restart filemanager

# Update system packages
sudo yum update -y

# Database backup (run weekly)
sudo -u postgres pg_dump filemanager > /home/ec2-user/backup-$(date +%Y%m%d).sql

# Check disk space
df -h
```

### Update Application
```bash
cd /home/ec2-user/app
git pull origin main
npm install
npm run build
pm2 restart filemanager
```

## Troubleshooting

### Common Issues

**Can't connect to database:**
```bash
sudo systemctl status postgresql
sudo -u postgres psql -l
```

**S3 uploads failing:**
```bash
# Check IAM role is attached to instance
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Verify bucket exists
aws s3 ls s3://your-bucket-name
```

**Application won't start:**
```bash
pm2 logs filemanager
node server/index.js  # Run directly to see errors
```

## Security Notes

This simple setup is great for:
- Development and testing
- Small-scale production use
- Learning AWS basics
- Cost-effective deployment

For larger production deployments, consider the complete version with RDS and load balancing.

## Cost Estimate (Monthly)
- EC2 t3.micro: ~$10/month (free for first year)
- S3 storage: ~$0.50-5/month (depending on usage)
- Data transfer: ~$1-5/month
- **Total**: ~$12-20/month

Your simple but fully functional file management application is now running on AWS!