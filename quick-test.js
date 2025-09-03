#!/usr/bin/env node

/**
 * Quick Test Script for WhatsApp MCP Server
 * 
 * This script performs a quick validation of the server setup
 * Run with: node quick-test.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Quick Test for WhatsApp MCP Server\n');

// Test 1: Check file structure
console.log('📁 Checking file structure...');
const requiredFiles = [
  'src/main.ts',
  'src/mcp-server.ts', 
  'src/whatsapp-client.ts',
  'src/whatsapp-service.ts',
  'src/whatsapp-api-client.ts',
  'src/api.ts',
  'src/types.ts',
  'package.json',
  'tsconfig.json'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING!`);
    allFilesExist = false;
  }
}

// Test 2: Check package.json
console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Check required dependencies
  const requiredDeps = [
    'whatsapp-web.js',
    '@modelcontextprotocol/sdk',
    'zod',
    'axios',
    'qrcode-terminal'
  ];
  
  for (const dep of requiredDeps) {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - MISSING from dependencies!`);
      allFilesExist = false;
    }
  }
  
  // Check scripts
  const requiredScripts = ['build', 'start', 'test'];
  for (const script of requiredScripts) {
    if (packageJson.scripts && packageJson.scripts[script]) {
      console.log(`✅ Script ${script}: ${packageJson.scripts[script]}`);
    } else {
      console.log(`❌ Script ${script} - MISSING!`);
      allFilesExist = false;
    }
  }
} catch (error) {
  console.log(`❌ Error reading package.json: ${error.message}`);
  allFilesExist = false;
}

// Test 3: Check TypeScript configuration
console.log('\n🔧 Checking TypeScript configuration...');
try {
  const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  
  if (tsconfig.compilerOptions) {
    console.log('✅ TypeScript compiler options found');
    
    if (tsconfig.compilerOptions.outDir) {
      console.log(`✅ Output directory: ${tsconfig.compilerOptions.outDir}`);
    } else {
      console.log('❌ No output directory specified');
      allFilesExist = false;
    }
    
    if (tsconfig.compilerOptions.target) {
      console.log(`✅ Target: ${tsconfig.compilerOptions.target}`);
    }
  } else {
    console.log('❌ No compiler options found in tsconfig.json');
    allFilesExist = false;
  }
} catch (error) {
  console.log(`❌ Error reading tsconfig.json: ${error.message}`);
  allFilesExist = false;
}

// Test 4: Check source files for key functions
console.log('\n🔍 Checking source files for key functions...');

const keyFunctions = [
  { file: 'src/mcp-server.ts', functions: ['createMcpServer', 'update_webhook_config', 'get_current_webhook_config'] },
  { file: 'src/whatsapp-client.ts', functions: ['createWhatsAppClient', 'updateWebhookConfig', 'getCurrentWebhookConfig'] },
  { file: 'src/whatsapp-service.ts', functions: ['sendMessage', 'sendMediaMessage', 'createGroup', 'sendVoiceMessage'] },
  { file: 'src/api.ts', functions: ['routerFactory', 'router.get', 'router.post'] }
];

for (const { file, functions } of keyFunctions) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const func of functions) {
      if (content.includes(func)) {
        console.log(`✅ ${file}: ${func} found`);
      } else {
        console.log(`❌ ${file}: ${func} - MISSING!`);
        allFilesExist = false;
      }
    }
  }
}

// Test 5: Check test files
console.log('\n🧪 Checking test files...');
const testFiles = [
  'test/unit/webhook-management.test.ts',
  'test/unit/mcp-webhook-tools.test.ts',
  'test/integration/webhook-integration.test.ts'
];

for (const testFile of testFiles) {
  if (fs.existsSync(testFile)) {
    console.log(`✅ ${testFile}`);
  } else {
    console.log(`❌ ${testFile} - MISSING!`);
    allFilesExist = false;
  }
}

// Test 6: Check for webhook configuration
console.log('\n🔗 Checking webhook configuration...');
const webhookConfigPath = '.wwebjs_auth/webhook.json';
if (fs.existsSync(webhookConfigPath)) {
  try {
    const webhookConfig = JSON.parse(fs.readFileSync(webhookConfigPath, 'utf8'));
    console.log('✅ Webhook configuration file found');
    console.log(`   URL: ${webhookConfig.url || 'Not set'}`);
    console.log(`   Auth Token: ${webhookConfig.authToken ? 'Set' : 'Not set'}`);
    console.log(`   Filters: ${webhookConfig.filters ? 'Configured' : 'Not configured'}`);
  } catch (error) {
    console.log(`❌ Error reading webhook config: ${error.message}`);
    allFilesExist = false;
  }
} else {
  console.log('⚠️  Webhook configuration file not found (optional)');
  console.log('   You can create it later or use the update_webhook_config tool');
}

// Final result
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 All checks passed! Your setup looks good.');
  console.log('\n📖 Next steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: npm run build');
  console.log('3. Run: npm test');
  console.log('4. Run: npm start');
  console.log('\n🚀 Ready to test!');
} else {
  console.log('❌ Some checks failed. Please fix the issues above.');
  console.log('\n🔧 Common fixes:');
  console.log('- Run: npm install');
  console.log('- Check file paths and names');
  console.log('- Verify package.json dependencies');
  console.log('- Check TypeScript configuration');
}
console.log('='.repeat(50));
