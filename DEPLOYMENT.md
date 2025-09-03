# 🚀 Deployment Guide for WhatsApp MCP Server

This guide covers everything you need to know about deploying and testing the WhatsApp MCP server.

## 📋 Pre-Deployment Checklist

### ✅ Quick Validation
```bash
# Run the quick test script
node quick-test.js
```

This will validate:
- ✅ All required files exist
- ✅ Dependencies are properly configured
- ✅ TypeScript configuration is valid
- ✅ Key functions are present
- ✅ Test files are in place

### ✅ Manual Checks
- [ ] WhatsApp Web is accessible from your server
- [ ] Required ports are open (3000 for REST API)
- [ ] File permissions are correct
- [ ] Environment variables are set (if needed)

## 🔧 Local Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### 4. Start the Server
```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev
```

## 🧪 Testing MCP Tools

### Basic Functionality
```bash
# Test server status
get_status

# Test contact search
search_contacts("John")

# Test message sending
send_message("1234567890", "Hello World")

# Test group creation
create_group("Test Group", ["1234567890", "0987654321"])
```

### Webhook Testing
```bash
# Configure webhook
update_webhook_config(
  url="https://your-server.com/webhook",
  authToken="your-secret-token",
  filters={
    "allowedNumbers": ["1234567890"],
    "allowPrivate": true,
    "allowGroups": false
  }
)

# Test webhook
test_webhook("https://your-server.com/webhook", "your-secret-token")

# Check current config
get_current_webhook_config()
```

### Media Testing
```bash
# Send image
send_media_message("1234567890", "file:///path/to/image.jpg", "Caption")

# Send voice message
send_voice_message("1234567890", "file:///path/to/audio.mp3")

# Send audio file
send_audio_file("1234567890", "file:///path/to/music.mp3", "Song title")

# Send sticker
send_sticker("1234567890", "file:///path/to/sticker.webp")
```

## 🌐 Testing REST API

### Health Checks
```bash
# Check server status
curl http://localhost:3000/status

# Check WhatsApp connection
curl http://localhost:3000/status | jq '.status'
```

### Message Operations
```bash
# Send message
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","message":"Hello from API"}'

# Get contacts
curl http://localhost:3000/contacts

# Search contacts
curl "http://localhost:3000/contacts/search?query=John"
```

### Group Operations
```bash
# Create group
curl -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Group","participants":["1234567890"]}'

# Get groups
curl http://localhost:3000/groups

# Search groups
curl "http://localhost:3000/groups/search?query=Test"
```

### Media Operations
```bash
# Send media
curl -X POST http://localhost:3000/send/media \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","source":"file:///path/to/image.jpg","caption":"Test image"}'

# Send voice message
curl -X POST http://localhost:3000/send/voice \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","source":"file:///path/to/audio.mp3"}'
```

## 🐳 Docker Deployment

### Build Docker Image
```bash
# Build the image
docker build -t wweb-mcp .

# Run the container
docker run -d \
  --name wweb-mcp \
  -p 3000:3000 \
  -v $(pwd)/.wwebjs_auth:/app/.wwebjs_auth \
  wweb-mcp
```

### Docker Compose
```yaml
version: '3.8'
services:
  wweb-mcp:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./.wwebjs_auth:/app/.wwebjs_auth
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

## ☁️ Cloud Deployment

### AWS EC2
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd wweb-mcp
npm install
npm run build

# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start dist/main.js --name wweb-mcp
pm2 save
pm2 startup
```

### Heroku
```bash
# Install Heroku CLI
# Create Procfile
echo "web: node dist/main.js" > Procfile

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### DigitalOcean App Platform
```yaml
# .do/app.yaml
name: wweb-mcp
services:
- name: api
  source_dir: /
  github:
    repo: your-username/wweb-mcp
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  routes:
  - path: /
```

## 🔍 Monitoring & Logging

### Health Monitoring
```bash
# Check server health
curl http://localhost:3000/status

# Monitor logs
tail -f logs/app.log

