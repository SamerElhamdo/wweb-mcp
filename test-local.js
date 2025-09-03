#!/usr/bin/env node

/**
 * Local Testing Script for WhatsApp MCP Server
 * 
 * This script helps you test the MCP server locally before deploying
 * Run with: node test-local.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Local WhatsApp MCP Server Test...\n');

// Check if required files exist
const requiredFiles = [
  'src/main.ts',
  'src/mcp-server.ts',
  'src/whatsapp-client.ts',
  'package.json'
];

console.log('📋 Checking required files...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING!`);
    process.exit(1);
  }
}

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('\n📦 Installing dependencies...');
  const install = spawn('npm', ['install'], { stdio: 'inherit' });
  
  install.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Dependencies installed successfully');
      startServer();
    } else {
      console.log('❌ Failed to install dependencies');
      process.exit(1);
    }
  });
} else {
  console.log('✅ Dependencies already installed');
  startServer();
}

function startServer() {
  console.log('\n🔧 Building TypeScript...');
  const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
  
  build.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build successful');
      runTests();
    } else {
      console.log('❌ Build failed');
      process.exit(1);
    }
  });
}

function runTests() {
  console.log('\n🧪 Running tests...');
  const test = spawn('npm', ['test'], { stdio: 'inherit' });
  
  test.on('close', (code) => {
    if (code === 0) {
      console.log('✅ All tests passed');
      showUsageInstructions();
    } else {
      console.log('❌ Some tests failed');
      console.log('\n🔍 Check the test output above for details');
    }
  });
}

function showUsageInstructions() {
  console.log('\n🎉 Local testing completed successfully!');
  console.log('\n📖 Next steps:');
  console.log('1. Start the MCP server:');
  console.log('   npm start');
  console.log('   or');
  console.log('   node dist/main.js');
  
  console.log('\n2. Test MCP tools using Claude Desktop or MCP client:');
  console.log('   - Connect to the MCP server');
  console.log('   - Try tools like: get_status, search_contacts, send_message');
  console.log('   - Test webhook tools: update_webhook_config, test_webhook');
  
  console.log('\n3. Test REST API (if enabled):');
  console.log('   curl http://localhost:3000/status');
  console.log('   curl -X POST http://localhost:3000/send -H "Content-Type: application/json" -d \'{"number":"1234567890","message":"Hello"}\'');
  
  console.log('\n4. Test webhook functionality:');
  console.log('   - Create a webhook.json file in .wwebjs_auth/');
  console.log('   - Use update_webhook_config tool to configure webhook');
  console.log('   - Send a test message to trigger webhook');
  
  console.log('\n🔧 Configuration files:');
  console.log('   - .wwebjs_auth/webhook.json - Webhook configuration');
  console.log('   - .env - Environment variables (optional)');
  
  console.log('\n📚 Available MCP Tools:');
  console.log('   Basic: get_status, search_contacts, get_messages, send_message');
  console.log('   Groups: create_group, get_groups, search_groups, send_group_message');
  console.log('   Media: send_media_message, download_media_from_message');
  console.log('   States: send_typing_state, send_recording_state, send_seen_state');
  console.log('   Audio: send_voice_message, send_audio_file');
  console.log('   Stickers: send_sticker, create_sticker_from_image');
  console.log('   Webhook: update_webhook_config, get_current_webhook_config, test_webhook, disable_webhook');
  
  console.log('\n🚀 Ready for deployment!');
}
