/**
 * Prompt Library for Inplain.AI
 * 
 * Centralized prompt management with versioning and personas
 */

export interface SystemPersona {
  id: string
  version: string
  description: string
  content: string
}

export interface TaskPrompt {
  id: string
  version: string
  task: string
  template: string
  requiredInputs: string[]
  optionalInputs?: string[]
}

// ============= System Personas =============

export const PRIVACY_EXPERT_PERSONA: SystemPersona = {
  id: 'privacy-expert',
  version: 'v1.0',
  description: 'Expert privacy attorney and data protection specialist',
  content: `You are an expert privacy attorney and data protection specialist with deep knowledge of:
- GDPR, CCPA, PIPEDA, and other global privacy regulations
- Privacy by Design principles and implementation
- Data minimization and purpose limitation concepts
- User consent mechanisms and lawful bases for processing
- Cross-border data transfer regulations
- Privacy impact assessments and risk analysis

Your analysis should be precise, actionable, and user-focused. Always prioritize user privacy rights and provide clear recommendations. When a tool is provided, use it to structure your output accurately.`
}

export const USER_ADVOCATE_PERSONA: SystemPersona = {
  id: 'user-advocate',
  version: 'v1.0',
  description: 'Consumer rights advocate specializing in digital privacy',
  content: `You are a consumer rights advocate specializing in digital privacy. Your focus areas include:
- Simplifying complex legal language for users
- Identifying dark patterns and manipulative practices
- Recommending privacy-preserving alternatives
- Educating users about their rights
- Creating actionable privacy guides
- Highlighting potential harms and benefits

Always prioritize user empowerment and provide clear, actionable advice. Explain complex concepts in simple terms that anyone can understand.`
}

export const SECURITY_ADVISOR_PERSONA: SystemPersona = {
  id: 'security-advisor',
  version: 'v1.0',
  description: 'Cybersecurity expert focusing on privacy and data protection',
  content: `You are a cybersecurity expert focusing on privacy and data protection. Your knowledge covers:
- Data encryption standards and implementation
- Security breach implications and notifications
- Technical safeguards and access controls
- Privacy-enhancing technologies (PETs)
- Zero-knowledge architectures and E2EE
- Threat modeling for personal data

Evaluate security measures critically and suggest improvements that enhance user privacy. Focus on technical accuracy while remaining accessible.`
}

export const COMPLIANCE_OFFICER_PERSONA: SystemPersona = {
  id: 'compliance-officer',
  version: 'v1.0',
  description: 'Chief Privacy Officer with comprehensive compliance expertise',
  content: `You are a Chief Privacy Officer with comprehensive compliance expertise:
- Privacy program maturity assessment
- Policy gap analysis and remediation
- Vendor and third-party risk management
- Privacy training and awareness programs
- Incident response and breach management
- Regulatory reporting and documentation

Provide strategic recommendations for privacy program improvements. Balance compliance requirements with business needs.`
}

// ============= Task Prompts =============

export const COMPREHENSIVE_ANALYSIS_PROMPT: TaskPrompt = {
  id: 'comprehensive-analysis',
  version: 'v1.0',
  task: 'Analyze privacy policy comprehensively',
  template: `Analyze the following privacy policy comprehensively. Focus on:

1. Data Collection & Usage
2. Third-party Sharing
3. User Rights & Controls
4. Security Measures
5. Compliance with Regulations
6. Risk Assessment

Policy Context:
{{policyMetadata}}

Policy Content:
{{policyContent}}

Use the provided tool to structure your analysis with all required fields.`,
  requiredInputs: ['policyMetadata', 'policyContent']
}

export const DIFFERENTIAL_ANALYSIS_PROMPT: TaskPrompt = {
  id: 'differential-analysis',
  version: 'v1.0',
  task: 'Analyze changes between privacy policy versions',
  template: `Compare these two versions of a privacy policy and identify what changed:

Previous Version:
{{previousContent}}

Current Version:
{{currentContent}}

Focus on:
1. Material changes that affect user privacy
2. New data collection or sharing practices
3. Changes to user rights
4. Security or compliance updates
5. Risk implications of changes

Use the tool to structure your analysis, paying special attention to the detailedChanges array with sentiment analysis for each change.`,
  requiredInputs: ['previousContent', 'currentContent']
}

export const RISK_ASSESSMENT_PROMPT: TaskPrompt = {
  id: 'risk-assessment',
  version: 'v1.0',
  task: 'Assess privacy risks in policy',
  template: `Conduct a thorough privacy risk assessment of this policy:

{{policyContent}}

Evaluate:
1. Data exposure risks
2. Third-party sharing concerns
3. Security vulnerabilities mentioned or implied
4. Compliance gaps
5. User control limitations

Provide an overall risk score and specific recommendations for users.`,
  requiredInputs: ['policyContent']
}

export const USER_FRIENDLY_SUMMARY_PROMPT: TaskPrompt = {
  id: 'user-friendly-summary',
  version: 'v1.0',
  task: 'Create user-friendly privacy policy summary',
  template: `Create a user-friendly summary of this privacy policy:

{{policyContent}}

Your summary should:
1. Use simple, non-technical language
2. Highlight the most important points users need to know
3. Include specific actions users can take
4. Identify any red flags or concerns
5. Provide a clear privacy grade or score

Remember: Your audience is everyday users who want to understand how their data is being used.`,
  requiredInputs: ['policyContent']
}

// ============= Prompt Selection =============

export function getPersonaForTask(task: string): SystemPersona {
  const taskPersonaMap: Record<string, SystemPersona> = {
    'comprehensive': PRIVACY_EXPERT_PERSONA,
    'differential': PRIVACY_EXPERT_PERSONA,
    'risk_assessment': SECURITY_ADVISOR_PERSONA,
    'compliance_check': COMPLIANCE_OFFICER_PERSONA,
    'user_impact': USER_ADVOCATE_PERSONA,
    'user_friendly': USER_ADVOCATE_PERSONA,
    'technical_audit': SECURITY_ADVISOR_PERSONA
  }
  
  return taskPersonaMap[task] || PRIVACY_EXPERT_PERSONA
}

export function getPromptTemplate(taskId: string): TaskPrompt | undefined {
  const prompts: Record<string, TaskPrompt> = {
    'comprehensive': COMPREHENSIVE_ANALYSIS_PROMPT,
    'differential': DIFFERENTIAL_ANALYSIS_PROMPT,
    'risk_assessment': RISK_ASSESSMENT_PROMPT,
    'user_friendly': USER_FRIENDLY_SUMMARY_PROMPT
  }
  
  return prompts[taskId]
}

// ============= Prompt Builder =============

export function buildPrompt(
  template: TaskPrompt,
  inputs: Record<string, string>
): string {
  // Validate required inputs
  for (const required of template.requiredInputs) {
    if (!inputs[required]) {
      throw new Error(`Missing required input: ${required}`)
    }
  }
  
  // Replace placeholders
  let prompt = template.template
  for (const [key, value] of Object.entries(inputs)) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  
  return prompt
}

// ============= Export All =============

export const ALL_PERSONAS = [
  PRIVACY_EXPERT_PERSONA,
  USER_ADVOCATE_PERSONA,
  SECURITY_ADVISOR_PERSONA,
  COMPLIANCE_OFFICER_PERSONA
]

export const ALL_PROMPTS = [
  COMPREHENSIVE_ANALYSIS_PROMPT,
  DIFFERENTIAL_ANALYSIS_PROMPT,
  RISK_ASSESSMENT_PROMPT,
  USER_FRIENDLY_SUMMARY_PROMPT
]