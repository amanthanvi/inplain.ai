#!/usr/bin/env node

/**
 * Script to manually run the cron job locally for testing
 * This helps populate initial data without waiting for the scheduled run
 */

require('dotenv').config({ path: '.env.local' })

async function runCron() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in environment variables')
    process.exit(1)
  }

  console.log('🚀 Running cron job manually...')
  console.log(`📍 Target: ${baseUrl}/api/cron/monitor`)

  try {
    const response = await fetch(`${baseUrl}/api/cron/monitor`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`❌ Cron job failed with status ${response.status}`)
      console.error('Response:', text)
      process.exit(1)
    }

    const result = await response.json()
    console.log('✅ Cron job completed successfully!')
    console.log('Results:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Error running cron job:', error)
    process.exit(1)
  }
}

// Run the cron job
runCron()