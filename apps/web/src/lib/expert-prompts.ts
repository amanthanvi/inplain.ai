/**
 * Expert-level prompts for different domains and analysis types
 * Each prompt is fine-tuned for specific models and use cases
 */

export interface ExpertPrompt {
  id: string;
  name: string;
  description: string;
  domain: 'legal' | 'financial' | 'technical' | 'consumer' | 'security';
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
  responseFormat?: 'json' | 'markdown' | 'structured';
  modelPreferences: string[];
}

export class ExpertPromptsLibrary {
  private static prompts: Map<string, ExpertPrompt> = new Map();

  static {
    this.initializePrompts();
  }

  private static initializePrompts() {
    // Legal Expert Prompts
    this.addPrompt({
      id: 'gdpr-deep-analysis',
      name: 'GDPR Deep Analysis',
      description: 'Comprehensive GDPR compliance analysis by legal expert',
      domain: 'legal',
      systemPrompt: `You are a senior privacy lawyer specializing in GDPR compliance with 15+ years of experience advising Fortune 500 companies. You have successfully guided companies through regulatory audits and have deep knowledge of GDPR articles, recitals, and EDPB guidelines. You think like a Data Protection Officer and a regulator.`,
      prompt: `Perform a comprehensive GDPR compliance analysis of this privacy policy. Your analysis must:

1. **Lawful Basis Assessment** (Articles 6 & 9)
   - Identify all data processing activities
   - Map each to its stated lawful basis
   - Evaluate validity of consent mechanisms
   - Check legitimate interest assessments (LIA)
   - Flag any special category data processing

2. **Transparency Requirements** (Articles 12-14)
   - Verify all mandatory information is provided
   - Assess clarity and accessibility of language
   - Check for hidden or buried clauses
   - Evaluate layered privacy notice structure

3. **Data Subject Rights** (Articles 15-22)
   - Audit each GDPR right implementation
   - Verify response timeframes stated
   - Check for unlawful restrictions
   - Assess ease of exercising rights
   - Identity verification procedures

4. **International Transfers** (Chapter V)
   - Identify all third countries mentioned
   - Check transfer mechanisms (SCCs, adequacy)
   - Verify appropriate safeguards
   - Flag any onward transfer risks

5. **Data Protection by Design** (Article 25)
   - Evaluate privacy-first approach
   - Check data minimization practices
   - Assess retention period justifications
   - Review anonymization/pseudonymization

6. **Critical Red Flags**
   - Pre-checked consent boxes
   - Bundled consent
   - No granular choices
   - Excessive retention periods
   - Vague purposes like "improving services"

7. **Regulatory Risk Score** (1-10)
   - Likelihood of regulatory action
   - Potential fine calculation base
   - Reputational risk assessment

Provide specific article citations and actionable recommendations for each issue found.`,
      temperature: 0.2,
      maxTokens: 4000,
      responseFormat: 'json',
      modelPreferences: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4-turbo']
    });

    this.addPrompt({
      id: 'ccpa-cpra-analysis',
      name: 'CCPA/CPRA Compliance Analysis',
      description: 'California privacy law compliance check',
      domain: 'legal',
      systemPrompt: `You are a California privacy attorney who helped draft the CPRA regulations. You understand the nuances between CCPA and CPRA, the AG's enforcement priorities, and have handled multiple consumer complaints. You think like both a regulator and a class action plaintiff's attorney.`,
      prompt: `Analyze this privacy policy for CCPA/CPRA compliance with focus on:

1. **Consumer Rights Implementation**
   - Right to know (specific pieces & categories)
   - Right to delete (exceptions claimed)
   - Right to correct (CPRA addition)
   - Right to opt-out of sale/sharing
   - Right to limit sensitive personal information use

2. **Required Disclosures**
   - Categories of PI collected (all 11)
   - Purposes for each category
   - Categories of sources
   - Third parties shared with
   - Retention periods per category

3. **Sensitive Personal Information** (CPRA)
   - Identification of SPI categories
   - Purpose limitations
   - Opt-out mechanisms

4. **Financial Incentives & Discrimination**
   - Loyalty programs compliance
   - Non-discrimination attestations
   - Value calculations disclosed

5. **Sale/Sharing of PI**
   - Definition compliance
   - Behavioral advertising as "sharing"
   - Opt-out methods (one-click)
   - "Do Not Sell/Share" link prominence

6. **Service Provider vs Third Party**
   - Proper categorization
   - Contract requirements mentioned
   - Purpose limitations

7. **Enforcement Risk Areas**
   - Dark patterns in opt-out flow
   - Incomplete category listings
   - Response time violations (45 days)
   - Missing required links

Provide specific regulation citations and practical fixes.`,
      temperature: 0.2,
      maxTokens: 3500,
      responseFormat: 'json',
      modelPreferences: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4']
    });

    // Financial Expert Prompts
    this.addPrompt({
      id: 'financial-data-analysis',
      name: 'Financial Data Practices Audit',
      description: 'Analysis of financial data handling and compliance',
      domain: 'financial',
      systemPrompt: `You are a FinTech compliance officer with expertise in PCI-DSS, PSD2, open banking regulations, and financial privacy laws. You've managed compliance for payment processors and digital banks. You understand both regulatory requirements and industry best practices.`,
      prompt: `Analyze financial data handling practices in this privacy policy:

1. **Payment Data Security**
   - PCI-DSS compliance indicators
   - Tokenization practices
   - Payment processor relationships
   - Cardholder data retention

2. **Financial Information Categories**
   - Account information handling
   - Transaction data usage
   - Income/credit data processing
   - Investment information protection

3. **Third-Party Financial Services**
   - Plaid/banking aggregators
   - Credit reporting agencies
   - Payment processors identified
   - Open banking compliance

4. **Regulatory Compliance**
   - GLBA requirements
   - FCRA compliance (if applicable)
   - PSD2 strong customer authentication
   - Anti-money laundering data usage

5. **Cross-Border Financial Data**
   - International payment flows
   - Currency conversion data
   - Tax reporting obligations
   - Sanctions screening mentions

6. **Financial Profiling & Scoring**
   - Credit decisioning transparency
   - Algorithmic assessments
   - Adverse action notices
   - Financial behavior tracking

Identify gaps and provide specific remediation steps.`,
      temperature: 0.3,
      maxTokens: 3000,
      responseFormat: 'json',
      modelPreferences: ['openai/gpt-4-turbo', 'anthropic/claude-3.5-sonnet']
    });

    // Technical Security Expert Prompts
    this.addPrompt({
      id: 'security-architecture-review',
      name: 'Security Architecture Review',
      description: 'Technical security and data protection analysis',
      domain: 'security',
      systemPrompt: `You are a Chief Information Security Officer with expertise in cloud security, encryption, zero-trust architectures, and incident response. You hold CISSP and CCSP certifications and have managed security for companies processing billions of records. You think like both a defender and an attacker.`,
      prompt: `Perform a technical security analysis of the data protection measures described:

1. **Encryption Standards**
   - At-rest encryption (algorithms, key management)
   - In-transit protocols (TLS versions, cipher suites)
   - End-to-end encryption claims
   - Key rotation policies

2. **Access Control Architecture**
   - Authentication mechanisms
   - Authorization frameworks
   - Privileged access management
   - Zero-trust indicators
   - MFA implementation

3. **Data Loss Prevention**
   - Backup strategies mentioned
   - Disaster recovery capabilities
   - Data residency controls
   - Deletion verification methods

4. **Security Monitoring**
   - Logging practices
   - Anomaly detection claims
   - Incident response procedures
   - Breach notification timeframes

5. **Third-Party Security**
   - Vendor assessment processes
   - Sub-processor controls
   - API security measures
   - Supply chain risks

6. **Vulnerability Management**
   - Patching commitments
   - Penetration testing frequency
   - Bug bounty programs
   - Security audit schedules

7. **Compliance Frameworks**
   - SOC 2 Type II mentions
   - ISO 27001/27018
   - NIST framework alignment
   - Industry-specific standards

Rate the security maturity (1-10) and identify critical gaps.`,
      temperature: 0.2,
      maxTokens: 3500,
      responseFormat: 'json',
      modelPreferences: ['google/gemini-2.0-flash', 'anthropic/claude-3.5-sonnet']
    });

    // Consumer Advocate Prompts
    this.addPrompt({
      id: 'consumer-friendly-analysis',
      name: 'Consumer Rights & Usability Analysis',
      description: 'Analysis from everyday user perspective',
      domain: 'consumer',
      systemPrompt: `You are a consumer privacy advocate who has testified before Congress and written guides for the EFF. You understand how regular people interact with privacy policies and what confuses or misleads them. You champion clear language and user empowerment.`,
      prompt: `Analyze this privacy policy from an everyday consumer's perspective:

1. **Readability & Clarity**
   - Grade level of language used
   - Legal jargon that needs translation
   - Confusing or misleading sections
   - Visual organization and structure

2. **Practical User Impact**
   - What data collection can't be avoided?
   - Hidden surprises for average users
   - Opt-out complexity (click count)
   - Default settings assessment

3. **Dark Patterns Detection**
   - Consent flow manipulation
   - Fear-based messaging
   - Hidden important information
   - Asymmetric choice presentation

4. **Real Control Assessment**
   - Granularity of choices
   - Ease of changing preferences
   - All-or-nothing ultimatums
   - Account deletion barriers

5. **Trust Indicators**
   - Clear contact information
   - Response time commitments
   - User-friendly explanations
   - Examples and scenarios

6. **Red Flags for Consumers**
   - Unlimited data sharing rights
   - Perpetual licenses claimed
   - Retroactive policy changes
   - Arbitration clauses

Provide a "Mom Test" summary - could you explain this to your mom?`,
      temperature: 0.4,
      maxTokens: 3000,
      responseFormat: 'markdown',
      modelPreferences: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet']
    });

    // Industry Comparison Prompts
    this.addPrompt({
      id: 'competitive-benchmark',
      name: 'Industry Competitive Benchmark',
      description: 'Compare against industry best practices',
      domain: 'consumer',
      systemPrompt: `You are a privacy consultant who has reviewed thousands of policies across industries. You maintain a database of best practices and know what leading companies do differently. You provide actionable competitive intelligence.`,
      prompt: `Compare this privacy policy against industry best practices:

1. **Industry Identification**
   - Primary industry sector
   - Peer companies for comparison
   - Regulatory environment

2. **Best-in-Class Practices**
   - What leaders do better
   - Innovative approaches seen
   - User-friendly features missing

3. **Competitive Gaps**
   - Where this policy falls short
   - Opportunities for differentiation
   - Quick wins available

4. **Emerging Trends**
   - New practices being adopted
   - Future-proofing opportunities
   - Regulatory changes coming

5. **Benchmarking Scores**
   - Transparency: vs industry average
   - User control: vs best-in-class  
   - Innovation: leader or laggard
   - Overall ranking in sector

Provide specific examples from other companies where relevant.`,
      temperature: 0.3,
      maxTokens: 2500,
      responseFormat: 'json',
      modelPreferences: ['perplexity/llama-3.1-sonar-large-128k-online', 'openai/gpt-4']
    });
  }

