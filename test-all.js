#!/usr/bin/env node

/**
 * Comprehensive Test Script for WhatsApp MCP Server
 * 
 * This script runs all tests and validations
 * Run with: node test-all.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Comprehensive Test Suite for WhatsApp MCP Server\n');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function runTest(testName, command, args = []) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Running: ${testName}`);
    console.log(`Command: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, { stdio: 'pipe' });
    let output = '';
    let errorOutput = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    process.on('close', (code) => {
      testResults.total++;
      if (code === 0) {
        console.log(`✅ ${testName} - PASSED`);
        testResults.passed++;
      } else {
        console.log(`❌ ${testName} - FAILED`);
        console.log(`Error: ${errorOutput}`);
        testResults.failed++;
      }
      resolve(code === 0);
    });
  });
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive test suite...\n');
  
  // Test 1: Quick validation
  await runTest('Quick Validation', 'node', ['quick-test.js']);
  
  // Test 2: Install dependencies
  await runTest('Install Dependencies', 'npm', ['install']);
  
  // Test 3: TypeScript compilation
  await runTest('TypeScript Compilation', 'npm', ['run', 'build']);
  
  // Test 4: Linting
  await runTest('Code Linting', 'npm', ['run', 'lint']);
  
  // Test 5: Unit tests
  await runTest('Unit Tests', 'npm', ['test']);
  
  // Test 6: Test coverage
  await runTest('Test Coverage', 'npm', ['run', 'test:coverage']);
  
  // Test 7: Check if server can start (briefly)
  await runTest('Server Startup Test', 'timeout', ['10s', 'npm', 'start']);
  
  // Test 8: Check build output
  await runTest('Build Output Validation', 'node', ['-e', `
    const fs = require('fs');
    const path = require('path');
    
    const requiredFiles = [
      'dist/main.js',
      'dist/mcp-server.js',
      'dist/whatsapp-client.js',
      'dist/whatsapp-service.js',
      'dist/api.js'
    ];
    
    let allExist = true;
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.log('Missing file:', file);
        allExist = false;
      }
    }
    
    if (allExist) {
      console.log('All build files exist');
      process.exit(0);
    } else {
      console.log('Some build files are missing');
      process.exit(1);
    }
  `]);
  
  // Test 9: Check package.json scripts
  await runTest('Package.json Scripts', 'node', ['-e', `
    const packageJson = require('./package.json');
    const requiredScripts = ['build', 'start', 'test', 'dev'];
    
    let allScriptsExist = true;
    for (const script of requiredScripts) {
      if (!packageJson.scripts[script]) {
        console.log('Missing script:', script);
        allScriptsExist = false;
      }
    }
    
    if (allScriptsExist) {
      console.log('All required scripts exist');
      process.exit(0);
    } else {
      console.log('Some required scripts are missing');
      process.exit(1);
    }
  `]);
  
  // Test 10: Check dependencies
  await runTest('Dependencies Check', 'node', ['-e', `
    const packageJson = require('./package.json');
    const requiredDeps = [
      'whatsapp-web.js',
      '@modelcontextprotocol/sdk',
      'zod',
      'axios',
      'qrcode-terminal'
    ];
    
    let allDepsExist = true;
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies[dep]) {
        console.log('Missing dependency:', dep);
        allDepsExist = false;
      }
    }
    
    if (allDepsExist) {
      console.log('All required dependencies exist');
      process.exit(0);
    } else {
      console.log('Some required dependencies are missing');
      process.exit(1);
    }
  `]);
  
  // Test 11: Check TypeScript configuration
  await runTest('TypeScript Configuration', 'node', ['-e', `
    const tsconfig = require('./tsconfig.json');
    
    if (tsconfig.compilerOptions && 
        tsconfig.compilerOptions.target && 
        tsconfig.compilerOptions.outDir) {
      console.log('TypeScript configuration is valid');
      process.exit(0);
    } else {
      console.log('TypeScript configuration is invalid');
      process.exit(1);
    }
  `]);
  
  // Test 12: Check test files
  await runTest('Test Files Check', 'node', ['-e', `
    const fs = require('fs');
    const testFiles = [
      'test/unit/webhook-management.test.ts',
      'test/unit/mcp-webhook-tools.test.ts',
      'test/integration/webhook-integration.test.ts'
    ];
    
    let allTestFilesExist = true;
    for (const file of testFiles) {
      if (!fs.existsSync(file)) {
        console.log('Missing test file:', file);
        allTestFilesExist = false;
      }
    }
    
    if (allTestFilesExist) {
      console.log('All test files exist');
      process.exit(0);
    } else {
      console.log('Some test files are missing');
      process.exit(1);
    }
  `]);
  
  // Test 13: Check source files
  await runTest('Source Files Check', 'node', ['-e', `
    const fs = require('fs');
    const sourceFiles = [
      'src/main.ts',
      'src/mcp-server.ts',
      'src/whatsapp-client.ts',
      'src/whatsapp-service.ts',
      'src/whatsapp-api-client.ts',
      'src/api.ts',
      'src/types.ts'
    ];
    
    let allSourceFilesExist = true;
    for (const file of sourceFiles) {
      if (!fs.existsSync(file)) {
        console.log('Missing source file:', file);
        allSourceFilesExist = false;
      }
    }
    
    if (allSourceFilesExist) {
      console.log('All source files exist');
      process.exit(0);
    } else {
      console.log('Some source files are missing');
      process.exit(1);
    }
  `]);
  
  // Test 14: Check webhook functionality
  await runTest('Webhook Functionality Check', 'node', ['-e', `
    const fs = require('fs');
    
    // Check if webhook functions exist in source files
    const mcpServerContent = fs.readFileSync('src/mcp-server.ts', 'utf8');
    const whatsappClientContent = fs.readFileSync('src/whatsapp-client.ts', 'utf8');
    
    const requiredFunctions = [
      'update_webhook_config',
      'get_current_webhook_config',
      'updateWebhookConfig',
      'getCurrentWebhookConfig'
    ];
    
    let allFunctionsExist = true;
    for (const func of requiredFunctions) {
      if (!mcpServerContent.includes(func) && !whatsappClientContent.includes(func)) {
        console.log('Missing function:', func);
        allFunctionsExist = false;
      }
    }
    
    if (allFunctionsExist) {
      console.log('All webhook functions exist');
      process.exit(0);
    } else {
      console.log('Some webhook functions are missing');
      process.exit(1);
    }
  `]);
  
  // Test 15: Check media functionality
  await runTest('Media Functionality Check', 'node', ['-e', `
    const fs = require('fs');
    
    const whatsappServiceContent = fs.readFileSync('src/whatsapp-service.ts', 'utf8');
    
    const requiredMediaFunctions = [
      'sendMediaMessage',
      'sendVoiceMessage',
      'sendAudioFile',
      'sendSticker',
      'createStickerFromImage'
    ];
    
    let allMediaFunctionsExist = true;
    for (const func of requiredMediaFunctions) {
      if (!whatsappServiceContent.includes(func)) {
        console.log('Missing media function:', func);
        allMediaFunctionsExist = false;
      }
    }
    
    if (allMediaFunctionsExist) {
      console.log('All media functions exist');
      process.exit(0);
    } else {
      console.log('Some media functions are missing');
      process.exit(1);
    }
  `]);
  
  // Test 16: Check group functionality
  await runTest('Group Functionality Check', 'node', ['-e', `
    const fs = require('fs');
    
    const whatsappServiceContent = fs.readFileSync('src/whatsapp-service.ts', 'utf8');
    
    const requiredGroupFunctions = [
      'createGroup',
      'getGroups',
      'searchGroups',
      'getGroupById',
      'getGroupMessages',
      'sendGroupMessage',
      'addParticipantsToGroup'
    ];
    
    let allGroupFunctionsExist = true;
    for (const func of requiredGroupFunctions) {
      if (!whatsappServiceContent.includes(func)) {
        console.log('Missing group function:', func);
        allGroupFunctionsExist = false;
      }
    }
    
    if (allGroupFunctionsExist) {
      console.log('All group functions exist');
      process.exit(0);
    } else {
      console.log('Some group functions are missing');
      process.exit(1);
    }
  `]);
  
  // Test 17: Check API endpoints
  await runTest('API Endpoints Check', 'node', ['-e', `
    const fs = require('fs');
    
    const apiContent = fs.readFileSync('src/api.ts', 'utf8');
    
    const requiredEndpoints = [
      'router.get',
      'router.post',
      '/status',
      '/contacts',
      '/send',
      '/groups',
      '/send/media',
      '/send/voice',
      '/send/audio'
    ];
    
    let allEndpointsExist = true;
    for (const endpoint of requiredEndpoints) {
      if (!apiContent.includes(endpoint)) {
        console.log('Missing API endpoint:', endpoint);
        allEndpointsExist = false;
      }
    }
    
    if (allEndpointsExist) {
      console.log('All API endpoints exist');
      process.exit(0);
    } else {
      console.log('Some API endpoints are missing');
      process.exit(1);
    }
  `]);
  
  // Test 18: Check MCP tools
  await runTest('MCP Tools Check', 'node', ['-e', `
    const fs = require('fs');
    
    const mcpServerContent = fs.readFileSync('src/mcp-server.ts', 'utf8');
    
    const requiredMcpTools = [
      'get_status',
      'search_contacts',
      'send_message',
      'create_group',
      'send_media_message',
      'send_voice_message',
      'send_audio_file',
      'update_webhook_config',
      'get_current_webhook_config'
    ];
    
    let allMcpToolsExist = true;
    for (const tool of requiredMcpTools) {
      if (!mcpServerContent.includes(tool)) {
        console.log('Missing MCP tool:', tool);
        allMcpToolsExist = false;
      }
    }
    
    if (allMcpToolsExist) {
      console.log('All MCP tools exist');
      process.exit(0);
    } else {
      console.log('Some MCP tools are missing');
      process.exit(1);
    }
  `]);
  
  // Test 19: Check error handling
  await runTest('Error Handling Check', 'node', ['-e', `
    const fs = require('fs');
    
    const sourceFiles = [
      'src/mcp-server.ts',
      'src/whatsapp-service.ts',
      'src/api.ts'
    ];
    
    let allFilesHaveErrorHandling = true;
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('try') || !content.includes('catch')) {
        console.log('Missing error handling in:', file);
        allFilesHaveErrorHandling = false;
      }
    }
    
    if (allFilesHaveErrorHandling) {
      console.log('All source files have error handling');
      process.exit(0);
    } else {
      console.log('Some source files are missing error handling');
      process.exit(1);
    }
  `]);
  
  // Test 20: Check logging
  await runTest('Logging Check', 'node', ['-e', `
    const fs = require('fs');
    
    const sourceFiles = [
      'src/mcp-server.ts',
      'src/whatsapp-service.ts',
      'src/whatsapp-client.ts'
    ];
    
    let allFilesHaveLogging = true;
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('logger')) {
        console.log('Missing logging in:', file);
        allFilesHaveLogging = false;
      }
    }
    
    if (allFilesHaveLogging) {
      console.log('All source files have logging');
      process.exit(0);
    } else {
      console.log('Some source files are missing logging');
      process.exit(1);
    }
  `]);
  
  // Final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Your setup is ready for deployment.');
    console.log('\n📖 Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Test MCP tools with Claude Desktop');
    console.log('3. Test REST API endpoints');
    console.log('4. Configure webhook if needed');
    console.log('5. Deploy to production');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above before deploying.');
    console.log('\n🔧 Common fixes:');
    console.log('- Run: npm install');
    console.log('- Check file paths and names');
    console.log('- Verify package.json configuration');
    console.log('- Check TypeScript configuration');
    console.log('- Review error messages above');
  }
  
  console.log('='.repeat(60));
  
  // Exit with appropriate code
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Run all tests
runAllTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
