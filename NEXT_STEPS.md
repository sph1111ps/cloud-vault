# 🎉 Infrastructure Deployed Successfully!

**Deployment Date:** November 3, 2025  
**Status:** ✅ AWS Infrastructure Ready - Time to Deploy Application

---

## ✅ What's Been Deployed

Your AWS infrastructure is live and running:

- ✅ **VPC** with DNS enabled
- ✅ **EC2 Instance** (t3.micro) running Amazon Linux 2
- ✅ **RDS PostgreSQL** database (db.t3.micro)
- ✅ **S3 Bucket** with versioning and CORS
- ✅ **Application Load Balancer** ready to serve traffic
- ✅ **Security Groups** configured
- ✅ **IAM Roles** for EC2 to access S3 and RDS
- ✅ **SSH Key Pair** generated and saved

---

## 📋 Your Deployment Info

```
EC2 Public IP:  44.200.36.39
ALB DNS:        filemanager-alb-1952048164.us-east-1.elb.amazonaws.com
DB Endpoint:    filemanager-db.cy7skik2ofld.us-east-1.rds.amazonaws.com
S3 Bucket:      filemanager-02ed7151
SSH Key:        filemanager-key.pem (saved in project root)
```

---

## 🚀 Next Step: Deploy Your Application (20 minutes)

Now you need to deploy the Cloud Vault application to your EC2 instance.

### Phase 1: SSH to Your EC2 Instance

**Using Git Bash (Recommended for Windows):**

```bash
cd C:\Users\Sean\cloud-vault

# Set correct permissions on the key
chmod 600 filemanager-key.pem

# SSH to your EC2 instance
ssh -i filemanager-key.pem ec2-user@44.200.36.39
```

**Using PowerShell:**

```powershell
cd C:\Users\Sean\cloud-vault
ssh -i filemanager-key.pem ec2-user@44.200.36.39
```

**Troubleshooting SSH:**
- If you get "permission denied", make sure the key has correct permissions
- If "connection refused", wait 2-3 minutes for EC2 to fully start
- Try: `ssh -v -i filemanager-key.pem ec2-user@44.200.36.39` for verbose output

---

### Phase 2: Wait for User Data Script (2-3 minutes)

Once connected, wait for the initial setup to complete:

```bash
# Check if user-data script is still running
tail -f /var/log/cloud-init-output.log

# Press Ctrl+C when you see "Cloud-init v. X.X.X finished"
```

This script is installing:
- Git
- PostgreSQL client
- Node.js 18
- PM2 process manager
- Creating `/home/ec2-user/app` directory

---

### Phase 3: Clone Your Repository

**⚠️ IMPORTANT:** You need to update your GitHub repository URL first!

Before cloning, make sure you've:
1. Pushed your code to GitHub
2. Know your repository URL

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/cloud-vault.git app
cd app

# Verify you're in the right place
ls -la
```

**Don't have a GitHub repo yet?**

Option A: Create a new repo on GitHub and push your code:
```bash
# On your local Windows machine
cd C:\Users\Sean\cloud-vault
git remote add origin https://github.com/YOUR_USERNAME/cloud-vault.git
git push -u origin main
```

Option B: Use SCP to copy files directly:
```bash
# From your Windows machine (Git Bash)
scp -i filemanager-key.pem -r C:/Users/Sean/cloud-vault ec2-user@44.200.36.39:~/app
```

---

### Phase 4: Install Dependencies & Build

```bash
cd /home/ec2-user/app

# Install dependencies
npm install

# Build the application
npm run build

# This creates the dist/ folder with compiled code
```

---

### Phase 5: Create Environment File

Create `.env` file with your deployment values:

```bash
cd /home/ec2-user/app

cat > .env << 'EOF'
DATABASE_URL=postgresql://filemanager:YOUR_DB_PASSWORD@filemanager-db.cy7skik2ofld.us-east-1.rds.amazonaws.com:5432/filemanager
PGHOST=filemanager-db.cy7skik2ofld.us-east-1.rds.amazonaws.com
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YOUR_DB_PASSWORD
PGDATABASE=filemanager
AWS_REGION=us-east-1
S3_BUCKET_NAME=filemanager-02ed7151
DEFAULT_OBJECT_STORAGE_BUCKET_ID=filemanager-02ed7151
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/
NODE_ENV=production
PORT=5000
EOF

# Generate a secure session secret and add it
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env

# Verify the file
cat .env
```

**⚠️ Replace `YOUR_DB_PASSWORD`** with the password you set in `terraform/terraform.tfvars`

---

### Phase 6: Initialize Database Schema

```bash
cd /home/ec2-user/app

# Run database migrations to create tables
npm run db:push

# You should see: "Everything is up to date ✅" or similar
```

**Troubleshooting:**
- If connection fails, verify DATABASE_URL in `.env`
- Check RDS endpoint is correct
- Make sure password matches terraform.tfvars

---

### Phase 7: Start Application with PM2

```bash
cd /home/ec2-user/app

# Start the application
pm2 start dist/index.js --name cloud-vault

# Save the PM2 process list
pm2 save

# Enable PM2 to start on system boot
pm2 startup
# Copy and run the command it shows (starts with sudo)

# Check status
pm2 status

# View logs (press Ctrl+C to exit)
pm2 logs cloud-vault
```

**Expected output:**
```
┌─────┬──────────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ mode    │ ↺       │ status  │ cpu      │
├─────┼──────────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ cloud-vault  │ fork    │ 0       │ online  │ 0%       │
└─────┴──────────────┴─────────┴─────────┴─────────┴──────────┘
```

---

### Phase 8: Test the Application

```bash
# Test the health endpoint
curl http://localhost:5000/api/auth/me

# Expected response: {"user":null}
# This means the API is working!

