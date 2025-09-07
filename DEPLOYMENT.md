# SampleShield Pro - Deployment Guide

This guide covers the complete deployment process for SampleShield Pro, from development setup to production deployment.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **MongoDB**: 5.0 or higher
- **Redis**: 6.0 or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended for production)
- **Storage**: Minimum 10GB free space

### Development Tools
- Git
- Code editor (VS Code recommended)
- MongoDB Compass (optional, for database management)
- Redis CLI (optional, for queue management)

## 🚀 Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/vistara-apps/-app-development-2499.git
cd -app-development-2499

# Install all dependencies (frontend + backend)
npm run install:all
```

### 2. Environment Configuration

Create environment files:

```bash
# Copy example environment file
cp server/.env.example server/.env
```

Edit `server/.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/sampleshield-pro

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-development-jwt-secret-key
JWT_EXPIRES_IN=7d

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 3. Database Setup

Start MongoDB and Redis services:

```bash
# MongoDB (if using local installation)
mongod --dbpath /path/to/your/db

# Redis (if using local installation)
redis-server

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:5.0
docker run -d -p 6379:6379 --name redis redis:6.0-alpine
```

### 4. Start Development Servers

```bash
# Start both frontend and backend concurrently
npm run dev:full

# Or start individually
npm run dev          # Frontend only (port 5173)
npm run server:dev   # Backend only (port 5000)
```

### 5. Verify Installation

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/health
- API Documentation: http://localhost:5000/api

## 🏭 Production Deployment

### Option 1: Traditional Server Deployment

#### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Redis
sudo apt install redis-server

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/vistara-apps/-app-development-2499.git
cd -app-development-2499

# Install dependencies
npm run install:all

# Build frontend
npm run build

# Create production environment file
cp server/.env.example server/.env
# Edit server/.env with production values
```

#### 3. Production Environment Configuration

```env
NODE_ENV=production
PORT=5000

# Production Database
MONGODB_URI=mongodb://localhost:27017/sampleshield-pro-prod

# Redis
REDIS_URL=redis://localhost:6379

# Strong JWT Secret
JWT_SECRET=your-super-strong-production-jwt-secret-key-here

# File Storage
UPLOAD_DIR=/var/www/sampleshield-pro/uploads
MAX_FILE_SIZE=104857600

# Logging
LOG_LEVEL=warn
LOG_DIR=/var/log/sampleshield-pro

# Rate Limiting (stricter in production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
```

#### 4. Start with PM2

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'sampleshield-pro',
    script: './server/server.js',
    cwd: '/path/to/your/app',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/sampleshield-pro/err.log',
    out_file: '/var/log/sampleshield-pro/out.log',
    log_file: '/var/log/sampleshield-pro/combined.log',
    time: true
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 5. Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Serve static files
    location / {
        root /path/to/your/app/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File upload size limit
    client_max_body_size 100M;
}
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sampleshield -u 1001

# Copy built application
COPY --from=builder --chown=sampleshield:nodejs /app/dist ./dist
COPY --from=builder --chown=sampleshield:nodejs /app/server ./server
COPY --from=builder --chown=sampleshield:nodejs /app/node_modules ./node_modules

# Create directories
RUN mkdir -p /app/uploads /app/logs && chown -R sampleshield:nodejs /app

USER sampleshield

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]
```

#### 2. Docker Compose Configuration

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/sampleshield-pro
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongodb
      - redis
    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
    restart: unless-stopped

  mongodb:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:6.0-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:
  uploads:
  logs:
```

#### 3. Deploy with Docker

```bash
# Create environment file
echo "JWT_SECRET=your-production-jwt-secret" > .env

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Option 3: Cloud Platform Deployment

#### Heroku Deployment

```bash
# Install Heroku CLI
# Create Heroku app
heroku create sampleshield-pro

# Add MongoDB Atlas addon
heroku addons:create mongolab:sandbox

# Add Redis addon
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-production-jwt-secret

# Deploy
git push heroku main
```

#### AWS/DigitalOcean/GCP

Similar process using their respective container services or VM instances.

## 🔧 Post-Deployment Configuration

### 1. Database Initialization

```bash
# Connect to MongoDB and create indexes
mongo sampleshield-pro-prod

# Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true })
db.datasetjobs.createIndex({ "userId": 1, "createdAt": -1 })
db.datasetjobs.createIndex({ "status": 1 })
```

### 2. SSL Certificate Setup

```bash
# Using Let's Encrypt with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Monitoring Setup

```bash
# Install monitoring tools
npm install -g pm2-logrotate
pm2 install pm2-server-monit

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 4. Backup Configuration

```bash
# MongoDB backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db sampleshield-pro-prod --out /backups/mongodb_$DATE
tar -czf /backups/mongodb_$DATE.tar.gz /backups/mongodb_$DATE
rm -rf /backups/mongodb_$DATE

# Add to crontab for daily backups
0 2 * * * /path/to/backup-script.sh
```

## 🔍 Health Checks and Monitoring

### Application Health Check

```bash
# Check application status
curl http://localhost:5000/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0"
}
```

### Performance Monitoring

```bash
# PM2 monitoring
pm2 monit

# System monitoring
htop
iostat -x 1
```

### Log Monitoring

```bash
# Application logs
tail -f /var/log/sampleshield-pro/combined.log

# PM2 logs
pm2 logs sampleshield-pro

# System logs
journalctl -u nginx -f
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   sudo lsof -i :5000
   sudo kill -9 <PID>
   ```

2. **MongoDB Connection Issues**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Restart MongoDB
   sudo systemctl restart mongod
   ```

3. **Redis Connection Issues**
   ```bash
   # Check Redis status
   sudo systemctl status redis
   
   # Test Redis connection
   redis-cli ping
   ```

4. **File Upload Issues**
   ```bash
   # Check upload directory permissions
   ls -la /path/to/uploads
   
   # Fix permissions
   sudo chown -R sampleshield:sampleshield /path/to/uploads
   sudo chmod -R 755 /path/to/uploads
   ```

### Performance Optimization

1. **Enable Gzip Compression**
   - Already enabled in Express middleware
   - Configure Nginx compression for static files

2. **Database Optimization**
   - Create appropriate indexes
   - Monitor slow queries
   - Use connection pooling

3. **Caching Strategy**
   - Redis for session storage
   - CDN for static assets
   - API response caching

4. **Load Balancing**
   - Use PM2 cluster mode
   - Configure Nginx load balancing
   - Consider horizontal scaling

## 📊 Maintenance

### Regular Tasks

1. **Daily**
   - Check application logs
   - Monitor system resources
   - Verify backup completion

2. **Weekly**
   - Update dependencies (security patches)
   - Review performance metrics
   - Clean up old log files

3. **Monthly**
   - Full system backup
   - Security audit
   - Performance optimization review

### Update Process

```bash
# 1. Backup current version
cp -r /path/to/app /path/to/app-backup

# 2. Pull latest changes
git pull origin main

# 3. Install dependencies
npm run install:all

# 4. Build frontend
npm run build

# 5. Restart application
pm2 restart sampleshield-pro

# 6. Verify deployment
curl http://localhost:5000/health
```

## 🔐 Security Checklist

- [ ] Strong JWT secret in production
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Database access restricted to application only
- [ ] Regular security updates applied
- [ ] File upload restrictions properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Backup encryption enabled
- [ ] Access logs monitored
- [ ] Firewall properly configured

---

For additional support or questions about deployment, please refer to the main README.md or create an issue in the repository.
