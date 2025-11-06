# Migration to US-East-2

## What Will Happen

This migration will:
1. Destroy ALL resources in us-east-1 (EC2, RDS, S3, ALB, VPC)
2. Recreate everything in us-east-2
3. You'll need to re-deploy your application code

## Steps

### 1. Destroy Resources in US-East-1

```powershell
cd C:\Users\Sean\cloud-vault\terraform

# Set region to us-east-1 to destroy old resources
$env:AWS_DEFAULT_REGION="us-east-1"

# Destroy everything
terraform destroy
```

Type `yes` when prompted. This will delete:
- EC2 instance (your app will go offline)
- RDS database (all data will be lost)
- S3 bucket
- ALB, VPC, security groups

### 2. Create Resources in US-East-2

The terraform files have been updated to use `us-east-2`.

```powershell
# Remove the .terraform directory to force provider reinitialization
Remove-Item -Recurse -Force .terraform

# Reinitialize with us-east-2
terraform init

# Create everything in us-east-2
terraform apply
```

Type `yes` when prompted. This takes 15-20 minutes.

### 3. Save New Deployment Info

```powershell
# Get new outputs
terraform output > ../deployment-info-east2.txt
terraform output -raw private_key > ../filemanager-key-east2.pem
```

### 4. Deploy Application

Follow the same steps as before:
1. SSH to new EC2 instance
2. Copy application code
3. Install dependencies
4. Create .env file
5. Build app
6. Start with PM2

## ⚠️ WARNING

- **All data in RDS will be lost** (no users, no files metadata)
- **Your application will be offline** during migration
- **Takes 30-45 minutes total**

## Alternative: Keep US-East-1

If you want to avoid data loss, we can:
1. Keep resources in us-east-1
2. Just change your AWS CLI default region to us-east-1
3. Fix the password issue

Which do you prefer?



