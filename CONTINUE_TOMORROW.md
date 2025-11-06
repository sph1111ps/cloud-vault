# Continue Deployment - Quick Reference

**Date:** November 3, 2025  
**Status:** Ready for final deployment steps

---

## ✅ What's Been Completed

- ✅ AWS infrastructure deployed (VPC, EC2, RDS, S3, ALB)
- ✅ EC2 instance upgraded to Amazon Linux 2023
- ✅ Node.js 20 installed on EC2
- ✅ Application code copied to EC2
- ✅ Dependencies installed (`npm install`)
- ✅ Application built (`npm run build`)

---

## 📋 Your Deployment Info

```
EC2 Public IP:  (Get with: terraform output ec2_public_ip)
ALB DNS:        filemanager-alb-1952048164.us-east-1.elb.amazonaws.com
DB Endpoint:    filemanager-db.cy7skik2ofld.us-east-1.rds.amazonaws.com
S3 Bucket:      filemanager-02ed7151
```

---

## 🚀 Tomorrow: Final Steps (10 minutes)

### Step 1: SSH to EC2

**In WSL:**
```bash
# Get the current EC2 IP
cd /mnt/c/Users/Sean/cloud-vault/terraform
# Then in PowerShell: terraform output ec2_public_ip

# SSH (use the IP from above)
ssh -i ~/filemanager-key.pem ec2-user@YOUR_EC2_IP
```

---

### Step 2: Load Node.js (if needed)

```bash
# Load nvm (in case it's a new session)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verify Node.js
node --version  # Should show v20.19.5
```

---

### Step 3: Create Environment File

```bash
cd ~/app

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

# Add session secret
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env

# Edit and replace YOUR_DB_PASSWORD with your actual password
nano .env
# Replace YOUR_DB_PASSWORD (appears twice)
# Ctrl+X, Y, Enter to save
```

---

### Step 4: Initialize Database

```bash
npm run db:push
```

You should see: "Everything is up to date ✅" or similar

---

### Step 5: Start Application

```bash
# Start with PM2
pm2 start dist/index.js --name cloud-vault

# Save PM2 process list
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Copy and run the command it shows (starts with sudo)

# Check status
pm2 status

# View logs
pm2 logs cloud-vault
```

Expected output:
```
┌─────┬──────────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ mode    │ ↺       │ status  │ cpu      │
├─────┼──────────────┼─────────┼─────────┼─────────┼──────────┤
│ 0   │ cloud-vault  │ fork    │ 0       │ online  │ 0%       │
└─────┴──────────────┴─────────┴─────────┴─────────┴──────────┘
```

---

### Step 6: Test Application

**On EC2:**
```bash
curl http://localhost:5000/api/auth/me
# Should return: {"user":null}
```

**In your browser:**
```
http://filemanager-alb-1952048164.us-east-1.elb.amazonaws.com
```

---

## 🐛 Quick Troubleshooting

### PM2 shows "errored"
```bash
pm2 logs cloud-vault --err
# Check the error message
# Common: DATABASE_URL incorrect, missing env vars
```

### Database connection fails
```bash
# Verify .env file
cat .env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Can't access in browser
```bash
# Verify app is running
pm2 status

# Test locally first
curl http://localhost:5000

# Wait 2-3 minutes for ALB health checks to pass
```

---

## 📊 Useful Commands

```bash
# PM2 Management
pm2 status                  # View status
pm2 logs cloud-vault        # View logs
pm2 restart cloud-vault     # Restart app
pm2 stop cloud-vault        # Stop app

# System
htop                        # CPU/memory
df -h                       # Disk space
free -m                     # Memory

# Application
cd ~/app                    # App directory
nano .env                   # Edit environment
pm2 logs cloud-vault --lines 50  # Last 50 log lines
```

---

## 💰 Current Cost

- **EC2 t3.micro:** $0 (Free tier)
- **RDS db.t3.micro:** $0 (Free tier)
- **S3 Storage:** ~$0.50/month
- **ALB:** ~$16/month
- **Total: ~$16.50/month**

---

## 🎯 Expected Time Tomorrow

- **Step 3-6:** ~10 minutes
- **Testing:** ~5 minutes
- **Total:** ~15 minutes

---

## 📞 If You Need Help

Check these files:
- **NEXT_STEPS.md** - Detailed deployment guide
- **DEPLOYMENT_GAMEPLAN.md** - Complete strategy
- **TERRAFORM_QUICK_START.md** - Infrastructure reference

---

## 🔒 Remember

Your database password is in:
- `C:\Users\Sean\cloud-vault\terraform\terraform.tfvars`

You'll need it to replace `YOUR_DB_PASSWORD` in the `.env` file.

---

## ✅ Tomorrow's Checklist

- [ ] SSH to EC2
- [ ] Create `.env` file with correct DB password
- [ ] Run `npm run db:push`
- [ ] Start with PM2
- [ ] Test locally with curl
- [ ] Access via ALB in browser
- [ ] Celebrate! 🎉

---

**See you tomorrow! You're almost there!** 🚀




