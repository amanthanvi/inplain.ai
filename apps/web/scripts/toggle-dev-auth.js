#!/usr/bin/env node

/**
 * Script to toggle development authentication bypass
 * Usage: npm run dev:auth:on or npm run dev:auth:off
 */

const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const envFile = path.join(__dirname, '..', '.env.local');

// Read current .env.local or create if it doesn't exist
let envContent = '';
if (fs.existsSync(envFile)) {
  envContent = fs.readFileSync(envFile, 'utf8');
}

// Parse env vars
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Update dev auth setting
if (action === 'on') {
  envVars['NEXT_PUBLIC_DEV_AUTH_BYPASS'] = 'true';
  console.log('✅ Development authentication bypass ENABLED');
  console.log('⚠️  WARNING: This should NEVER be used in production!');
  console.log('');
  console.log('Dev user credentials:');
  console.log('  Email: dev@example.com');
  console.log('  Tier: Enterprise (full access)');
  console.log('');
  console.log('To disable: npm run dev:auth:off');
} else if (action === 'off') {
  delete envVars['NEXT_PUBLIC_DEV_AUTH_BYPASS'];
  console.log('🔒 Development authentication bypass DISABLED');
  console.log('Normal authentication is now required.');
} else {
  console.log('Usage: node toggle-dev-auth.js [on|off]');
  process.exit(1);
}

// Write back to .env.local
const newEnvContent = Object.entries(envVars)
  .filter(([key, value]) => value !== undefined)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(envFile, newEnvContent + '\n');

console.log('');
console.log('📝 Updated .env.local');
console.log('🔄 Restart your development server for changes to take effect');