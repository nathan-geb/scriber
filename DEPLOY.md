# Scriber VPS Deployment Guide

## Prerequisites

- VPS with Ubuntu 22.04+ (102.211.186.118)
- Domain pointing to VPS: scriber.bernos.systems
- SSH access to VPS

## 1. Initial Server Setup

```bash
# SSH into your VPS
ssh root@102.211.186.118

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Install Nginx
apt install nginx -y

# Install Certbot for SSL
apt install certbot python3-certbot-nginx -y
```

## 2. Clone Repository

```bash
# Create app directory
mkdir -p /var/www/scriber
cd /var/www/scriber

# Clone your repository (or upload files)
git clone <your-repo-url> .

# Or upload via SCP:
# scp -r /path/to/Scriber/* root@102.211.186.118:/var/www/scriber/
```

## 3. Configure Environment

```bash
# Copy and edit production environment file
cp .env.prod.example .env.prod

# Edit with your production values
nano .env.prod
```

Required values:

- `DB_PASSWORD`: Strong database password
- `JWT_SECRET`: Min 32 char random string
- `GEMINI_API_KEY`: Your Gemini API key
- `STRIPE_SECRET_KEY`: (Optional) For payments

## 4. Setup Nginx

```bash
# Copy nginx config
cp nginx.conf /etc/nginx/sites-available/scriber

# Enable site
ln -s /etc/nginx/sites-available/scriber /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Reload nginx
systemctl reload nginx
```

## 5. Get SSL Certificate

```bash
# Get certificate (nginx must be running on port 80)
certbot --nginx -d scriber.bernos.systems

# Test auto-renewal
certbot renew --dry-run
```

## 6. Deploy Application

```bash
cd /var/www/scriber

# Load environment variables
export $(grep -v '^#' .env.prod | xargs)

# Build and start containers
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Run database migrations (first time only)
docker exec scriber_api npx prisma migrate deploy
docker exec scriber_api npx prisma db seed
```

## 7. Verify Deployment

- Visit <https://scriber.bernos.systems>
- Check API health: <https://scriber.bernos.systems/api/health>
- Login with admin credentials

## Management Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop all
docker compose -f docker-compose.prod.yml down

# Update deployment
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Troubleshooting

### Database connection issues

```bash
docker exec -it scriber_db psql -U scriber -d scriber
```

### Check container status

```bash
docker compose -f docker-compose.prod.yml ps
```

### View specific service logs

```bash
docker logs scriber_api --tail 100
docker logs scriber_web --tail 100
```
