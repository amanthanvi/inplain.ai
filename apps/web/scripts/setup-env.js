#!/usr/bin/env node

/**
 * Interactive setup script for PolicyDiff environment configuration
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const crypto = require('crypto')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const ENV_PATH = path.join(__dirname, '..', '.env.local')
const ENV_EXAMPLE_PATH = path.join(__dirname, '..', '.env.example')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
}

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

function generateSecret() {
  return crypto.randomBytes(32).toString('base64')
}

async function main() {
  console.log(`${colors.bright}${colors.blue}PolicyDiff Environment Setup${colors.reset}\n`)

  // Check if .env.local already exists
  if (fs.existsSync(ENV_PATH)) {
    const overwrite = await prompt(
      `${colors.yellow}⚠️  .env.local already exists. Overwrite? (y/N): ${colors.reset}`
    )
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.')
      process.exit(0)
    }
  }

  console.log('\nThis setup will help you configure PolicyDiff for:\n')
  console.log('  1. Demo Mode (no API keys required)')
  console.log('  2. Full Mode (with AI features)\n')

  const mode = await prompt('Choose mode (1 for Demo, 2 for Full): ')

  const envVars = {}

  if (mode === '2') {
    console.log(`\n${colors.bright}Full Mode Setup${colors.reset}\n`)

    // OpenRouter API Key
    console.log(`${colors.blue}OpenRouter API Key${colors.reset}`)
    console.log('Get your key at: https://openrouter.ai/keys')
    envVars.OPENROUTER_API_KEY = await prompt('Enter your OpenRouter API key: ')

    // Vercel KV (optional)
    console.log(`\n${colors.blue}Vercel KV Storage (optional)${colors.reset}`)
    console.log('Leave blank to use in-memory storage (data won\'t persist)')
    const hasKV = await prompt('Do you have Vercel KV configured? (y/N): ')
    
    if (hasKV.toLowerCase() === 'y') {
      envVars.KV_REST_API_URL = await prompt('Enter KV REST API URL: ')
      envVars.KV_REST_API_TOKEN = await prompt('Enter KV REST API Token: ')
    }

    // Email Service (optional)
    console.log(`\n${colors.blue}Email Alerts (optional)${colors.reset}`)
    console.log('Uses Resend for email notifications')
    const hasEmail = await prompt('Configure email alerts? (y/N): ')
    
    if (hasEmail.toLowerCase() === 'y') {
      envVars.RESEND_API_KEY = await prompt('Enter Resend API key: ')
      envVars.EMAIL_FROM = await prompt('Enter sender email: ')
    }
  } else {
    console.log(`\n${colors.bright}Demo Mode Setup${colors.reset}`)
    console.log('No API keys required - using mock data\n')
  }

  // Always generate security tokens
  console.log(`${colors.green}Generating security tokens...${colors.reset}`)
  envVars.JWT_SECRET = generateSecret()
  envVars.CRON_SECRET = generateSecret()

  // Set default values
  envVars.DEFAULT_AI_MODEL = 'google/gemini-2.0-flash-exp:free'
  envVars.NODE_ENV = 'development'

  // Create .env.local content
  let envContent = '# PolicyDiff Environment Configuration\n'
  envContent += `# Generated on ${new Date().toISOString()}\n\n`

  if (mode === '1') {
    envContent += '# Running in Demo Mode - No API keys configured\n\n'
  }

  // Read example file for structure
  const exampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8')
  const exampleLines = exampleContent.split('\n')

  // Build env file with comments from example
  let currentSection = ''
  exampleLines.forEach(line => {
    if (line.startsWith('#') || line.trim() === '') {
      envContent += line + '\n'
      currentSection = line
    } else if (line.includes('=')) {
      const [key] = line.split('=')
      if (envVars[key] !== undefined) {
        envContent += `${key}=${envVars[key]}\n`
      } else if (mode === '1' && key === 'OPENROUTER_API_KEY') {
        envContent += `# ${key}=not-configured-demo-mode\n`
      } else {
        envContent += `# ${line}\n`
      }
    }
  })

  // Write the file
  fs.writeFileSync(ENV_PATH, envContent)

  console.log(`\n${colors.green}✅ Environment configuration saved to .env.local${colors.reset}`)

  if (mode === '1') {
    console.log(`\n${colors.yellow}📝 Demo Mode Notes:${colors.reset}`)
    console.log('- AI analysis will use mock data')
    console.log('- Data persistence is limited')
    console.log('- Perfect for testing and development')
    console.log('\nTo enable full features later, run this setup again and choose Full Mode.')
  } else {
    console.log(`\n${colors.green}✅ Full Mode Configured${colors.reset}`)
    console.log('\nNext steps:')
    console.log('1. Start the development server: npm run dev')
    console.log('2. Visit http://localhost:3000')
    
    if (!envVars.KV_REST_API_URL) {
      console.log(`\n${colors.yellow}Note: Using in-memory storage. Data won't persist between restarts.${colors.reset}`)
    }
  }

  console.log(`\n${colors.blue}Happy monitoring! 🔍${colors.reset}\n`)

  rl.close()
}

main().catch(error => {
  console.error(`${colors.red}Setup failed:${colors.reset}`, error)
  process.exit(1)
})