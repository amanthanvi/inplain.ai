#!/usr/bin/env node

/**
 * Test script to verify all AI analysis enhancements
 */

const { ContentExtractor } = require('../src/lib/content-extractor')
const { formatAnalysisToMarkdown } = require('../src/lib/analysis-formatter')
const { ANALYSIS_PROMPTS, PROMPT_OPTIMIZATION } = require('../src/lib/prompts')

// Sample HTML content for testing
const sampleHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Privacy Policy - Example Corp</title>
  <script>console.log('tracking script')</script>
  <style>body { font-family: Arial; }</style>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
  </nav>
  
  <main>
    <h1>Privacy Policy</h1>
    <p>Last updated: January 15, 2024</p>
    
    <h2>Information We Collect</h2>
    <p>We collect personal information such as your name, email address, and phone number when you register for our services.</p>
    
    <h2>How We Use Your Data</h2>
    <p>We use your data to provide and improve our services, communicate with you, and comply with legal obligations.</p>
    
    <h2>Data Sharing</h2>
    <p>We may share your information with service providers, business partners, and as required by law.</p>
    
    <h2>Your Rights</h2>
    <p>You have the right to access, correct, delete, and port your personal data. You can also opt out of certain uses.</p>
    
    <h2>Contact Us</h2>
    <p>If you have questions about this privacy policy, please contact us at privacy@example.com</p>
  </main>
  
  <footer>
    <p>&copy; 2024 Example Corp. All rights reserved.</p>
  </footer>
</body>
</html>
`

console.log('🧪 Testing Inplain.AI AI Enhancements\n')

// Test 1: Content Extraction
console.log('1️⃣ Testing Content Extraction...')
try {
  const extracted = ContentExtractor.extract(sampleHTML)
  console.log('✅ Content extracted successfully')
  console.log(`   - Title: ${extracted.title || 'Not found'}`)
  console.log(`   - Sections: ${extracted.sections.length}`)
  console.log(`   - Word count: ${extracted.metadata.wordCount}`)
  console.log(`   - Last updated: ${extracted.metadata.lastUpdated || 'Not found'}`)
  console.log(`   - Is privacy policy: ${ContentExtractor.isPrivacyPolicy(extracted.text)}`)
} catch (error) {
  console.error('❌ Content extraction failed:', error.message)
}

// Test 2: Structured Analysis Format
console.log('\n2️⃣ Testing Structured Analysis Format...')
try {
  const mockAnalysis = {
    executive_summary: "Example Corp's privacy policy outlines basic data collection and usage practices with standard user rights.",
    key_highlights: [
      "Collects personal information including name, email, and phone",
      "Shares data with service providers and partners",
      "Provides standard GDPR-like rights",
      "Contact email provided for privacy inquiries"
    ],
    data_collected: {
      personal_info: ["name", "email", "phone number"],
      usage_data: [],
      device_data: [],
      third_party_data: []
    },
    user_rights: [
      "Access your personal data",
      "Correct inaccurate data",
      "Delete your data",
      "Port your data"
    ],
    data_sharing: {
      with_whom: ["service providers", "business partners"],
      purposes: ["service delivery", "legal compliance"],
      opt_out_available: true
    },
    retention_period: "Not specified",
    security_measures: "Not explicitly mentioned",
    cookies_tracking: {
      uses_cookies: false,
      tracking_technologies: [],
      third_party_analytics: false
    },
    gdpr_compliant: "unclear",
    ccpa_compliant: "unclear",
    contact_info: "privacy@example.com",
    notable_concerns: [
      "No specific retention period mentioned",
      "Security measures not detailed"
    ],
    positive_aspects: [
      "Clear list of user rights",
      "Contact information provided"
    ],
    overall_privacy_score: "fair",
    recommendations: [
      "Review data sharing practices before signing up",
      "Contact them to clarify retention periods"
    ]
  }
  
  const markdown = formatAnalysisToMarkdown(mockAnalysis)
  console.log('✅ Markdown formatting successful')
  console.log(`   - Output length: ${markdown.length} characters`)
  console.log(`   - Contains collapsible sections: ${markdown.includes(':::collapsible')}`)
  console.log(`   - Contains emoji indicators: ${markdown.includes('🔍')}`)
} catch (error) {
  console.error('❌ Markdown formatting failed:', error.message)
}

// Test 3: Prompt Optimization
console.log('\n3️⃣ Testing Prompt Optimization...')
try {
  const metadata = 'Company: Google\nTitle: Privacy Policy\nWord Count: 5000'
  const sections = '- Information We Collect\n- How We Use Information'
  const content = 'Sample privacy policy content...'
  
  const prompt = ANALYSIS_PROMPTS.comprehensive(metadata, sections, content)
  console.log('✅ Comprehensive prompt generated')
  console.log(`   - Prompt length: ${prompt.length} characters`)
  console.log(`   - Contains JSON structure: ${prompt.includes('"executive_summary"')}`)
  
  // Test model selection
  const availableModels = ['openai/gpt-4o-mini', 'google/gemini-2.0-flash', 'meta-llama/llama-3.3-70b-instruct']
  const { selectBestModel } = require('../src/lib/prompts')
  const bestModel = selectBestModel('comprehensive', availableModels)
  console.log(`   - Best model selected: ${bestModel}`)
  
  // Test temperature settings
  console.log(`   - Structured analysis temperature: ${PROMPT_OPTIMIZATION.temperatures.structured}`)
  console.log(`   - Max tokens for comprehensive: ${PROMPT_OPTIMIZATION.maxTokens.comprehensive}`)
} catch (error) {
  console.error('❌ Prompt optimization failed:', error.message)
}

// Test 4: Error Handling
console.log('\n4️⃣ Testing Error Handling...')
try {
  // Test with invalid HTML
  const invalidExtracted = ContentExtractor.extract('<div>Not a privacy policy</div>')
  const isPrivacy = ContentExtractor.isPrivacyPolicy(invalidExtracted.text)
  console.log(`✅ Non-privacy content correctly identified: ${!isPrivacy}`)
  
  // Test with empty content
  const emptyExtracted = ContentExtractor.extract('')
  console.log(`✅ Empty content handled: ${emptyExtracted.text.length === 0}`)
} catch (error) {
  console.error('❌ Error handling failed:', error.message)
}

console.log('\n✨ Enhancement testing complete!')
console.log('\nNext steps:')
console.log('1. Deploy changes: git add -A && git commit -m "feat: enhance AI analysis" && git push')
console.log('2. Test in production: curl -X POST https://policydiff.vercel.app/api/analyze/google')
console.log('3. Monitor for any errors in Vercel logs')