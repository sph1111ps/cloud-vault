#!/bin/bash
# AWS EC2 Deployment Script

set -e

echo "🚀 Starting AWS EC2 deployment..."

# Configuration
REPO_URL="https://github.com/your-username/your-repo.git"  # Update this
APP_DIR="/opt/file-manager"
SERVICE_NAME="file-manager"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Update system
print_status "Updating system packages..."
sudo yum update -y

# Install Node.js 20 if not installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 20..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    sudo npm install -g pm2
fi

# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    print_status "Creating application directory..."
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
fi

# Navigate to app directory
cd $APP_DIR

# Clone or update repository
if [ -d ".git" ]; then
    print_status "Updating existing repository..."
    git pull origin main
else
    print_status "Cloning repository..."
    git clone $REPO_URL .
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build the application
print_status "Building application..."
npm run build

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual configuration!"
    fi
fi

# Run database migrations if available
if npm run --silent | grep -q "db:migrate"; then
    print_status "Running database migrations..."
    npm run db:migrate
fi

# Create systemd service file
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=File Manager Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=5000
EnvironmentFile=$APP_DIR/.env
ExecStart=$(which node) server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
print_status "Starting application service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

# Wait for service to start
sleep 5

# Check service status
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    print_status "✅ Application service is running!"
else
    print_error "❌ Application service failed to start"
    print_error "Check logs with: sudo journalctl -u $SERVICE_NAME -f"
    exit 1
fi

# Install and configure Nginx if not already installed
if ! command -v nginx &> /dev/null; then
    print_status "Installing and configuring Nginx..."
    sudo amazon-linux-extras install nginx1 -y
    
    # Create Nginx configuration
    sudo tee /etc/nginx/conf.d/$SERVICE_NAME.conf > /dev/null << EOF
server {
    listen 80;
    server_name _;

    # Increase client max body size for file uploads
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts for large file uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
EOF

    # Start and enable Nginx
    sudo systemctl enable nginx
    sudo systemctl restart nginx
    
    print_status "✅ Nginx configured and started!"
fi

# Display status
print_status "🎉 Deployment completed successfully!"
print_status "Application is running on port 5000"
print_status "Nginx is proxying requests from port 80"

# Show service status
print_status "Service status:"
sudo systemctl status $SERVICE_NAME --no-pager -l

# Show useful commands
echo ""
print_status "Useful commands:"
echo "  View logs: sudo journalctl -u $SERVICE_NAME -f"
echo "  Restart app: sudo systemctl restart $SERVICE_NAME"
echo "  Stop app: sudo systemctl stop $SERVICE_NAME"
echo "  Nginx logs: sudo tail -f /var/log/nginx/access.log"
echo "  Check health: curl http://localhost/health"

# Check if .env needs configuration
if [ -f ".env" ]; then
    if grep -q "your-" .env; then
        print_warning "⚠️  Don't forget to update your .env file with actual values!"
        print_warning "Edit: nano $APP_DIR/.env"
    fi
fi

echo ""
print_status "🔥 Your file manager is now deployed and running!"