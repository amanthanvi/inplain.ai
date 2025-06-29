#!/usr/bin/env node

/**
 * Health check script for monitoring
 * Can be used by external monitoring services
 */

const https = require('https');
const { exit } = require('process');

const ENVIRONMENTS = {
  production: 'https://inplain.ai',
  staging: 'https://staging.inplain.ai',
  local: 'http://localhost:3000'
};

const environment = process.argv[2] || 'production';
const baseUrl = ENVIRONMENTS[environment] || ENVIRONMENTS.production;

// Health check endpoints to verify
const endpoints = [
  { path: '/api/health', expected: 200, critical: true },
  { path: '/api/health/detailed', expected: 200, critical: false },
  { path: '/', expected: 200, critical: true },
  { path: '/companies', expected: 200, critical: true },
];

let hasErrors = false;
let hasCriticalErrors = false;

async function checkEndpoint(endpoint) {
  const url = `${baseUrl}${endpoint.path}`;
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    https.get(url, (res) => {
      const duration = Date.now() - startTime;
      
      if (res.statusCode === endpoint.expected) {
        console.log(`✅ ${endpoint.path} - ${res.statusCode} (${duration}ms)`);
        resolve({ success: true, duration });
      } else {
        console.error(`❌ ${endpoint.path} - Expected ${endpoint.expected}, got ${res.statusCode} (${duration}ms)`);
        hasErrors = true;
        if (endpoint.critical) hasCriticalErrors = true;
        resolve({ success: false, duration, status: res.statusCode });
      }
    }).on('error', (err) => {
      const duration = Date.now() - startTime;
      console.error(`❌ ${endpoint.path} - Error: ${err.message} (${duration}ms)`);
      hasErrors = true;
      if (endpoint.critical) hasCriticalErrors = true;
      resolve({ success: false, duration, error: err.message });
    });
  });
}

async function runHealthChecks() {
  console.log(`🏥 Running health checks for ${environment} (${baseUrl})\n`);
  
  const results = await Promise.all(endpoints.map(checkEndpoint));
  
  // Calculate statistics
  const successCount = results.filter(r => r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = Math.round(totalDuration / results.length);
  
  console.log(`\n📊 Summary:`);
  console.log(`- Total endpoints: ${endpoints.length}`);
  console.log(`- Successful: ${successCount}`);
  console.log(`- Failed: ${endpoints.length - successCount}`);
  console.log(`- Average response time: ${avgDuration}ms`);
  
  // Detailed health check if available
  if (!hasCriticalErrors) {
    try {
      const detailedUrl = `${baseUrl}/api/health/detailed`;
      https.get(detailedUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            console.log(`\n🔍 Detailed Health Status:`);
            console.log(`- Overall: ${health.status}`);
            console.log(`- Version: ${health.version}`);
            console.log(`- Environment: ${health.environment}`);
            
            if (health.checks) {
              console.log(`\n📋 Component Status:`);
              health.checks.forEach(check => {
                const icon = check.status === 'healthy' ? '✅' : 
                           check.status === 'degraded' ? '⚠️' : '❌';
                console.log(`${icon} ${check.name}: ${check.status}${check.message ? ` - ${check.message}` : ''}`);
              });
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        });
      }).on('error', () => {
        // Ignore errors for detailed check
      });
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Exit with appropriate code
  setTimeout(() => {
    if (hasCriticalErrors) {
      console.error('\n❌ Critical health checks failed!');
      exit(2);
    } else if (hasErrors) {
      console.warn('\n⚠️ Some health checks failed');
      exit(1);
    } else {
      console.log('\n✅ All health checks passed!');
      exit(0);
    }
  }, 2000);
}

// Run the checks
runHealthChecks().catch(err => {
  console.error('Health check script error:', err);
  exit(3);
});