# Test if app is listening on port 5000
curl http://localhost:5000

# You should see HTML response
```

---

### Phase 9: Access Your Application 🎉

Open your browser and go to:

```
http://filemanager-alb-1952048164.us-east-1.elb.amazonaws.com
```

**Or test the direct EC2 connection:**
```
http://44.200.36.39:5000
```

---

## ✅ Deployment Success Checklist

- [ ] SSH'd into EC2 successfully
- [ ] Waited for cloud-init to finish
- [ ] Cloned/copied application code to EC2
- [ ] Ran `npm install` successfully
- [ ] Ran `npm run build` successfully
- [ ] Created `.env` file with correct values
- [ ] Ran `npm run db:push` to initialize database
- [ ] Started application with PM2
- [ ] PM2 shows status "online"
- [ ] `curl http://localhost:5000/api/auth/me` returns JSON
- [ ] Can access application via ALB DNS in browser

---

## 📊 Useful Commands (Keep This Handy)

### On EC2 Instance

```bash
# PM2 Management
pm2 status                  # View all processes
pm2 logs cloud-vault        # View application logs
pm2 restart cloud-vault     # Restart application
pm2 stop cloud-vault        # Stop application
pm2 delete cloud-vault      # Remove from PM2

# System Monitoring
htop                        # CPU and memory (press q to quit)
df -h                       # Disk space
free -m                     # Memory usage
netstat -tulpn | grep 5000  # Check if port 5000 is listening

# Application
cd /home/ec2-user/app       # Go to app directory
pm2 logs cloud-vault --lines 100  # Last 100 log lines
pm2 logs cloud-vault --err  # Error logs only
nano .env                   # Edit environment file

# Database
psql $DATABASE_URL -c "SELECT version();"  # Test DB connection
npm run db:push             # Re-run migrations
```

### From Your Local Machine

```bash
# Terraform
cd C:\Users\Sean\cloud-vault\terraform
terraform output            # View all outputs
terraform output ec2_public_ip  # Get EC2 IP

# SSH
ssh -i filemanager-key.pem ec2-user@44.200.36.39

# Copy files to EC2
scp -i filemanager-key.pem local-file.txt ec2-user@44.200.36.39:~/

# Check ALB status
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:137390111914:targetgroup/filemanager-tg/a5b7209e898a5988
```

---

## 🐛 Common Issues & Solutions

### "Connection refused" when SSH'ing

**Solution:** EC2 is still starting. Wait 2-3 minutes and try again.

```bash
# Check instance status
aws ec2 describe-instance-status --instance-ids i-0d7b78a1372787093
```

### npm install fails

**Solution:** Make sure Node.js is installed:

```bash
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher

# If not installed, run:
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### npm run build fails

**Solution:** Check for errors in the output. Common issues:
- Missing dependencies: Run `npm install` again
- TypeScript errors: Check the error messages
- Out of memory: Use larger instance type

### Database connection fails

**Solution:**

```bash
# Verify environment variables
cat .env | grep DATABASE_URL

# Test connection manually
psql postgresql://filemanager:PASSWORD@filemanager-db.cy7skik2ofld.us-east-1.rds.amazonaws.com:5432/filemanager -c "SELECT 1"

# Check RDS security group allows EC2
aws ec2 describe-security-groups --group-ids sg-00785aa27517608d9
```

### PM2 shows "errored" status

**Solution:**

```bash
# View error logs
pm2 logs cloud-vault --err

# Common issues:
# - DATABASE_URL not set: Check .env file
# - Port 5000 in use: lsof -i :5000
# - Missing environment variables: Verify .env

# After fixing, restart:
pm2 restart cloud-vault
```

### Can't access ALB in browser

**Solution:**

```bash
# On EC2, verify app is running
curl http://localhost:5000

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:137390111914:targetgroup/filemanager-tg/a5b7209e898a5988

# Wait 2-3 minutes for health checks to pass
```

---

## 🔒 Security Recommendations

After successful deployment:

1. **Restrict SSH Access**
   ```bash
   # Update EC2 security group to only allow your IP
   aws ec2 authorize-security-group-ingress \
     --group-id sg-01262d16b0c66fbbd \
     --protocol tcp --port 22 \
     --cidr YOUR_IP/32
   ```

2. **Remove Direct EC2 Access**
   ```bash
   # Force all traffic through ALB
   aws ec2 revoke-security-group-ingress \
     --group-id sg-01262d16b0c66fbbd \
     --protocol tcp --port 5000 \
     --cidr 0.0.0.0/0
   ```

3. **Enable HTTPS** (recommended for production)
   - Request SSL certificate in AWS Certificate Manager
   - Add HTTPS listener to ALB

4. **Regular Updates**
   ```bash
   # On EC2
   sudo yum update -y
   ```

---

## 💰 Current Monthly Cost

- **EC2 t3.micro:** $0 (Free tier - 750 hours/month)
- **RDS db.t3.micro:** $0 (Free tier - 750 hours/month)
- **S3 Storage:** ~$0.50 (assuming 20GB)
- **ALB:** ~$16/month
- **Data Transfer:** $0 (first 100GB free)

**Total: ~$16.50/month** during free tier  
**After free tier: ~$39/month**

---

## 🎉 You're Almost Done!

Just follow the steps above to deploy your application to EC2. The whole process should take about 20 minutes.

**Quick command reference:**
1. `ssh -i filemanager-key.pem ec2-user@44.200.36.39`
2. `git clone <your-repo> app && cd app`
3. `npm install && npm run build`
4. Create `.env` file
5. `npm run db:push`
6. `pm2 start dist/index.js --name cloud-vault`
7. Access: `http://filemanager-alb-1952048164.us-east-1.elb.amazonaws.com`

Good luck! 🚀




