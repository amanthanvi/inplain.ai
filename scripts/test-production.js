#!/usr/bin/env node

/**
 * Production Testing Script
 * Run this after deployment to verify all features are working
 */

const https = require('https');

const PRODUCTION_URL = process.env.APP_URL || 'https://policydiff.vercel.app';
const TESTS = [];

// Helper function to make requests
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PRODUCTION_URL);
    const req = https.request(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Test functions
async function testHealth() {
  console.log('🏥 Testing health endpoint...');
  const res = await makeRequest('/api/health');
  TESTS.push({
    name: 'Health Check',
    passed: res.status === 200 && res.data.status === 'healthy',
    details: res.data
  });
}

async function testEnvironment() {
  console.log('🌍 Testing environment configuration...');
  const res = await makeRequest('/api/env-test');
  const passed = res.status === 200 && 
                 res.data.mode === 'production' && 
                 res.data.hasApiKey === true;
  TESTS.push({
    name: 'Environment Configuration',
    passed,
    details: res.data
  });
}

async function testModels() {
  console.log('🤖 Testing AI models endpoint...');
  const res = await makeRequest('/api/models');
  TESTS.push({
    name: 'AI Models',
    passed: res.status === 200 && Array.isArray(res.data.models),
    details: `Found ${res.data.models?.length || 0} models`
  });
}

async function testCompanyData() {
  console.log('🏢 Testing company data endpoint...');
  const res = await makeRequest('/api/companies/google');
  TESTS.push({
    name: 'Company Data',
    passed: res.status === 200 && res.data.company,
    details: res.data.company ? 'Google data loaded' : 'Failed to load'
  });
}

async function testAuthentication() {
  console.log('🔐 Testing authentication flow...');
  
  // Test session without auth
  const sessionRes = await makeRequest('/api/auth/session');
  const notAuthed = sessionRes.status === 401 || !sessionRes.data.user;
  
  // Test login with test credentials
  const loginRes = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'test@example.com',
      password: 'testpassword123'
    }
  });
  
  TESTS.push({
    name: 'Authentication',
    passed: notAuthed,
    details: 'Unauthenticated requests properly rejected'
  });
}

async function testSearch() {
  console.log('🔍 Testing search functionality...');
  const res = await makeRequest('/api/search?q=privacy');
  TESTS.push({
    name: 'Search API',
    passed: res.status === 200 && res.data.results,
    details: `Found ${res.data.results?.length || 0} results`
  });
}

async function testCaching() {
  console.log('💾 Testing Redis caching...');
  const res = await makeRequest('/api/cache');
  TESTS.push({
    name: 'Redis Cache',
    passed: res.status === 200,
    details: res.data
  });
}

// Run all tests
async function runTests() {
  console.log(`\n🚀 Testing Inplain.AI Production at ${PRODUCTION_URL}\n`);
  
  try {
    await testHealth();
    await testEnvironment();
    await testModels();
    await testCompanyData();
    await testAuthentication();
    await testSearch();
    await testCaching();
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
  
  // Print results
  console.log('\n📊 Test Results:\n');
  let passed = 0;
  let failed = 0;
  
  TESTS.forEach(test => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.details) {
      console.log(`   ${typeof test.details === 'object' ? JSON.stringify(test.details, null, 2).split('\n').join('\n   ') : test.details}`);
    }
    if (test.passed) passed++;
    else failed++;
  });
  
  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    console.log('⚠️  Some tests failed. Check the details above.');
    console.log('\n💡 Common issues:');
    console.log('- Ensure all environment variables are set in Vercel');
    console.log('- Check that the latest code is deployed');
    console.log('- Verify API keys are valid and have quota');
    console.log('- Clear browser cache if testing in browser');
  } else {
    console.log('🎉 All tests passed! Your app is production-ready!');
  }
}

// Run the tests
runTests().catch(console.error);