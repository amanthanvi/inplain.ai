#!/usr/bin/env node

/**
 * Setup script for test user accounts and initial data
 * This helps bypass authentication issues during testing
 */

const { createHash } = require('crypto');

// Check environment
if (!process.env.KV_REST_API_URL) {
  console.log('⚠️  KV_REST_API_URL not set. This script requires Vercel KV to be configured.');
  console.log('Run this script with environment variables or use: vercel env pull');
  process.exit(1);
}

// Helper function to generate user ID
function generateUserId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to generate API key
function generateApiKey() {
  const keyArray = new Uint8Array(32);
  crypto.getRandomValues(keyArray);
  const keyHex = Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pk_${keyHex}`;
}

// Simple password hash for test users (uses SHA-256 with salt)
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // For test purposes, using simple SHA-256 (production uses PBKDF2)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltHex);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

// Test users configuration
const testUsers = [
  {
    email: 'free@test.com',
    password: 'testpass123',
    name: 'Free Test User',
    tier: 'free',
    emailVerified: true,
    emailAlerts: false,
    alertFrequency: 'daily',
    customWatchlists: ['google', 'facebook'],
    usage: {
      apiCalls: 10,
      analysisCount: 5,
      lastReset: new Date()
    }
  },
  {
    email: 'premium@test.com',
    password: 'testpass123',
    name: 'Premium Test User',
    tier: 'premium',
    emailVerified: true,
    emailAlerts: true,
    alertFrequency: 'instant',
    customWatchlists: ['google', 'facebook', 'amazon', 'microsoft', 'apple'],
    webhookUrl: 'https://example.com/webhook',
    usage: {
      apiCalls: 150,
      analysisCount: 50,
      lastReset: new Date()
    }
  },
  {
    email: 'enterprise@test.com',
    password: 'testpass123',
    name: 'Enterprise Test User',
    tier: 'enterprise',
    emailVerified: true,
    emailAlerts: true,
    alertFrequency: 'instant',
    customWatchlists: ['google', 'facebook', 'amazon', 'microsoft', 'apple', 'openai', 'anthropic'],
    webhookUrl: 'https://enterprise.example.com/webhook',
    usage: {
      apiCalls: 5000,
      analysisCount: 1000,
      lastReset: new Date()
    }
  }
];

// Company test data
const companies = [
  { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy' },
  { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy' },
  { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496' },
  { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement' },
  { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/' },
  { slug: 'openai', name: 'OpenAI', url: 'https://openai.com/policies/privacy-policy' },
  { slug: 'anthropic', name: 'Anthropic', url: 'https://www.anthropic.com/privacy' }
];

async function setupTestData() {
  console.log('🚀 Starting test data setup...\n');
  
  const { kv } = await import('@vercel/kv');
  
  // Setup test users
  console.log('👥 Creating test users...');
  for (const userData of testUsers) {
    const userId = generateUserId();
    const hashedPassword = await hashPassword(userData.password);
    
    const user = {
      id: userId,
      email: userData.email,
      name: userData.name,
      tier: userData.tier,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: userData.emailVerified,
      emailAlerts: userData.emailAlerts,
      alertFrequency: userData.alertFrequency,
      customWatchlists: userData.customWatchlists,
      webhookUrl: userData.webhookUrl,
      usage: userData.usage
    };
    
    // Generate API key for premium/enterprise users
    if (userData.tier !== 'free') {
      const apiKey = generateApiKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      const hashedKey = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
      
      user.apiKey = hashedKey;
      await kv.set(`apikey:${hashedKey}`, userId);
      
      console.log(`   📝 API Key for ${userData.email}: ${apiKey}`);
    }
    
    // Store user data
    await kv.hset(`user:${userId}`, user);
    await kv.set(`user:email:${userData.email}`, userId);
    await kv.set(`user:password:${userId}`, hashedPassword);
    
    console.log(`   ✅ Created user: ${userData.email} (tier: ${userData.tier})`);
  }
  
  console.log('\n📄 Seeding policy data...');
  
  // Create policy snapshots and diffs for each company
  for (const company of companies) {
    console.log(`\n   🏢 Setting up data for ${company.name}...`);
    
    // Create multiple snapshots to show history
    const snapshots = [];
    const now = Date.now();
    
    for (let i = 0; i < 5; i++) {
      const daysAgo = i * 7; // One snapshot per week
      const captureTime = new Date(now - (daysAgo * 24 * 60 * 60 * 1000));
      
      // Simulate evolving content
      const baseContent = `
<h1>${company.name} Privacy Policy</h1>
<p>Last updated: ${captureTime.toISOString().split('T')[0]}</p>

<h2>Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, 
make a purchase, or contact us for support.</p>

<h2>How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services.</p>
`;

      const additions = i === 0 ? '' : `
<h2>New Section ${5 - i}: Data Sharing Practices</h2>
<p>We have updated our data sharing practices to be more transparent about how we share 
your information with third parties. This change was made on ${captureTime.toISOString().split('T')[0]}.</p>

<h3>Third Party Services</h3>
<ul>
  <li>Analytics providers</li>
  <li>Payment processors</li>
  <li>Marketing partners (with your consent)</li>
</ul>
`;

      const content = baseContent + additions;
      const contentHash = createHash('sha256').update(content).digest('hex');
      
      const snapshot = {
        id: crypto.randomUUID(),
        slug: company.slug,
        url: company.url,
        capturedAt: captureTime.toISOString(),
        blobKey: `snapshots/${company.slug}/${captureTime.getTime()}.html`,
        contentHash: contentHash,
        contentLength: content.length,
        contentType: 'html',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'last-modified': captureTime.toUTCString()
        },
        status: 'processed'
      };
      
      snapshots.push(snapshot);
      
      // Store snapshot
      await kv.zadd(`snapshots:${company.slug}`, 
        { score: captureTime.getTime(), member: JSON.stringify(snapshot) }
      );
      
      // Store content
      await kv.set(snapshot.blobKey, content, { ex: 86400 * 90 }); // 90 days
    }
    
    console.log(`      ✅ Created ${snapshots.length} snapshots`);
    
    // Create diffs between consecutive snapshots
    let diffsCreated = 0;
    for (let i = 0; i < snapshots.length - 1; i++) {
      const fromSnapshot = snapshots[i + 1];
      const toSnapshot = snapshots[i];
      
      const diff = {
        id: crypto.randomUUID(),
        slug: company.slug,
        fromSnapshotId: fromSnapshot.id,
        toSnapshotId: toSnapshot.id,
        createdAt: toSnapshot.capturedAt,
        changeCount: i === snapshots.length - 2 ? 0 : Math.floor(Math.random() * 10) + 1,
        changeType: i === snapshots.length - 2 ? 'none' : (i < 2 ? 'major' : 'minor'),
        additions: i === snapshots.length - 2 ? 0 : Math.floor(Math.random() * 100) + 50,
        deletions: Math.floor(Math.random() * 20),
        diffBlobKey: `diffs/${company.slug}/${Date.now()}-${i}.json`
      };
      
      const diffContent = {
        patches: [],
        additions: diff.additions,
        deletions: diff.deletions,
        changeCount: diff.changeCount,
        changeType: diff.changeType,
        htmlDiff: i === snapshots.length - 2 ? 
          '<p>No changes detected</p>' :
          `<p>Privacy policy updated on ${toSnapshot.capturedAt}</p>
           <ins>New Section ${5 - i}: Data Sharing Practices - We have updated our data sharing practices...</ins>`,
        fromSnapshot: fromSnapshot.id,
        toSnapshot: toSnapshot.id,
        generatedAt: new Date().toISOString()
      };
      
      // Store diff
      await kv.zadd(`diffs:${company.slug}`,
        { score: Date.parse(diff.createdAt), member: JSON.stringify(diff) }
      );
      await kv.set(diff.diffBlobKey, JSON.stringify(diffContent), { ex: 86400 * 90 });
      
      diffsCreated++;
    }
    
    console.log(`      ✅ Created ${diffsCreated} diffs`);
    
    // Create AI analysis for recent changes
    if (diffsCreated > 0) {
      const latestDiff = {
        slug: company.slug,
        analysis: {
          summary: `${company.name} has updated their privacy policy with new sections on data sharing practices and third-party services.`,
          keyChanges: [
            'Added transparency about third-party data sharing',
            'Clarified analytics provider relationships',
            'Updated consent requirements for marketing partners'
          ],
          impactScore: 7,
          recommendation: 'Review the new data sharing sections to understand how your information may be shared with third parties.',
          generatedAt: new Date().toISOString()
        }
      };
      
      await kv.set(`analysis:${company.slug}:latest`, JSON.stringify(latestDiff.analysis), { ex: 86400 * 30 });
      console.log(`      ✅ Created AI analysis`);
    }
  }
  
  // Create sample watchlists for premium users
  console.log('\n📋 Creating sample watchlists...');
  
  const watchlists = [
    {
      id: crypto.randomUUID(),
      name: 'Big Tech Privacy',
      description: 'Monitor privacy policy changes for major tech companies',
      companies: ['google', 'facebook', 'amazon', 'microsoft', 'apple'],
      createdBy: 'premium@test.com',
      isPublic: true,
      createdAt: new Date()
    },
    {
      id: crypto.randomUUID(),
      name: 'AI Companies',
      description: 'Track privacy policies of AI companies',
      companies: ['openai', 'anthropic', 'google'],
      createdBy: 'enterprise@test.com',
      isPublic: true,
      createdAt: new Date()
    }
  ];
  
  for (const watchlist of watchlists) {
    await kv.hset(`watchlist:${watchlist.id}`, watchlist);
    await kv.sadd(`watchlists:public`, watchlist.id);
    console.log(`   ✅ Created watchlist: ${watchlist.name}`);
  }
  
  // Create sample alerts for premium users
  console.log('\n🔔 Creating sample alerts...');
  
  const alerts = [
    {
      id: crypto.randomUUID(),
      userId: 'premium-user-id',
      type: 'policy_change',
      company: 'google',
      title: 'Google Privacy Policy Updated',
      message: 'Google has made significant changes to their data collection practices.',
      severity: 'high',
      read: false,
      createdAt: new Date(Date.now() - 86400000) // 1 day ago
    },
    {
      id: crypto.randomUUID(),
      userId: 'enterprise-user-id',
      type: 'watchlist_update',
      watchlistId: watchlists[1].id,
      title: 'AI Companies Watchlist Update',
      message: '2 companies in your watchlist have updated their policies this week.',
      severity: 'medium',
      read: false,
      createdAt: new Date(Date.now() - 172800000) // 2 days ago
    }
  ];
  
  for (const alert of alerts) {
    await kv.zadd(`alerts:${alert.userId}`,
      { score: Date.parse(alert.createdAt), member: JSON.stringify(alert) }
    );
    console.log(`   ✅ Created alert: ${alert.title}`);
  }
  
  console.log('\n✨ Test data setup complete!\n');
  console.log('📝 Test User Credentials:');
  console.log('------------------------');
  testUsers.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${user.password}`);
    console.log(`Tier: ${user.tier}`);
    console.log('------------------------');
  });
  
  console.log('\n🚀 You can now:');
  console.log('1. Login with any test user account');
  console.log('2. View policy changes and diffs');
  console.log('3. Test premium features with premium/enterprise accounts');
  console.log('4. Access API with generated API keys (shown above)');
  console.log('5. Test watchlists and alerts functionality');
}

// Run the setup
setupTestData().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});