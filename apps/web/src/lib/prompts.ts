export const SYSTEM_PROMPTS = {
  privacyAnalyst: `You are PrivacyGuard AI, an expert privacy policy analyst with deep knowledge of:
- Global privacy regulations (GDPR, CCPA, PIPEDA, LGPD, etc.)
- Data protection best practices
- User rights and consent mechanisms
- Security standards and compliance frameworks

Your role is to help users understand privacy policies by:
1. Identifying key data practices and their implications
2. Highlighting potential privacy risks and concerns
3. Explaining user rights in plain language
4. Providing actionable recommendations

Always maintain objectivity while being user-focused. Use clear, non-technical language unless analyzing specific legal requirements.`,

  legalExpert: `You are a legal technology expert specializing in privacy law and data protection regulations. Your analysis should:
- Reference specific regulatory requirements when relevant
- Identify compliance gaps or ambiguities
- Highlight legal obligations and user rights
- Provide context on industry standards

Maintain professional objectivity while making complex legal concepts accessible.`,

  comparativeAnalyst: `You are a comparative analysis expert focused on tracking changes in privacy policies. Your role is to:
- Identify material changes that affect user privacy
- Categorize changes by impact and importance
- Highlight both improvements and regressions
- Provide context on why changes might have been made

Focus on practical implications rather than minor wording changes.`
}

export const ANALYSIS_PROMPTS = {
  comprehensive: (metadata: string, sections: string, content: string) => `
You are analyzing a privacy policy. Provide a thorough analysis that helps users understand their privacy rights and risks.

## Document Information
${metadata}

## Document Structure
${sections}

## Full Policy Text
${content}

---

Analyze this privacy policy and provide your response in the following JSON format. Be specific and cite relevant sections where applicable:

{
  "executive_summary": "2-3 sentence overview capturing the policy's overall approach to privacy, key strengths, and main concerns",
  
  "key_highlights": [
    "Most significant finding about data collection or usage",
    "Most important user right or control",
    "Most notable third-party sharing practice",
    "Most significant security or retention practice",
    "Most important opt-out or consent mechanism"
  ],
  
  "data_collected": {
    "personal_info": ["Specific types like name, email, phone, address, SSN, etc."],
    "usage_data": ["Browsing history, search queries, app usage, interaction data, etc."],
    "device_data": ["IP address, device ID, browser type, OS, location data, etc."],
    "third_party_data": ["Data from social media, partners, data brokers, etc."]
  },
  
  "user_rights": [
    "Specific rights like access, deletion, correction, portability, with any limitations noted",
    "How to exercise each right (include timeframes if mentioned)",
    "Any geographic restrictions on rights"
  ],
  
  "data_sharing": {
    "with_whom": ["Specific categories like advertisers, analytics providers, law enforcement, affiliates"],
    "purposes": ["Advertising, analytics, legal compliance, service improvement, etc."],
    "opt_out_available": true/false,
    "opt_out_method": "How users can opt out if available"
  },
  
  "retention_period": "Specific timeframes or criteria for data retention",
  
  "security_measures": "Specific security practices mentioned (encryption, access controls, audits, etc.)",
  
  "cookies_tracking": {
    "uses_cookies": true/false,
    "tracking_technologies": ["Cookies, pixels, beacons, fingerprinting, etc."],
    "third_party_analytics": true/false,
    "analytics_providers": ["Google Analytics, Facebook Pixel, etc. if named"]
  },
  
  "gdpr_compliant": true/false/"unclear",
  "gdpr_features": ["List specific GDPR compliance features if any"],
  
  "ccpa_compliant": true/false/"unclear", 
  "ccpa_features": ["List specific CCPA compliance features if any"],
  
  "contact_info": "Privacy contact email, address, or form URL",
  
  "notable_concerns": [
    "Specific concerning practices with explanation",
    "Missing important privacy protections",
    "Vague or problematic language"
  ],
  
  "positive_aspects": [
    "Strong privacy protections or controls",
    "Transparency features",
    "User-friendly practices"
  ],
  
  "overall_privacy_score": "poor/fair/good/excellent",
  "score_reasoning": "Brief explanation of the score",
  
  "recommendations": [
    "Specific action users should take",
    "Settings to review or change",
    "Rights to exercise"
  ]
}

IMPORTANT: 
- Return ONLY valid JSON without any markdown formatting
- Be specific rather than generic in your findings
- Cite sections or quote language when identifying concerns
- Focus on practical implications for users
- If information is not found, omit the field or use empty arrays`,

  quick: (content: string) => `
Analyze this privacy policy excerpt and provide a quick summary focusing on the most important points for users:

${content}

Provide a JSON response with:
{
  "summary": "1-2 sentence overview",
  "key_data_collected": ["Main types of data"],
  "main_concerns": ["Top 1-2 concerns if any"],
  "user_actions": ["1-2 recommended actions"]
}`,

  differential: (oldContent: string, newContent: string) => `
Compare these two versions of a privacy policy and identify material changes:

## Previous Version
${oldContent}

## New Version  
${newContent}

Analyze the changes and provide a JSON response:
{
  "change_summary": "Overview of what changed and why it matters",
  "added_practices": {
    "positive": ["New user rights or protections added"],
    "concerning": ["New data collection or sharing practices"]
  },
  "removed_practices": {
    "positive": ["Problematic practices removed"],
    "concerning": ["User protections or rights removed"]
  },
  "modified_terms": [
    {
      "area": "Category like data collection, sharing, etc.",
      "change": "What specifically changed",
      "impact": "How this affects users"
    }
  ],
  "overall_impact": "positive/negative/mixed",
  "recommended_actions": ["What users should do in response"]
}

Return ONLY valid JSON without markdown formatting.`
}