  private static addPrompt(prompt: ExpertPrompt) {
    this.prompts.set(prompt.id, prompt);
  }

  static getPrompt(id: string): ExpertPrompt | undefined {
    return this.prompts.get(id);
  }

  static getPromptsByDomain(domain: string): ExpertPrompt[] {
    return Array.from(this.prompts.values()).filter(p => p.domain === domain);
  }

  static getAllPrompts(): ExpertPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Generate a composite prompt that combines multiple expert perspectives
   */
  static generateCompositePrompt(
    promptIds: string[],
    customInstructions?: string
  ): string {
    const prompts = promptIds.map(id => this.getPrompt(id)).filter(Boolean) as ExpertPrompt[];
    
    if (prompts.length === 0) return '';

    const composite = `You are a panel of experts analyzing this privacy policy. Each expert will provide their perspective:

${prompts.map((p, i) => `
EXPERT ${i + 1}: ${p.name}
${p.systemPrompt || ''}

${p.prompt}
`).join('\n---\n')}

${customInstructions ? `\nAdditional Instructions:\n${customInstructions}` : ''}

Provide a comprehensive analysis combining all expert perspectives.`;

    return composite;
  }

  /**
   * Get the best prompt for a specific analysis task
   */
  static selectBestPrompt(
    analysisType: string,
    contentLength: number,
    userTier: 'free' | 'premium' | 'enterprise'
  ): ExpertPrompt | undefined {
    // Map analysis types to domains
    const domainMap: Record<string, string> = {
      'legal_compliance': 'legal',
      'financial_data': 'financial',
      'security_assessment': 'security',
      'user_experience': 'consumer',
      'competitive_analysis': 'consumer'
    };

    const domain = domainMap[analysisType] || 'legal';
    const domainPrompts = this.getPromptsByDomain(domain);

    // Filter by user tier (premium prompts for premium users)
    const eligiblePrompts = domainPrompts.filter(p => {
      if (userTier === 'free' && p.maxTokens > 2000) return false;
      if (userTier === 'premium' && p.maxTokens > 4000) return false;
      return true;
    });

    // Select based on content length
    return eligiblePrompts.find(p => 
      contentLength < 10000 ? p.maxTokens <= 2500 : p.maxTokens >= 3000
    ) || eligiblePrompts[0];
  }
}