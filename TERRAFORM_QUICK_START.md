# Terraform Quick Start Guide 🚀

**Status:** ✅ All prerequisites completed! Ready to deploy.

---

## ✅ What's Been Set Up

- ✅ AWS CLI installed and configured (User: CI, Account: 137390111914)
- ✅ Terraform installed (v1.13.3)
- ✅ Terraform initialized successfully
- ✅ All required Terraform files created
- ✅ Package.json fixed for Windows compatibility
- ✅ Cross-env added for environment variables

---

## 🎯 Next Steps to Deploy (15 minutes)

### Step 1: Create Your Terraform Variables File (2 minutes)

You need to create `terraform/terraform.tfvars` with your database password:

```bash
# Copy the example file
cd C:\Users\Sean\cloud-vault\terraform
copy terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars and set your database password
notepad terraform.tfvars
```

**Required content for `terraform/terraform.tfvars`:**
```hcl
# Set a strong database password (minimum 8 characters)
db_password = "YourSecurePassword123!"

# That's it! All other settings use sensible defaults
```

**⚠️ IMPORTANT:** The `terraform.tfvars` file is already in `.gitignore` and will NOT be committed to git. This keeps your password safe.

---

### Step 2: Preview What Will Be Created (2 minutes)

```bash
cd C:\Users\Sean\cloud-vault\terraform
terraform plan
```

This shows you exactly what AWS resources will be created:
- ✅ VPC with 2 public subnets
- ✅ Internet Gateway and routing
- ✅ 3 Security Groups (EC2, RDS, ALB)
- ✅ RDS PostgreSQL database
- ✅ S3 bucket with versioning
- ✅ IAM role and instance profile
- ✅ EC2 t3.micro instance
- ✅ Application Load Balancer
- ✅ SSH key pair

**Estimated Cost:** ~$16/month (mostly the Load Balancer; EC2 & RDS are free tier eligible)

---

### Step 3: Deploy Infrastructure (15-20 minutes)

```bash
cd C:\Users\Sean\cloud-vault\terraform
terraform apply
```

- Type `yes` when prompted
- ☕ Grab a coffee - RDS database takes 10-15 minutes to provision
- Other resources provision in 2-3 minutes

---

### Step 4: Save Your Deployment Info (1 minute)

```bash
cd C:\Users\Sean\cloud-vault\terraform

# Save all outputs to a file
terraform output > ../deployment-info.txt

# Save the SSH private key
terraform output -raw private_key > ../filemanager-key.pem
```

**Important outputs you'll need:**
- `ec2_public_ip` - To SSH into your server
- `db_endpoint` - For DATABASE_URL
- `s3_bucket` - For S3_BUCKET_NAME
- `alb_dns` - Your application URL

---

### Step 5: Install Dependencies (if not done)

```bash
cd C:\Users\Sean\cloud-vault
npm install
```

This installs `cross-env` and other dependencies.

---

## 📋 After Terraform Apply Succeeds

You'll see output like this:

```
Outputs:

alb_dns = "filemanager-alb-123456789.us-east-1.elb.amazonaws.com"
db_endpoint = "filemanager-db.abc123.us-east-1.rds.amazonaws.com"
ec2_public_ip = "54.123.45.67"
s3_bucket = "filemanager-a1b2c3d4"
```

**Save these values!** You'll need them for the next phase.

---

## 🚀 Phase 2: Deploy Your Application

After infrastructure is ready, follow these steps to deploy your app:

### 1. SSH to Your EC2 Instance

**Option A: Using Git Bash (recommended for Windows)**
```bash
cd C:\Users\Sean\cloud-vault
chmod 600 filemanager-key.pem
ssh -i filemanager-key.pem ec2-user@YOUR_EC2_IP
```

**Option B: Using PowerShell**
```powershell
ssh -i filemanager-key.pem ec2-user@YOUR_EC2_IP
```

Replace `YOUR_EC2_IP` with the value from `terraform output ec2_public_ip`.

---

### 2. On EC2: Clone and Setup

```bash
# Wait for user-data script to complete (may take 2-3 minutes after instance starts)
tail -f /var/log/cloud-init-output.log
# Press Ctrl+C when you see "Cloud-init finished"

# Clone your repository (update with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/cloud-vault.git app
cd app

# Install dependencies
npm install

# Build the application
npm run build
```

---

### 3. On EC2: Create Environment File

Create `.env` file with your Terraform outputs:

```bash
# Get values from your local machine: terraform output
cat > .env << 'EOF'
DATABASE_URL=postgresql://filemanager:YOUR_DB_PASSWORD@YOUR_DB_ENDPOINT:5432/filemanager
PGHOST=YOUR_DB_ENDPOINT
PGPORT=5432
PGUSER=filemanager
PGPASSWORD=YOUR_DB_PASSWORD
PGDATABASE=filemanager
AWS_REGION=us-east-1
S3_BUCKET_NAME=YOUR_S3_BUCKET
DEFAULT_OBJECT_STORAGE_BUCKET_ID=YOUR_S3_BUCKET
PUBLIC_OBJECT_SEARCH_PATHS=public/
PRIVATE_OBJECT_DIR=private/
NODE_ENV=production
PORT=5000
EOF

# Generate a secure session secret
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env

# Verify the file
cat .env
```

