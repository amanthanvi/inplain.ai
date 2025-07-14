#!/usr/bin/env node

/**
 * Populate company data in KV storage
 */

const { WATCHED_COMPANIES } = require('@inplain.ai/shared')

// Check environment
if (!process.env.KV_REST_API_URL) {
  console.log('⚠️  KV_REST_API_URL not set. This script requires Vercel KV to be configured.')
  console.log('Run this script with environment variables or use vercel env pull')
  process.exit(1)
}

async function populateCompanies() {
  console.log('🏢 Starting company data population...')
  
  const { kv } = await import('@vercel/kv')
  
  // Store each company
  for (const company of WATCHED_COMPANIES) {
    const key = `company:${company.slug}`
    await kv.set(key, company, { ex: 86400 * 30 }) // 30 days expiry
    console.log(`✅ Stored ${company.name} (${company.slug})`)
  }
  
  // Store the company list
  await kv.set('companies:list', WATCHED_COMPANIES, { ex: 86400 * 30 })
  console.log(`\n✅ Stored company list with ${WATCHED_COMPANIES.length} companies`)
  
  console.log('\n🎉 Company data population complete!')
}

// Run the script
populateCompanies().catch(error => {
  console.error('❌ Population failed:', error)
  process.exit(1)
})