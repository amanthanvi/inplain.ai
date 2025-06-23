#!/usr/bin/env node

/**
 * Test script to verify API routes work with missing environment variables
 * Run with: node scripts/test-api-routes.js
 */

const http = require('http');
const https = require('https');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function fetchJSON(path, options = {}) {
  const url = new URL(path, API_BASE);
  const protocol = url.protocol === 'https:' ? https : http;
  
  return new Promise((resolve, reject) => {
    const req = protocol.request(url, {
      method: options.method || 'GET',
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
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data });
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

async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const result = await fetchJSON('/api/health');
    console.log('Status:', result.status);
    console.log('Mode:', result.data.mode);
    console.log('Services:', result.data.services);
    console.log('Environment:', result.data.environment);
    console.log('✅ Health endpoint working');
  } catch (error) {
    console.error('❌ Health endpoint failed:', error.message);
  }
}

async function testSnapshotEndpoint() {
  console.log('\n📸 Testing Snapshot Endpoint...');
  try {
    const result = await fetchJSON('/api/snapshot/google');
    console.log('Status:', result.status);
    
    if (result.data._mock) {
      console.log('✅ Mock data returned (expected when storage not configured)');
      console.log('Mock snapshot ID:', result.data.snapshot.id);
    } else if (result.data.snapshot) {
      console.log('✅ Real snapshot data returned');
      console.log('Snapshot ID:', result.data.snapshot.id);
      console.log('Content length:', result.data.content.characterCount);
    } else if (result.data.error) {
      console.log('⚠️  Error response:', result.data.error);
      console.log('Message:', result.data.message);
      console.log('Code:', result.data.code);
    }
  } catch (error) {
    console.error('❌ Snapshot endpoint failed:', error.message);
  }
}

async function testSummaryEndpoint() {
  console.log('\n📝 Testing Summary Endpoint...');
  try {
    const result = await fetchJSON('/api/summary/google', {
      method: 'POST',
      body: {
        diffId: '123e4567-e89b-12d3-a456-426614174000',
        force: false
      }
    });
    
    console.log('Status:', result.status);
    
    if (result.data.mockMode) {
      console.log('✅ Mock summary returned (expected when AI not configured)');
      console.log('Model:', result.data.summary.model);
      console.log('Risk level:', result.data.summary.riskLevel);
      console.log('Warning:', result.data.warning);
    } else if (result.data.summary) {
      console.log('✅ Real summary generated');
      console.log('Model:', result.data.summary.model);
      console.log('Tokens used:', result.data.summary.tokensUsed);
    } else if (result.data.error) {
      console.log('⚠️  Error response:', result.data.error);
      console.log('Message:', result.data.message);
      console.log('Code:', result.data.code);
    }
  } catch (error) {
    console.error('❌ Summary endpoint failed:', error.message);
  }
}

async function testDevAuth() {
  console.log('\n🔐 Testing Dev Auth...');
  
  if (process.env.NODE_ENV !== 'development') {
    console.log('⏭️  Skipping dev auth test (not in development mode)');
    return;
  }
  
  try {
    const result = await fetchJSON('/api/debug/dev-auth');
    console.log('Status:', result.status);
    console.log('Dev auth enabled:', result.data.devAuth.enabled);
    if (result.data.currentUser) {
      console.log('Current user:', result.data.currentUser.email);
    }
    console.log('✅ Dev auth endpoint working');
  } catch (error) {
    console.error('❌ Dev auth endpoint failed:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing API Routes with Environment Handling');
  console.log('API Base:', API_BASE);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  await testHealthEndpoint();
  await testSnapshotEndpoint();
  await testSummaryEndpoint();
  await testDevAuth();
  
  console.log('\n✨ All tests completed!');
}

// Run tests
runTests().catch(console.error);