#!/usr/bin/env node

/**
 * Seed script to populate initial data for PolicyDiff
 * This helps test the application without waiting for cron jobs
 */

const { createHash } = require('crypto')

// Mock environment for local testing
if (!process.env.KV_REST_API_URL) {
  console.log('⚠️  KV_REST_API_URL not set. This script requires Vercel KV to be configured.')
  console.log('Run this script with environment variables or use vercel env pull')
  process.exit(1)
}

async function seedData() {
  console.log('🌱 Starting data seed...')
  
  const companies = [
    { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy' },
    { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy' },
    { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496' },
    { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement' },
    { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/' }
  ]
  
  const { kv } = await import('@vercel/kv')
  
  for (const company of companies) {
    console.log(`\n📄 Seeding data for ${company.name}...`)
    
    // Create two snapshots to enable diff generation
    const baseContent = `Mock privacy policy content for ${company.name}. Last updated: ${new Date().toISOString()}`
    const updatedContent = `${baseContent}\n\nNew section: We have updated our data collection practices.`
    
    // First snapshot (older)
    const snapshot1 = {
      id: crypto.randomUUID(),
      slug: company.slug,
      url: company.url,
      capturedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      blobKey: `snapshots/${company.slug}/${Date.now()}-1.html`,
      contentHash: createHash('sha256').update(baseContent).digest('hex'),
      contentLength: baseContent.length,
      contentType: 'html',
      headers: {},
      status: 'processed'
    }
    
    // Second snapshot (newer)
    const snapshot2 = {
      id: crypto.randomUUID(),
      slug: company.slug,
      url: company.url,
      capturedAt: new Date().toISOString(),
      blobKey: `snapshots/${company.slug}/${Date.now()}-2.html`,
      contentHash: createHash('sha256').update(updatedContent).digest('hex'),
      contentLength: updatedContent.length,
      contentType: 'html',
      headers: {},
      status: 'processed'
    }
    
    // Save snapshots
    await kv.zadd(`snapshots:${company.slug}`, 
      { score: Date.parse(snapshot1.capturedAt), member: JSON.stringify(snapshot1) },
      { score: Date.parse(snapshot2.capturedAt), member: JSON.stringify(snapshot2) }
    )
    
    // Save content
    await kv.set(snapshot1.blobKey, baseContent, { ex: 86400 * 30 })
    await kv.set(snapshot2.blobKey, updatedContent, { ex: 86400 * 30 })
    
    // Create a diff
    const diff = {
      id: crypto.randomUUID(),
      slug: company.slug,
      fromSnapshotId: snapshot1.id,
      toSnapshotId: snapshot2.id,
      createdAt: new Date().toISOString(),
      changeCount: 5,
      changeType: 'minor',
      additions: 71,
      deletions: 0,
      diffBlobKey: `diffs/${company.slug}/${Date.now()}.json`
    }
    
    const diffContent = {
      patches: [],
      additions: 71,
      deletions: 0,
      changeCount: 5,
      changeType: 'minor',
      htmlDiff: '<p>Mock privacy policy content for ' + company.name + '.</p><ins>New section: We have updated our data collection practices.</ins>',
      fromSnapshot: snapshot1.id,
      toSnapshot: snapshot2.id,
      generatedAt: new Date().toISOString()
    }
    
    // Save diff
    await kv.zadd(`diffs:${company.slug}`,
      { score: Date.parse(diff.createdAt), member: JSON.stringify(diff) }
    )
    await kv.set(diff.diffBlobKey, JSON.stringify(diffContent), { ex: 86400 * 30 })
    
    console.log(`✅ Created 2 snapshots and 1 diff for ${company.name}`)
  }
  
  console.log('\n🎉 Seed data complete!')
  console.log('\nYou can now:')
  console.log('1. View diffs for each company')
  console.log('2. Generate AI summaries (requires OPENROUTER_API_KEY)')
  console.log('3. See timeline data')
}

// Run the seed
seedData().catch(error => {
  console.error('❌ Seed failed:', error)
  process.exit(1)
})