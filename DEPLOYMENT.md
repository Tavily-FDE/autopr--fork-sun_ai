# 🚀 DEPLOYMENT GUIDE - Perplexity Ultra

## Quick Start (5 Minutes)

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# Server runs on http://localhost:3000
# API on http://localhost:3000/api
```

### Use the API
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is artificial intelligence?",
    "conversationId": "test-123",
    "mode": "default"
  }'
```

---

## Cloudflare Pages (Frontend Only)

Cloudflare Pages should deploy only the React app inside `frontend/`.
Do not deploy the Express API with Pages and do not use Wrangler for this frontend.

```text
Framework preset: Create React App
Root directory: frontend
Build command: npm run build
Output directory: build
```

The backend stays in `backend/` and should be deployed separately on a Node-compatible host.

---
## Production Deployment (30 Minutes)

### Option 1: AWS EC2 (Recommended)

#### Step 1: Launch EC2 Instance
```
- AMI: Ubuntu 22.04 LTS
- Instance Type: t3.medium (or higher)
- Storage: 30GB
- Security Group: Allow 80, 443, 3000
```

#### Step 2: SSH & Setup
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install -y nginx

# Clone repository
git clone https://github.com/yourusername/perplexity-ultra.git
cd perplexity-ultra

# Install dependencies
npm install

# Build frontend (optional)
cd frontend && npm install && npm run build && cd ..
```

#### Step 3: Configure Environment
```bash
# Create .env file
sudo nano .env

# Add production config:
NODE_ENV=production
PORT=3000
GROQ_API_KEY=your_groq_api_key_here
ALLOWED_ORIGINS=https://yourdomain.com

# Save: Ctrl+X, Y, Enter
```

#### Step 4: Start with PM2
```bash
# Start application
pm2 start backend/server.js --name "perplexity-ultra"

# Save configuration
pm2 save

# Auto-restart on reboot
pm2 startup
# (Follow instructions to add startup script)

# Monitor
pm2 logs perplexity-ultra
pm2 status
```

#### Step 5: Setup Nginx Reverse Proxy
```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/default

# Add this configuration:
```

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx
sudo systemctl enable nginx
```

#### Step 6: SSL Certificate (Recommended)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

#### Step 7: Test
```bash
# Test server
curl http://your-instance-ip/api/health

# Should return:
# {"success":true,"status":"healthy",...}
```

---

### Option 2: Docker Deployment

#### Step 1: Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "backend/server.js"]
```

#### Step 2: Build & Run
```bash
# Build image
docker build -t perplexity-ultra:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e GROQ_API_KEY=your_groq_api_key_here \
  -e NODE_ENV=production \
  --name perplexity-ultra \
  perplexity-ultra:latest

# View logs
docker logs -f perplexity-ultra

# Stop
docker stop perplexity-ultra
```

#### Step 3: Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GROQ_API_KEY=your_groq_api_key_here
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    volumes:
      - ./logs:/app/logs
```

```bash
# Deploy
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

### Option 3: Heroku Deployment

#### Step 1: Setup
```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create perplexity-ultra-yourname

# Set environment
heroku config:set GROQ_API_KEY=your_groq_api_key_here
```

#### Step 2: Create Procfile
```
# Procfile
web: node backend/server.js
```

#### Step 3: Deploy
```bash
git push heroku main

# View logs
heroku logs --tail
```

---

### Option 4: Vercel (Frontend Only)

```bash
cd frontend
npm install -g vercel
vercel --prod

# Frontend deploys automatically
# API stays on your backend server
```

---

## Monitoring & Maintenance

### Health Checks
```bash
# Check server status
curl http://localhost:3000/api/health

# Check logs
tail -f logs/combined.log

# Monitor with PM2
pm2 monit
```

### Performance Optimization

```javascript
// In server.js
// Enable caching
const cache = new NodeCache({ stdTTL: 3600 });

// Rate limiting
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

### Scaling

```bash
# Start with PM2 Cluster Mode
pm2 start backend/server.js -i max --name "perplexity-ultra"

# Load balancing with Nginx
upstream app_servers {
  server localhost:3000;
  server localhost:3001;
  server localhost:3002;
}
```

---

## Troubleshooting

### Server Won't Start
```bash
# Check port in use
sudo lsof -i :3000

# Check logs
pm2 logs

# Restart
pm2 restart perplexity-ultra
```

### High Memory Usage
```bash
# Clear cache
curl -X DELETE http://localhost:3000/api/cache

# Limit Node.js memory
NODE_OPTIONS=--max-old-space-size=2048 npm start
```

### API Timeout Issues
```bash
# Increase timeout in server.js
const timeout = 30000; // 30 seconds

// Or in Nginx
proxy_connect_timeout 30s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;
```

### CORS Errors
```javascript
// In .env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

// Or add specific headers
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

---

## Security Checklist

- [ ] Change GROQ_API_KEY in production
- [ ] Enable HTTPS/SSL
- [ ] Set ALLOWED_ORIGINS correctly
- [ ] Enable rate limiting
- [ ] Enable request logging
- [ ] Use strong database credentials
- [ ] Run security audit: `npm audit fix`
- [ ] Keep dependencies updated
- [ ] Enable firewall rules
- [ ] Setup automated backups

---

## Monitoring Tools

### Free Options
- PM2 Plus (Free tier)
- New Relic (Free tier)
- Sentry (Free tier)
- UptimeRobot

### Paid Options
- Datadog
- New Relic Pro
- PagerDuty
- CloudFlare

---

## Cost Estimates (Monthly)

| Platform | Cost | Notes |
|----------|------|-------|
| AWS EC2 t3.medium | $25-50 | Includes 750 free hours/month for first year |
| Heroku | $7-50 | Pay-as-you-go dyno hours |
| DigitalOcean | $5-40 | Basic droplet |
| Docker + Server | Custom | BYOH (Bring Your Own Host) |
| Vercel (Frontend) | Free | Hobby tier |

---

## Next Steps

1. **Test locally** - npm start
2. **Deploy backend** - Choose AWS/Docker/Heroku
3. **Deploy frontend** - Use Vercel or same host
4. **Setup monitoring** - New Relic or PM2 Plus
5. **Enable SSL** - Certbot for free
6. **Configure DNS** - Point domain to your server
7. **Test in production** - Full end-to-end testing
8. **Setup backups** - Daily automated backups
9. **Monitor metrics** - Track performance
10. **Update regularly** - Security patches

---

## Support

- **Documentation**: See README.md
- **Issues**: GitHub Issues
- **Performance**: Check server logs
- **Scaling**: Use load balancers

**Deployment Complete! 🎉**