**Replace these values:**
- `YOUR_DB_PASSWORD` - Same as in terraform.tfvars
- `YOUR_DB_ENDPOINT` - From `terraform output db_endpoint` (remove :5432 port if included)
- `YOUR_S3_BUCKET` - From `terraform output s3_bucket`

---

### 4. On EC2: Initialize Database

```bash
# Run database migrations
npm run db:push

# This creates all necessary tables in your PostgreSQL database
```

---

### 5. On EC2: Start Application with PM2

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the application
pm2 start dist/index.js --name cloud-vault

# Save PM2 process list
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the command it shows (copy/paste the sudo command)

# Check status
pm2 status

# View logs
pm2 logs cloud-vault
```

---

### 6. Verify Application is Running

```bash
# On EC2, test the health endpoint
curl http://localhost:5000/api/auth/me

# You should see: {"user":null}
# This means the API is working!
```

---

### 7. Access Your Application

From your local machine, open a browser:

```
http://YOUR_ALB_DNS
```

Get the ALB DNS with:
```bash
terraform output alb_dns
```

Example: `http://filemanager-alb-123456789.us-east-1.elb.amazonaws.com`

---

## 🎉 Success Checklist

- [ ] Terraform apply completed successfully
- [ ] EC2 instance is running
- [ ] RDS database is available
- [ ] S3 bucket created
- [ ] SSH key saved (filemanager-key.pem)
- [ ] SSH'd into EC2 successfully
- [ ] Application code cloned on EC2
- [ ] npm install and build completed
- [ ] .env file created with correct values
- [ ] Database schema initialized (npm run db:push)
- [ ] Application running in PM2
- [ ] Can access app via ALB DNS in browser

---

## 📊 Useful Commands

### Local Machine (Terraform)

```bash
# View all outputs
terraform output

# View specific output
terraform output ec2_public_ip
terraform output db_endpoint
terraform output s3_bucket
terraform output alb_dns

# View private key (for SSH)
terraform output -raw private_key

# Destroy everything when done
terraform destroy
```

### On EC2 (Application Management)

```bash
# PM2 commands
pm2 status              # View all processes
pm2 logs cloud-vault    # View logs
pm2 restart cloud-vault # Restart app
pm2 stop cloud-vault    # Stop app
pm2 delete cloud-vault  # Remove from PM2

# System monitoring
htop           # CPU and memory usage
df -h          # Disk space
free -m        # Memory usage
journalctl -xe # System logs

# Application logs
pm2 logs cloud-vault --lines 100  # Last 100 lines
pm2 logs cloud-vault --err        # Error logs only
```

---

## 🐛 Troubleshooting

### Can't SSH to EC2

```bash
# Check security group allows SSH
aws ec2 describe-security-groups --group-ids $(terraform output -raw ec2_sg)

# Verify key permissions
chmod 600 filemanager-key.pem

# Try verbose SSH
ssh -v -i filemanager-key.pem ec2-user@YOUR_EC2_IP
```

### Database Connection Failed

```bash
# On EC2, test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check RDS security group allows EC2
# Check db_endpoint and password in .env are correct
```

### Application Won't Start

```bash
# On EC2, check logs
pm2 logs cloud-vault

# Common issues:
# - DATABASE_URL not set correctly
# - S3_BUCKET_NAME not set
# - Build failed - run: npm run build
# - Port 5000 in use - run: lsof -i :5000
```

### ALB Health Checks Failing

```bash
# On EC2, verify app responds
curl http://localhost:5000/api/auth/me

# Check PM2 status
pm2 status

# View ALB target health
aws elbv2 describe-target-health --target-group-arn $(terraform output -raw target_group_arn)
```

---

## 🔒 Security Notes

**After successful deployment, consider:**

1. **Restrict SSH access** - Update EC2 security group to only allow your IP
2. **Remove direct EC2 access** - Force all traffic through ALB
3. **Enable HTTPS** - Add SSL certificate via AWS Certificate Manager
4. **Regular updates** - Keep system and app dependencies updated
5. **Enable CloudWatch** - Set up monitoring and alarms
6. **Database backups** - RDS automated backups are enabled (7 day retention)

---

## 💰 Cost Management

**Monthly Costs (US-East-1):**
- EC2 t3.micro: **$0** (Free tier: 750 hours/month for 12 months)
- RDS db.t3.micro: **$0** (Free tier: 750 hours/month for 12 months)
- S3 Storage: **~$0.50** (assuming 20GB)
- Application Load Balancer: **~$16** (not free tier eligible)
- Data Transfer: **$0** (first 100GB/month free)

**Total: ~$16.50/month** (or ~$39/month after free tier expires)

**Cost Saving Tips:**
- Remove ALB and access EC2 directly (saves $16/month, but no high availability)
- Use smaller instance types during development
- Enable S3 Intelligent Tiering
- Set up billing alerts

---

## 📞 Need Help?

Check these resources:
- **DEPLOYMENT_GAMEPLAN.md** - Comprehensive deployment guide
- **AWS_COMPLETE_CLI_GUIDE.md** - Manual CLI commands
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)

---

## ✅ Ready to Deploy?

**You're all set!** Just run:

```bash
cd C:\Users\Sean\cloud-vault\terraform
terraform apply
```

Good luck! 🚀