# Check process status
ps aux | grep node
```

### Performance Monitoring
```bash
# Monitor memory usage
node --inspect dist/main.js

# Use Chrome DevTools
chrome://inspect
```

### Log Analysis
```bash
# Filter error logs
grep "ERROR" logs/app.log

# Monitor webhook delivery
grep "webhook" logs/app.log

# Check WhatsApp connection
grep "ready\|disconnected" logs/app.log
```

## 🚨 Troubleshooting

### Common Issues

#### 1. WhatsApp Connection Issues
```bash
# Check if WhatsApp Web is accessible
curl -I https://web.whatsapp.com

# Clear authentication data
rm -rf .wwebjs_auth/session-*

# Restart server
npm start
```

#### 2. Webhook Issues
```bash
# Test webhook endpoint
curl -X POST https://your-webhook.com/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "message"}'

# Check webhook configuration
get_current_webhook_config()

# Update webhook config
update_webhook_config(
  url="https://new-webhook.com/endpoint",
  authToken="new-token"
)
```

#### 3. Media Issues
```bash
# Check file permissions
ls -la /path/to/media/files

# Verify file paths
file /path/to/media/image.jpg

# Test media sending
send_media_message("1234567890", "file:///path/to/test.jpg")
```

#### 4. Group Creation Issues
```bash
# Check participant numbers
echo "1234567890" | grep -E '^[0-9]{10,15}$'

# Test with timeout
create_group("Test Group", ["1234567890"], {
  "timeout": 30000,
  "retries": 5,
  "retryDelay": 2000
})
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=whatsapp-mcp:*

# Start with debug
npm start
```

## 📊 Performance Optimization

### Memory Management
```bash
# Monitor memory usage
node --max-old-space-size=4096 dist/main.js

# Use PM2 with memory limits
pm2 start dist/main.js --name wweb-mcp --max-memory-restart 1G
```

### Connection Pooling
```javascript
// In your configuration
const config = {
  maxConnections: 10,
  keepAlive: true,
  timeout: 30000
};
```

### Caching
```javascript
// Implement caching for frequently accessed data
const cache = new Map();

function getCachedContacts() {
  if (cache.has('contacts')) {
    return cache.get('contacts');
  }
  // Fetch and cache
}
```

## 🔒 Security Considerations

### Authentication
```bash
# Use environment variables for sensitive data
export WEBHOOK_AUTH_TOKEN="your-secret-token"
export API_KEY="your-api-key"
```

### Rate Limiting
```javascript
// Implement rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

### Input Validation
```javascript
// Validate all inputs
const { z } = require('zod');

const messageSchema = z.object({
  number: z.string().regex(/^[0-9]{10,15}$/),
  message: z.string().min(1).max(4096)
});
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Use load balancer
# Configure multiple instances
# Implement session sharing
```

### Vertical Scaling
```bash
# Increase memory
node --max-old-space-size=8192 dist/main.js

# Use PM2 cluster mode
pm2 start dist/main.js -i max
```

## 🎯 Production Checklist

### Before Going Live
- [ ] All tests pass
- [ ] Webhook configuration is correct
- [ ] Media storage is properly configured
- [ ] Error handling is in place
- [ ] Logging is configured
- [ ] Monitoring is set up
- [ ] Security measures are implemented
- [ ] Backup strategy is in place

### After Deployment
- [ ] Server starts successfully
- [ ] WhatsApp connects
- [ ] Webhook receives messages
- [ ] All MCP tools work
- [ ] REST API responds correctly
- [ ] Error logs are clean
- [ ] Performance is acceptable
- [ ] Monitoring alerts are working

## 🆘 Support

If you encounter issues:

1. **Check the logs** for error messages
2. **Verify configuration** files
3. **Test individual components**
4. **Check GitHub issues** for similar problems
5. **Create a new issue** with:
   - Error messages
   - Configuration details
   - Steps to reproduce
   - Environment information

## 📚 Additional Resources

- [WhatsApp Web.js Documentation](https://docs.wwebjs.dev/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

Happy deploying! 🚀
