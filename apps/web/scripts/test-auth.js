#!/usr/bin/env node

/**
 * Test authentication with the created test users
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testLogin(email, password) {
  console.log(`\n🔐 Testing login for ${email}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Login successful!`);
      console.log(`   User: ${data.user.name}`);
      console.log(`   Tier: ${data.user.tier}`);
      console.log(`   Email Verified: ${data.user.emailVerified}`);
      
      // Extract session cookie for further testing
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        const sessionMatch = cookies.match(/session=([^;]+)/);
        if (sessionMatch) {
          console.log(`   Session Token: ${sessionMatch[1].substring(0, 20)}...`);
        }
      }
      
      return { success: true, user: data.user, response };
    } else {
      console.log(`❌ Login failed: ${data.message}`);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testProtectedRoute(sessionCookie) {
  console.log(`\n🔒 Testing protected route access...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/watchlists`, {
      headers: {
        'Cookie': sessionCookie,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Protected route access successful!`);
      console.log(`   Watchlists found: ${data.watchlists?.length || 0}`);
    } else {
      console.log(`❌ Protected route access failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting authentication tests...');
  console.log(`📍 API URL: ${API_BASE_URL}`);
  
  const testAccounts = [
    { email: 'free@test.com', password: 'testpass123' },
    { email: 'premium@test.com', password: 'testpass123' },
    { email: 'enterprise@test.com', password: 'testpass123' },
    { email: 'invalid@test.com', password: 'wrongpass' }, // Should fail
  ];
  
  for (const account of testAccounts) {
    const result = await testLogin(account.email, account.password);
    
    // Test protected route with successful login
    if (result.success && result.response) {
      const cookies = result.response.headers.get('set-cookie');
      if (cookies) {
        await testProtectedRoute(cookies);
      }
    }
  }
  
  console.log('\n✨ Authentication tests complete!');
}

// Check if running directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testLogin, testProtectedRoute };