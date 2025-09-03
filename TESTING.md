# 🧪 Testing Guide for WhatsApp MCP Server

This guide explains how to test the WhatsApp MCP server locally and in production.

## 🚀 Quick Start Testing

### 1. Automated Local Testing
```bash
# Run the automated test script
node test-local.js
```

This script will:
- ✅ Check required files
- 📦 Install dependencies
- 🔧 Build TypeScript
- 🧪 Run all tests
- 📖 Show usage instructions

### 2. Manual Testing Steps

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Build the Project
```bash
npm run build
```

#### Step 3: Run Tests
```bash
npm test
```

#### Step 4: Start the Server
```bash
npm start
# or
node dist/main.js
```

## 🧪 Test Categories

### Unit Tests
- **Webhook Management**: `test/unit/webhook-management.test.ts`
- **MCP Webhook Tools**: `test/unit/mcp-webhook-tools.test.ts`
- **WhatsApp Service**: `test/unit/whatsapp-service.test.ts`
- **API Client**: `test/unit/api.test.ts`

### Integration Tests
- **Webhook Integration**: `test/integration/webhook-integration.test.ts`
- **MCP Server**: `test/unit/mcp-server.test.ts`

## 🔧 Testing MCP Tools

### Basic Tools
```bash
# Get server status
get_status

# Search contacts
search_contacts("John")

# Send message
send_message("1234567890", "Hello World")

# Get messages
get_messages("1234567890", 10)
```

### Group Management
```bash
# Create group
create_group("Test Group", ["1234567890", "0987654321"])

# Search groups
search_groups("Test")

# Send group message
send_group_message("group_id", "Hello Group!")
```

### Media Tools
```bash
# Send media
send_media_message("1234567890", "file:///path/to/image.jpg", "Caption")

# Send voice message
send_voice_message("1234567890", "file:///path/to/audio.mp3")

# Send audio file
send_audio_file("1234567890", "file:///path/to/music.mp3", "Song title")

# Send sticker
send_sticker("1234567890", "file:///path/to/sticker.webp")
```

### Chat States
```bash
# Send typing indicator
send_typing_state("1234567890")

# Send recording indicator
send_recording_state("1234567890")

# Mark as seen
send_seen_state("1234567890")
```

## 🔗 Testing Webhook System

### 1. Configure Webhook
```bash
# Update webhook configuration
update_webhook_config(
  url="https://your-server.com/webhook",
  authToken="your-secret-token",
  filters={
    "allowedNumbers": ["1234567890"],
    "allowPrivate": true,
    "allowGroups": false
  }
)
```

### 2. Test Webhook
```bash
# Test webhook endpoint
test_webhook("https://your-server.com/webhook", "your-secret-token")
```

### 3. Check Configuration
```bash
# Get current webhook config
get_current_webhook_config()

# Disable webhook
disable_webhook()

# Reload from file
reload_webhook_config("/path/to/webhook.json")
```

### 4. Webhook Payload Structure
```json
{
  "from": "1234567890",
  "name": "Contact Name",
  "message": "Message content",
  "isGroup": false,
  "timestamp": 1234567890,
  "messageId": "message_id",
  "fromMe": false,
  "type": "text",
  "messageType": "text",
  "content": {
    "text": "Message content"
  },
  "media": {
    "mimetype": "image/jpeg",
    "filename": "image.jpg",
    "filesize": 12345,
    "data": "base64_encoded_data"
  },
  "quotedMessage": {
    "messageId": "quoted_id",
    "body": "Quoted message",
    "type": "text"
  },
  "group": {
    "id": "group_id",
    "name": "Group Name",
    "participants": []
  },
  "mentions": [
    {
      "id": "mention_id",
      "number": "1234567890"
    }
  ]
}
```

## 🌐 Testing REST API

### Basic Endpoints
```bash
# Get status
curl http://localhost:3000/status

# Send message
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","message":"Hello"}'

# Get contacts
curl http://localhost:3000/contacts

# Get chats
curl http://localhost:3000/chats
```

### Group Endpoints
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

### Media Endpoints
```bash
# Send media
curl -X POST http://localhost:3000/send/media \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","source":"file:///path/to/image.jpg","caption":"Caption"}'

# Send voice message
curl -X POST http://localhost:3000/send/voice \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","source":"file:///path/to/audio.mp3"}'

# Send audio file
curl -X POST http://localhost:3000/send/audio \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890","source":"file:///path/to/music.mp3","caption":"Song"}'
```

### State Endpoints
```bash
# Send typing state
curl -X POST http://localhost:3000/send/typing \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890"}'

# Send recording state
curl -X POST http://localhost:3000/send/recording \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890"}'

# Send seen state
curl -X POST http://localhost:3000/send/seen \
  -H "Content-Type: application/json" \
  -d '{"number":"1234567890"}'
```

## 🔍 Debugging

### Enable Debug Logging
```bash
# Set debug level
export DEBUG=whatsapp-mcp:*

# Or in .env file
DEBUG=whatsapp-mcp:*
```

### Check Logs
```bash
# View server logs
tail -f logs/app.log

# View webhook logs
tail -f logs/webhook.log
```

### Common Issues

#### 1. WhatsApp Connection Issues
- Check if WhatsApp Web is accessible
- Verify QR code scanning
- Check authentication files in `.wwebjs_auth/`

#### 2. Webhook Issues
- Verify webhook URL is accessible
- Check authentication token
- Test webhook endpoint manually
- Check webhook.json file format

#### 3. Media Issues
- Verify file paths are correct
- Check file permissions
- Ensure supported file formats
- Check media storage directory

#### 4. Group Creation Issues
- Verify participant numbers are valid
- Check group creation timeout settings
- Ensure participants are WhatsApp users

## 📊 Performance Testing

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Run load test
artillery run load-test.yml
```

### Memory Testing
```bash
# Monitor memory usage
node --inspect dist/main.js

# Use Chrome DevTools to profile
chrome://inspect
```

## 🚀 Production Testing

### 1. Environment Setup
```bash
# Set production environment
export NODE_ENV=production

# Configure production webhook
update_webhook_config(
  url="https://production-server.com/webhook",
  authToken="production-token"
)
```

### 2. Health Checks
```bash
# Check server health
curl http://localhost:3000/health

# Check WhatsApp connection
curl http://localhost:3000/status
```

### 3. Monitoring
- Monitor webhook delivery success rate
- Check message processing latency
- Monitor memory and CPU usage
- Set up alerts for failures

## 📝 Test Checklist

### Before Deployment
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Webhook configuration works
- [ ] Media sending works
- [ ] Group creation works
- [ ] Error handling works
- [ ] Performance is acceptable

### After Deployment
- [ ] Server starts successfully
- [ ] WhatsApp connects
- [ ] Webhook receives messages
- [ ] All MCP tools work
- [ ] REST API responds
- [ ] Error logs are clean
- [ ] Performance is good

## 🆘 Getting Help

If you encounter issues:

1. Check the logs for error messages
2. Verify your configuration files
3. Test individual components
4. Check the GitHub issues
5. Create a new issue with:
   - Error messages
   - Configuration details
   - Steps to reproduce
   - Environment information

Happy testing! 🎉
