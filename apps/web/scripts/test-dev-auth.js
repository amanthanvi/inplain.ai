#!/usr/bin/env node

/**
 * Test script to verify development authentication bypass is working
 */

const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('🧪 Testing Development Authentication Bypass...\n');

// Test 1: Check debug endpoint
const debugRequest = http.get(`http://localhost:${PORT}/api/debug/dev-auth`, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📍 Debug Endpoint Response:');
    console.log('   Status:', res.statusCode);
    console.log('   Dev Auth Header:', res.headers['x-dev-auth-active'] || 'Not present');
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('   Dev Auth Enabled:', json.devAuth.enabled);
        console.log('   Current User:', json.currentUser?.email || 'None');
        console.log('   Is Dev User:', json.currentUser?.isDevUser || false);
        
        if (json.devAuth.enabled) {
          console.log('\n✅ Dev auth is ENABLED');
          console.log('   Dev user email:', json.devAuth.devUser.email);
          console.log('   Dev user tier:', json.devAuth.devUser.tier);
        } else {
          console.log('\n❌ Dev auth is DISABLED');
          console.log('   To enable: npm run dev:auth:on');
        }
      } catch (e) {
        console.error('   Failed to parse response:', e.message);
      }
    } else {
      console.error('   Failed to check dev auth status');
    }
    
    // Test 2: Check session endpoint
    console.log('\n📍 Session Endpoint Test:');
    testSessionEndpoint();
  });
});

debugRequest.on('error', (error) => {
  console.error('❌ Failed to connect to server:', error.message);
  console.log('\nMake sure the development server is running:');
  console.log('   npm run dev');
  process.exit(1);
});

function testSessionEndpoint() {
  const sessionRequest = http.get(`http://localhost:${PORT}/api/auth/session`, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('   Status:', res.statusCode);
      console.log('   Dev Auth Header:', res.headers['x-dev-auth-active'] || 'Not present');
      
      if (res.statusCode === 200) {
        try {
          const json = JSON.parse(data);
          console.log('   User:', json.user?.email || 'Not authenticated');
          console.log('   Plan:', json.user?.plan || 'N/A');
        } catch (e) {
          console.error('   Failed to parse response:', e.message);
        }
      }
      
      // Test 3: Check protected endpoint
      console.log('\n📍 Protected Endpoint Test:');
      testProtectedEndpoint();
    });
  });
  
  sessionRequest.on('error', (error) => {
    console.error('   Failed:', error.message);
  });
}

function testProtectedEndpoint() {
  const protectedRequest = http.get(`http://localhost:${PORT}/api/user/settings`, (res) => {
    console.log('   Status:', res.statusCode);
    
    if (res.statusCode === 200) {
      console.log('   ✅ Access granted to protected endpoint');
    } else if (res.statusCode === 401) {
      console.log('   ❌ Access denied (authentication required)');
    } else {
      console.log('   ⚠️  Unexpected status code');
    }
    
    console.log('\n🏁 Test complete!\n');
  });
  
  protectedRequest.on('error', (error) => {
    console.error('   Failed:', error.message);
    console.log('\n🏁 Test complete with errors\n');
  });
}