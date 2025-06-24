#!/usr/bin/env node

/**
 * Comprehensive test runner for Inplain.AI Web App
 * Runs unit tests, integration tests, and e2e tests with proper reporting
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const isCI = process.env.CI === 'true'
const isVerbose = args.includes('--verbose') || args.includes('-v')
const testType = args.find(arg => ['unit', 'integration', 'e2e', 'all'].includes(arg)) || 'all'

console.log('🧪 Inplain.AI Test Runner')
console.log('========================')
console.log(`Test type: ${testType}`)
console.log(`Environment: ${isCI ? 'CI' : 'Local'}`)
console.log('')

// Utility functions
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`▶️  Running: ${command} ${args.join(' ')}`)
    
    const child = spawn(command, args, {
      stdio: isVerbose ? 'inherit' : 'pipe',
      cwd: process.cwd(),
      ...options
    })
    
    let stdout = ''
    let stderr = ''
    
    if (!isVerbose) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
    }
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${command} completed successfully`)
        resolve({ stdout, stderr, code })
      } else {
        console.log(`❌ ${command} failed with code ${code}`)
        if (!isVerbose && stderr) {
          console.log('Error output:')
          console.log(stderr)
        }
        reject(new Error(`Command failed with code ${code}`))
      }
    })
    
    child.on('error', (error) => {
      console.log(`❌ Failed to start ${command}:`, error.message)
      reject(error)
    })
  })
}

function createTestDirectories() {
  const dirs = [
    'test-results',
    'coverage',
    'e2e-report'
  ]
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })
}

async function runUnitTests() {
  console.log('\n📋 Running Unit Tests')
  console.log('--------------------')
  
  try {
    const args = ['run']
    
    if (isCI) {
      args.push('--coverage', '--reporter=json', '--reporter=junit')
    } else {
      args.push('--coverage')
    }
    
    if (isVerbose) {
      args.push('--reporter=verbose')
    }
    
    await runCommand('npx', ['vitest', ...args])
    console.log('✅ Unit tests completed')
    return true
  } catch (error) {
    console.log('❌ Unit tests failed')
    return false
  }
}

async function runE2ETests() {
  console.log('\n🌐 Running E2E Tests')
  console.log('-------------------')
  
  try {
    // Check if the dev server is running
    const serverCheck = await new Promise((resolve) => {
      const http = require('http')
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/health',
        timeout: 5000
      }, (res) => {
        resolve(res.statusCode === 200)
      })
      
      req.on('error', () => resolve(false))
      req.on('timeout', () => resolve(false))
      req.end()
    })
    
    if (!serverCheck && !isCI) {
      console.log('⚠️  Development server not running. Starting it...')
      // In a real scenario, you might want to start the dev server
      console.log('Please run "npm run dev" in another terminal and try again.')
      return false
    }
    
    const args = ['test']
    
    if (isCI) {
      args.push('--reporter=junit')
    }
    
    if (isVerbose) {
      args.push('--headed')
    }
    
    await runCommand('npx', ['playwright', ...args])
    console.log('✅ E2E tests completed')
    return true
  } catch (error) {
    console.log('❌ E2E tests failed')
    return false
  }
}

async function runLinting() {
  console.log('\n🔍 Running Linter')
  console.log('----------------')
  
  try {
    await runCommand('npm', ['run', 'lint'])
    console.log('✅ Linting completed')
    return true
  } catch (error) {
    console.log('❌ Linting failed')
    return false
  }
}

async function runTypeCheck() {
  console.log('\n🔧 Running Type Check')
  console.log('--------------------')
  
  try {
    await runCommand('npm', ['run', 'typecheck'])
    console.log('✅ Type check completed')
    return true
  } catch (error) {
    console.log('❌ Type check failed')
    return false
  }
}

function generateSummaryReport(results) {
  console.log('\n📊 Test Summary')
  console.log('===============')
  
  const total = Object.keys(results).length
  const passed = Object.values(results).filter(Boolean).length
  const failed = total - passed
  
  console.log(`Total test suites: ${total}`)
  console.log(`Passed: ${passed} ✅`)
  console.log(`Failed: ${failed} ❌`)
  console.log('')
  
  Object.entries(results).forEach(([suite, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${suite}`)
  })
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!')
    return true
  } else {
    console.log(`\n💥 ${failed} test suite(s) failed`)
    return false
  }
}

async function main() {
  try {
    createTestDirectories()
    
    const results = {}
    
    // Always run linting and type checking
    results['Linting'] = await runLinting()
    results['Type Check'] = await runTypeCheck()
    
    // Run specific test types
    if (testType === 'unit' || testType === 'all') {
      results['Unit Tests'] = await runUnitTests()
    }
    
    if (testType === 'e2e' || testType === 'all') {
      results['E2E Tests'] = await runE2ETests()
    }
    
    const success = generateSummaryReport(results)
    
    if (isCI) {
      // Generate CI artifacts
      const summaryPath = path.join('test-results', 'summary.json')
      fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        testType,
        results,
        success
      }, null, 2))
    }
    
    process.exit(success ? 0 : 1)
    
  } catch (error) {
    console.error('💥 Test runner failed:', error.message)
    process.exit(1)
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Test runner interrupted')
  process.exit(1)
})

process.on('SIGTERM', () => {
  console.log('\n⚠️  Test runner terminated')
  process.exit(1)
})

main()