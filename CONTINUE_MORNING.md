# ☀️ Continue Deployment - Morning Session

## ✅ What We Accomplished Tonight

### Infrastructure Migration Complete
- ✅ Destroyed all resources in **us-east-1**
- ✅ Deployed fresh infrastructure in **us-east-2**
- ✅ All AWS resources are now in the correct region

### Current Deployment Info (us-east-2)
```
EC2 IP:       18.116.87.179
Instance ID:  i-0ff1683d2b4f7d143
ALB URL:      filemanager-alb-141865427.us-east-2.elb.amazonaws.com
DB Endpoint:  filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com:5432
S3 Bucket:    filemanager-b3e86327
Region:       us-east-2
```

### What's Working
- ✅ EC2 instance running with Node.js 20
- ✅ RDS PostgreSQL database ready
- ✅ S3 bucket configured
- ✅ ALB load balancer ready
- ✅ SSM Session Manager working for EC2 access

### What's Left to Do
1. Deploy application code to EC2
2. Configure environment variables
3. Install dependencies and build
4. Set up database schema
5. Create admin user
6. Start application with PM2
7. Test the application

---

## 🚀 Next Steps - Morning

### Step 1: Connect to EC2

**Option A: SSM (Recommended - no SSH key issues)**
```powershell
aws ssm start-session --target i-0ff1683d2b4f7d143 --region us-east-2
```

**Option B: SSH (if SSM doesn't work)**
```bash
ssh -i ~/filemanager-key-east2.pem ec2-user@18.116.87.179
```

### Step 2: Deploy Application Code

**From Local WSL:**
```bash
cd /mnt/c/Users/Sean/cloud-vault

# Create tarball (excludes unnecessary files)
tar -czf app.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='*.pem' \
  --exclude='*.txt' \
  --exclude='terraform' \
  .

# If SSH key works:
scp -i ~/filemanager-key-east2.pem app.tar.gz ec2-user@18.116.87.179:~/

# Alternative if SCP fails - upload to S3:
aws s3 cp app.tar.gz s3://filemanager-b3e86327/app.tar.gz --region us-east-2
```

### Step 3: Extract and Configure on EC2

**On EC2 (via SSM or SSH):**
```bash
# Load Node.js environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

# If you uploaded to S3:
# aws s3 cp s3://filemanager-b3e86327/app.tar.gz ~/app.tar.gz --region us-east-2

# Extract application
cd /home/ec2-user/app
tar -xzf ~/app.tar.gz
rm ~/app.tar.gz
```

### Step 4: Create Environment File

```bash
cd /home/ec2-user/app

cat > .env << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://filemanager:Sean123%21@filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com:5432/filemanager?sslmode=require
PGPASSWORD=Sean123!
AWS_REGION=us-east-2
S3_BUCKET=filemanager-b3e86327
PORT=5000
EOF
```

### Step 5: Install and Build

```bash
npm install
npm run build
```

### Step 6: Initialize Database

```bash
# Test database connection
PGPASSWORD='Sean123!' psql -h filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com -U filemanager -d filemanager -c "SELECT version();"

# Push database schema
npx drizzle-kit push
```

### Step 7: Create Admin User

```bash
cat > create-admin.mjs << 'EOF'
import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const username = 'admin';
const password = 'Admin123!';
const hashedPassword = await bcrypt.hash(password, 10);

try {
  const result = await pool.query(
    `INSERT INTO users (username, password, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username`,
    [username, hashedPassword]
  );

  if (result.rows.length > 0) {
    console.log('✅ Admin user created!');
  } else {
    console.log('ℹ️ Admin user already exists');
  }
  console.log('Username:', username);
  console.log('Password:', password);
} catch (err) {
  console.error('Error:', err.message);
}

await pool.end();
EOF

node create-admin.mjs
rm create-admin.mjs
```

### Step 8: Start Application with PM2

```bash
# Make sure ecosystem config exists
cat > ecosystem.config.cjs << 'EOF'
const fs = require('fs');
const path = require('path');

// Read .env file
const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const envVars = {};

envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...values] = trimmed.split('=');
    if (key && values.length > 0) {
      envVars[key.trim()] = values.join('=').trim();
    }
  }
});

module.exports = {
  apps: [{
    name: 'cloud-vault',
    script: './dist/index.js',
    cwd: '/home/ec2-user/app',
    instances: 1,
    autorestart: true,
    env: envVars
  }]
};
EOF

# Start the app
pm2 start ecosystem.config.cjs

# Check logs
pm2 logs cloud-vault --lines 20

# Save PM2 configuration to restart on reboot
pm2 save
pm2 startup
```

### Step 9: Test the Application

```bash
# Test locally on EC2
curl http://localhost:5000/api/auth/me

# Should return: {"error":"Authentication required"}
```

**From your local browser:**
```
http://filemanager-alb-141865427.us-east-2.elb.amazonaws.com
```

**Login with:**
- Username: `admin`
- Password: `Admin123!`

---

## 🔧 Troubleshooting Reference

### If Database Connection Fails
```bash
# Check .env file
cat .env | grep DATABASE_URL

# Test connection manually
PGPASSWORD='Sean123!' psql -h filemanager-db.cxuwqigwsx22.us-east-2.rds.amazonaws.com -U filemanager -d filemanager -c "SELECT version();"
```

### If PM2 Shows "DATABASE_URL must be set"
```bash
# Stop PM2
pm2 delete cloud-vault

# Verify ecosystem.config.cjs reads .env correctly
node -e "const config = require('./ecosystem.config.cjs'); console.log(config.apps[0].env);"

# Restart
pm2 start ecosystem.config.cjs
pm2 logs cloud-vault
```

### If ALB Returns 504 Gateway Timeout
```bash
# Check app is running
pm2 status

# Check app responds locally
curl http://localhost:5000/api/auth/me

# Check security group allows ALB -> EC2
aws ec2 describe-security-groups --group-ids sg-05b429beab5531dbe --region us-east-2
```

### If You Need to Rebuild
```bash
cd /home/ec2-user/app
pm2 delete cloud-vault
npm run build
pm2 start ecosystem.config.cjs
```

---

## 📝 Key Files Reference

### On EC2 Instance
- `/home/ec2-user/app/` - Application directory
- `/home/ec2-user/app/.env` - Environment variables
- `/home/ec2-user/app/ecosystem.config.cjs` - PM2 configuration
- `/home/ec2-user/app/dist/index.js` - Built application

### Local Files
- `terraform/terraform.tfvars` - Database password
- `terraform/` - Infrastructure as code
- `deployment-info-east2.txt` - Deployment outputs
- `filemanager-key-east2.pem` - SSH private key (if fixed)

---

## 🎯 Success Criteria

You'll know it's working when:
1. ✅ PM2 shows `cloud-vault` status: `online`
2. ✅ PM2 logs show `[express] serving on port 5000`
3. ✅ No database connection errors in logs
4. ✅ `curl http://localhost:5000/api/auth/me` returns JSON
5. ✅ ALB URL loads the login page
6. ✅ You can login with admin/Admin123!
7. ✅ File upload/download works

---

## 📊 Current Status

### Infrastructure: ✅ COMPLETE
- All resources in us-east-2
- EC2 running and accessible
- RDS database ready
- S3 bucket configured
- ALB ready

### Application: ⏳ READY TO DEPLOY
- Code ready locally
- Need to: upload → install → configure → start

**Estimated time to completion: 15-30 minutes** ⏱️

---

Good night! 😴 See you in the morning! 🌅



