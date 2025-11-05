#!/bin/bash
# Deployment script for Telegram Bot Webhooks
# Деплой webhook сервера на production

set -e  # Exit on error

echo "🚀 Deploying Telegram Bot Webhooks to Production"
echo "=================================================="
echo ""

# Configuration
SERVER="root@89.223.126.35"
REMOTE_DIR="/root/medicod/Medicod_Analytics_Bot"
LOCAL_DIR="."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Stop current bot
echo -e "${YELLOW}Step 1/8: Stopping current polling bot...${NC}"
ssh $SERVER "cd $REMOTE_DIR && pkill -f 'node.*botRunner' || true"
echo -e "${GREEN}✓ Bot stopped${NC}"
echo ""

# Step 2: Upload new files
echo -e "${YELLOW}Step 2/8: Uploading new webhook files...${NC}"
scp src/webhookServer.js $SERVER:$REMOTE_DIR/src/
scp src/webhookRunner.js $SERVER:$REMOTE_DIR/src/
scp src/manageWebhook.js $SERVER:$REMOTE_DIR/src/
echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Step 3: Upload updated package.json
echo -e "${YELLOW}Step 3/8: Uploading package.json...${NC}"
scp package.json $SERVER:$REMOTE_DIR/
echo -e "${GREEN}✓ package.json uploaded${NC}"
echo ""

# Step 4: Install npm dependencies
echo -e "${YELLOW}Step 4/8: Installing npm dependencies (Express)...${NC}"
ssh $SERVER "cd $REMOTE_DIR && npm install"
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 5: Setup .env variables
echo -e "${YELLOW}Step 5/8: Checking .env configuration...${NC}"
ssh $SERVER "cd $REMOTE_DIR && grep -q 'WEBHOOK_URL' .env || echo 'WEBHOOK_URL=https://api.medicod.ru/telegram-webhook' >> .env"
ssh $SERVER "cd $REMOTE_DIR && grep -q 'WEBHOOK_PORT' .env || echo 'WEBHOOK_PORT=8443' >> .env"
ssh $SERVER "cd $REMOTE_DIR && grep -q 'WEBHOOK_PATH' .env || echo 'WEBHOOK_PATH=/telegram-webhook' >> .env"

# Generate secret if not exists
ssh $SERVER "cd $REMOTE_DIR && if ! grep -q 'WEBHOOK_SECRET=' .env; then echo \"WEBHOOK_SECRET=\$(openssl rand -hex 32)\" >> .env; fi"
echo -e "${GREEN}✓ .env configured${NC}"
echo ""

# Step 6: Configure Nginx
echo -e "${YELLOW}Step 6/8: Configuring Nginx...${NC}"
cat > /tmp/telegram-webhook-nginx.conf << 'EOF'
# Telegram Webhook endpoint
location /telegram-webhook {
    proxy_pass http://localhost:8443/telegram-webhook;
    proxy_http_version 1.1;

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Telegram secret token
    proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
EOF

scp /tmp/telegram-webhook-nginx.conf $SERVER:/tmp/
ssh $SERVER "cat /tmp/telegram-webhook-nginx.conf >> /etc/nginx/sites-available/api.medicod.ru && nginx -t && systemctl reload nginx"
echo -e "${GREEN}✓ Nginx configured and reloaded${NC}"
echo ""

# Step 7: Register webhook
echo -e "${YELLOW}Step 7/8: Registering webhook with Telegram...${NC}"
ssh $SERVER "cd $REMOTE_DIR && npm run webhook:set"
echo -e "${GREEN}✓ Webhook registered${NC}"
echo ""

# Step 8: Start webhook server
echo -e "${YELLOW}Step 8/8: Starting webhook server...${NC}"
ssh $SERVER "cd $REMOTE_DIR && nohup npm run webhook > webhook.log 2>&1 &"
sleep 3
echo -e "${GREEN}✓ Webhook server started${NC}"
echo ""

# Final check
echo -e "${YELLOW}Running final checks...${NC}"
ssh $SERVER "cd $REMOTE_DIR && npm run webhook:info"
echo ""

echo "=================================================="
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📊 Next steps:"
echo "   1. Test the bot: Send /help in Telegram"
echo "   2. Monitor logs: ssh $SERVER 'cd $REMOTE_DIR && tail -f webhook.log'"
echo "   3. Check webhook info: ssh $SERVER 'cd $REMOTE_DIR && npm run webhook:info'"
echo ""