export const EXTRACTION_RULES = {
  datePatterns: [
    /(?:last\s+)?(?:updated?|modified|revised|effective)(?:\s+date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:as\s+of|effective\s+as\s+of)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:date|version)[:\s]+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /(?:©\s*\d{4}\s*-\s*)?(\d{4})\s+[A-Za-z]+\s+(?:Inc|LLC|Ltd|Corp)/i
  ],
  
  privacyIndicators: [
    'privacy policy', 'privacy statement', 'privacy notice',
    'data protection', 'data privacy', 'information we collect',
    'personal information', 'personal data', 'user data',
    'gdpr', 'ccpa', 'cookies', 'data subject', 'data controller'
  ],
  
  sectionHeaders: [
    'information we collect', 'data we collect', 'what we collect',
    'how we use', 'data use', 'purposes',
    'information sharing', 'data sharing', 'third parties',
    'your rights', 'user rights', 'your choices',
    'data retention', 'data storage', 'how long',
    'security', 'data security', 'protection',
    'cookies', 'tracking', 'analytics',
    'children', 'minors', 'age',
    'changes', 'updates', 'modifications',
    'contact', 'contact us', 'questions'
  ]
}

export const PROMPT_OPTIMIZATION = {
  // Temperature settings for different types of analysis
  temperatures: {
    structured: 0.1,  // For JSON extraction
    summary: 0.3,     // For summaries
    comparative: 0.2, // For diff analysis
    creative: 0.5    // For recommendations
  },
  
  // Max tokens based on analysis type
  maxTokens: {
    comprehensive: 3000,
    quick: 500,
    differential: 2000,
    streaming: 2500
  },
  
  // Model recommendations by use case
  modelRecommendations: {
    comprehensive: [
      'openai/gpt-4o-mini',      // Best balance of cost/quality
      'google/gemini-2.0-flash',   // Good for long contexts
      'anthropic/claude-3-haiku'   // Fast and accurate
    ],
    quick: [
      'google/gemini-2.5-flash-preview-05-20', // Very fast
      'openai/gpt-4o-mini',                    // Reliable
      'meta-llama/llama-3.3-70b-instruct'    // Cost-effective
    ],
    streaming: [
      'google/gemini-2.0-flash',  // Supports streaming well
      'openai/gpt-4o-mini'        // Good streaming support
    ]
  }
}

export function optimizePromptForModel(prompt: string, model: string): string {
  // Model-specific optimizations
  const optimizations: Record<string, (p: string) => string> = {
    'google/': (p) => {
      // Gemini models work better with structured formatting
      return p.replace(/^-\s+/gm, '• ')
               .replace(/\n{3,}/g, '\n\n')
    },
    'openai/': (p) => {
      // OpenAI models handle standard markdown well
      return p
    },
    'anthropic/': (p) => {
      // Claude models benefit from clear section breaks
      return p.replace(/^##\s+/gm, '\n## ')
               .replace(/^###\s+/gm, '\n### ')
    },
    'meta-llama/': (p) => {
      // Llama models work better with explicit instructions
      return p.replace('IMPORTANT:', '\n[INSTRUCTION]')
               .replace(/Return ONLY/, 'You must return ONLY')
    }
  }
  
  // Find matching optimization
  for (const [prefix, optimizer] of Object.entries(optimizations)) {
    if (model.startsWith(prefix)) {
      return optimizer(prompt)
    }
  }
  
  return prompt
}

export function selectBestModel(
  analysisType: keyof typeof PROMPT_OPTIMIZATION.modelRecommendations,
  availableModels: string[]
): string {
  const recommended = PROMPT_OPTIMIZATION.modelRecommendations[analysisType]
  
  // Find first recommended model that's available
  for (const model of recommended) {
    if (availableModels.includes(model)) {
      return model
    }
  }
  
  // Fallback to first available model
  return availableModels[0] || 'openai/gpt-4o-mini'
}