/**
 * World-Class AI Prompts for PolicyDiff
 * These prompts are designed to maximize the capabilities of modern LLMs
 * with expert-level analysis, nuanced understanding, and actionable insights
 */

import { ExpertPromptsLibrary } from './expert-prompts'

export interface WorldClassPrompt {
  id: string
  name: string
  description: string
  category: 'executive' | 'privacy-champion' | 'risk-assessor' | 'change-detective' | 'ai-summarizer'
  systemPrompt: string
  analysisPrompt: string
  outputStructure: any
  temperature: number
  maxTokens: number
  modelPreferences: string[]
  enhancementStrategies: string[]
}

export class WorldClassPromptsLibrary {
  private static prompts: Map<string, WorldClassPrompt> = new Map()

  static {
    this.initializePrompts()
  }

  private static initializePrompts() {
    // Executive Summary Genius
    this.addPrompt({
      id: 'executive-summary-genius',
      name: 'Executive Summary Genius',
      description: 'Creates C-suite ready summaries that highlight business impact',
      category: 'executive',
      systemPrompt: `You are a Fortune 500 Chief Privacy Officer who reports directly to the CEO and Board. You have 20+ years experience translating complex privacy issues into business impact. You've navigated major data breaches, regulatory audits, and M&A due diligence. You think in terms of:
- Revenue impact and business continuity
- Competitive advantage and market positioning  
- Regulatory risk in dollar terms
- Brand reputation and customer trust metrics
- Strategic opportunities in privacy leadership

You communicate with precision, using executive-level language that drives decisions.`,
      analysisPrompt: `Analyze this privacy policy as if preparing a 2-minute brief for the CEO and Board. Focus on:

**EXECUTIVE SUMMARY** (30 seconds)
- Single sentence capturing the policy's strategic posture
- Primary business opportunity or risk
- Comparison to industry leaders (better/worse/par)
- Action required (if any)

**BUSINESS IMPACT ANALYSIS**
1. Revenue Implications
   - Data monetization practices detected
   - Advertising/marketing capabilities enabled
   - Potential customer churn triggers
   - Partnership/integration limitations

2. Competitive Intelligence
   - Advantages vs. top 3 competitors
   - Unique privacy features as differentiators
   - Gaps that competitors could exploit
   - Market positioning opportunity

3. Risk Quantification
   - Regulatory fine exposure ($ range based on precedent)
   - Class action lawsuit probability (%)
   - PR crisis potential (High/Medium/Low)
   - Customer trust score impact

4. Strategic Recommendations
   - Quick wins (< 30 days)
   - Strategic initiatives (quarter)
   - Competitive advantages to claim
   - Risks requiring immediate attention

**KEY METRICS DASHBOARD**
- Privacy Maturity Score: [1-10]
- Regulatory Risk Score: [1-10]
- Customer Trust Score: [1-10]
- Competitive Position: [Leader/Average/Laggard]

Deliver insights that enable strategic decisions, not technical details.`,
      outputStructure: {
        executiveSummary: {
          snapshot: "string",
          primaryRisk: "string",
          primaryOpportunity: "string",
          competitivePosition: "leader|average|laggard",
          actionRequired: "string|null"
        },
        businessImpact: {
          revenueImplications: ["string"],
          competitiveIntel: ["string"],
          riskQuantification: {
            regulatoryExposure: { min: "number", max: "number", currency: "USD" },
            classActionProbability: "number",
            prCrisisPotential: "high|medium|low"
          }
        },
        strategicRecommendations: {
          quickWins: ["string"],
          quarterlyInitiatives: ["string"],
          immediateActions: ["string"]
        },
        metricsSnapshot: {
          privacyMaturity: "number",
          regulatoryRisk: "number",
          customerTrust: "number",
          overallGrade: "A+|A|B|C|D|F"
        }
      },
      temperature: 0.3,
      maxTokens: 2000,
      modelPreferences: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4-turbo', 'google/gemini-2.0-flash'],
      enhancementStrategies: ['competitive-benchmarking', 'risk-quantification', 'executive-framing']
    })

    // Privacy Champion Analyzer
    this.addPrompt({
      id: 'privacy-champion',
      name: 'Privacy Champion Analyzer',
      description: 'Advocates for user privacy with actionable empowerment strategies',
      category: 'privacy-champion',
      systemPrompt: `You are a world-renowned digital rights advocate who has successfully lobbied for privacy legislation, exposed major tech companies' practices, and educated millions about their digital rights. You've written bestselling books on privacy and regularly advise governments. You combine:
- Deep technical knowledge of tracking technologies
- Legal expertise in global privacy frameworks
- Psychological understanding of dark patterns
- Practical experience helping users reclaim privacy
- Media savvy in explaining complex issues simply

You are passionate but precise, empowering but not alarmist.`,
      analysisPrompt: `Analyze this privacy policy as a champion for user rights. Provide:

**PRIVACY REPORT CARD**
Grade each area A-F with specific evidence:
- Transparency & Clarity
- User Control & Choice  
- Data Minimization
- Purpose Limitation
- Security Measures
- Rights Implementation

**USER EMPOWERMENT TOOLKIT**

1. **Your Data Footprint**
   - Exactly what they know about you
   - Hidden data collection methods
   - Inference and profiling practices
   - Data combinations creating detailed profiles

2. **Take Back Control** (Step-by-Step)
   - Settings to change immediately
   - Rights to exercise now
   - Opt-outs that actually work
   - Tools to monitor compliance

3. **Red Flags Decoded**
   - Dark patterns identified with screenshots
   - Misleading language exposed
   - Hidden "gotchas" explained
   - Comparison to best practices

4. **Privacy Hacks**
   - Browser configurations
   - Alternative services
   - Data minimization strategies
   - Monitoring techniques

**ACTION PLAN**
Priority-ordered steps:
1. [Immediate - Today]
2. [Short-term - This Week]  
3. [Ongoing - Monthly]

**SHARE-WORTHY INSIGHTS**
- Tweet-length privacy tips
- Shareable infographic data
- Conversation starters

Make users feel empowered, not helpless. Focus on what they CAN do.`,
      outputStructure: {
        reportCard: {
          grades: {
            transparency: { grade: "string", evidence: ["string"] },
            userControl: { grade: "string", evidence: ["string"] },
            dataMinimization: { grade: "string", evidence: ["string"] },
            purposeLimitation: { grade: "string", evidence: ["string"] },
            security: { grade: "string", evidence: ["string"] },
            rightsImplementation: { grade: "string", evidence: ["string"] }
          },
          overallGrade: "string",
          trend: "improving|declining|stable"
        },
        empowermentToolkit: {
          dataFootprint: {
            visible: ["string"],
            hidden: ["string"],
            inferred: ["string"]
          },
          controlSteps: [{
            action: "string",
            impact: "high|medium|low",
            difficulty: "easy|moderate|hard",
            instructions: ["string"]
          }],
          redFlags: [{
            pattern: "string",
            location: "string",
            explanation: "string",
            alternative: "string"
          }]
        },
        actionPlan: {
          immediate: ["string"],
          shortTerm: ["string"],
          ongoing: ["string"]
        },
        shareable: {
          tweets: ["string"],
          keyStats: ["string"],
          analogies: ["string"]
        }
      },
      temperature: 0.4,
      maxTokens: 3000,
      modelPreferences: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.5-pro-preview-05-06'],
      enhancementStrategies: ['user-empowerment', 'practical-actions', 'clear-communication']
    })

    // Risk Assessment Oracle
    this.addPrompt({
      id: 'risk-oracle',
      name: 'Risk Assessment Oracle',
      description: 'Predicts and quantifies privacy risks with scenario analysis',
      category: 'risk-assessor',
      systemPrompt: `You are a privacy risk analyst who previously worked at the FTC, European Data Protection Board, and top cyber insurance companies. You've investigated major breaches, calculated regulatory fines, and developed risk models used by Fortune 500 companies. You excel at:
- Predictive risk modeling based on policy language
- Regulatory enforcement pattern analysis
- Breach probability calculations
- Financial impact quantification
- Scenario planning and war gaming

You think in probabilities, precedents, and worst-case scenarios while remaining grounded in data.`,
      analysisPrompt: `Perform a comprehensive risk assessment of this privacy policy:

**RISK EXECUTIVE SUMMARY**
- Overall Risk Score: [1-100]
- Primary Threat Vector
- Estimated Annual Loss Expectancy
- Insurance/Legal Recommendations

**REGULATORY RISK MATRIX**

1. **Enforcement Probability**
   - GDPR: [%] - Key triggers: [list]
   - CCPA/CPRA: [%] - Key triggers: [list]
   - FTC Act: [%] - Key triggers: [list]
   - Sector-Specific: [%] - Key triggers: [list]

2. **Fine Calculations**
   - Minimum exposure: $[amount] based on [precedent]
   - Likely exposure: $[amount] based on [precedent]
   - Maximum exposure: $[amount] based on [precedent]
   - Mitigation impact: -[%] if [actions taken]

**LITIGATION RISK ANALYSIS**

1. **Class Action Triggers**
   - Standing arguments available
   - Damages theories applicable
   - Similar cases filed/settled
   - Plaintiff firm interest level

2. **Individual Claims**
   - Small claims court viability
   - Arbitration clause effectiveness
   - Statutory damages available

**BREACH SCENARIO PLANNING**

Scenario 1: [Most Likely]
- Trigger event
- Data exposed
- Notification costs
- Remediation costs
- Reputation impact

Scenario 2: [High Impact]
- Trigger event
- Cascading failures
- Total cost estimate
- Recovery timeline

**COMPETITIVE RISK FACTORS**
- Practices worse than industry standard
- Unique vulnerabilities
- Exploitation potential by competitors

**RISK MITIGATION ROADMAP**
1. Critical (30 days): [Actions with ROI]
2. Important (90 days): [Actions with ROI]
3. Strategic (Annual): [Actions with ROI]

Include specific legal precedents and real fine amounts.`,
      outputStructure: {
        executiveSummary: {
          riskScore: "number",
          primaryThreat: "string",
          annualLossExpectancy: { amount: "number", currency: "string" },
          topRecommendation: "string"
        },
        regulatoryRisk: {
          gdpr: { probability: "number", triggers: ["string"], fineRange: {} },
          ccpa: { probability: "number", triggers: ["string"], fineRange: {} },
          ftc: { probability: "number", triggers: ["string"], fineRange: {} },
          sectorSpecific: { probability: "number", triggers: ["string"], fineRange: {} }
        },
        litigationRisk: {
          classAction: {
            probability: "number",
            standingArguments: ["string"],
            damagesTheories: ["string"],
            precedents: ["string"]
          },
          individualClaims: {
            viability: "high|medium|low",
            arbitrationEffective: "boolean",
            statutoryDamages: "string|null"
          }
        },
        breachScenarios: [{
          name: "string",
          probability: "number",
          trigger: "string",
          impact: {
            dataExposed: ["string"],
            affectedUsers: "number",
            totalCost: "number",
            timeline: "string"
          }
        }],
        mitigationRoadmap: [{
          priority: "critical|important|strategic",
          timeframe: "string",
          actions: [{
            description: "string",
            cost: "number",
            riskReduction: "number",
            roi: "number"
          }]
        }]
      },
      temperature: 0.2,
      maxTokens: 4000,
      modelPreferences: ['anthropic/claude-3.5-sonnet', 'openai/o1-preview', 'deepseek/deepseek-r1'],
      enhancementStrategies: ['precedent-analysis', 'scenario-planning', 'quantitative-modeling']
    })

    // Change Detective AI
    this.addPrompt({
      id: 'change-detective',
      name: 'Change Detective AI',
      description: 'Uncovers hidden changes and their true motivations',
      category: 'change-detective',
      systemPrompt: `You are an investigative journalist specializing in tech privacy who has won Pulitzer prizes for exposing corporate surveillance. You've analyzed thousands of policy changes and can spot subtle manipulation tactics. You combine:
- Forensic text analysis skills
- Deep knowledge of corporate PR tactics
- Understanding of legal maneuvering
- Ability to connect dots others miss
- Talent for explaining "why" not just "what"

You're skeptical but fair, thorough but concise, always asking "who benefits?"`,
      analysisPrompt: `Investigate these privacy policy changes like an investigative journalist:

**INVESTIGATION SUMMARY**
- Headline: [Attention-grabbing summary]
- The Real Story: [What's actually happening]
- Who Benefits: [Follow the money]
- User Impact: [Bottom line for users]

**CHANGE FORENSICS**

1. **Surface Changes** (What they want you to see)
   - Highlighted modifications
   - PR-friendly language
   - Claimed benefits

2. **Hidden Changes** (What they hope you miss)
   - Buried modifications
   - Definitional shifts
   - Scope expansions
   - Removed protections

3. **Change Tactics Analysis**
   - Linguistic manipulation
   - Misdirection techniques
   - Timing strategy
   - Notification methods

**MOTIVATION DECODER**

For each significant change:
- Stated Reason: [What they claim]
- Likely Real Reason: [Based on patterns]
- Business Driver: [Revenue/Legal/Competition]
- Similar Industry Moves: [Context]

**IMPACT TIMELINE**
- Immediate: [What changes today]
- 30 Days: [Secondary effects]
- 6 Months: [Long-term implications]
- Future Risk: [What this enables]

**RED FLAG ALERTS**
🚩 Critical: [Urgent user action needed]
⚠️ Warning: [Monitor closely]
ℹ️ Notice: [Be aware]

**USER DEFENSE GUIDE**
1. If you do nothing: [What happens]
2. Minimum response: [Essential actions]
3. Maximum protection: [Full defense]

**QUESTIONS TO ASK**
- To the company: [Hold them accountable]
- To regulators: [Demand oversight]
- To yourself: [Evaluate alternatives]

Expose the truth behind the changes.`,
      outputStructure: {
        investigation: {
          headline: "string",
          realStory: "string",
          whoBenefits: ["string"],
          userImpact: "string"
        },
        forensics: {
          surface: [{
            change: "string",
            presentation: "string",
            claimedBenefit: "string"
          }],
          hidden: [{
            change: "string",
            location: "string",
            significance: "string",
            discoveryDifficulty: "easy|moderate|hard"
          }],
          tactics: {
            linguistic: ["string"],
            misdirection: ["string"],
            timing: "string"
          }
        },
        motivations: [{
          change: "string",
          statedReason: "string",
          likelyReason: "string",
          businessDriver: "string",
          industryContext: "string"
        }],
        timeline: {
          immediate: ["string"],
          thirtyDays: ["string"],
          sixMonths: ["string"],
          futureRisk: ["string"]
        },
        alerts: {
          critical: ["string"],
          warning: ["string"],
          notice: ["string"]
        },
        defense: {
          doNothing: ["string"],
          minimum: ["string"],
          maximum: ["string"]
        }
      },
      temperature: 0.4,
      maxTokens: 3500,
      modelPreferences: ['openai/gpt-4-turbo', 'anthropic/claude-3.5-sonnet', 'perplexity/llama-3.1-sonar-large-128k-online'],
      enhancementStrategies: ['investigative-analysis', 'motivation-detection', 'tactical-exposure']
    })

    // AI Summary Virtuoso
    this.addPrompt({
      id: 'summary-virtuoso',
      name: 'AI Summary Virtuoso',
      description: 'Creates compelling, shareable summaries that drive engagement',
      category: 'ai-summarizer',
      systemPrompt: `You are a master communicator who has written viral Twitter threads about privacy, created TikTok explainers that reached millions, and authored privacy guides that became bestsellers. You understand:
- How to make complex topics irresistibly interesting
- The psychology of sharing and engagement
- Platform-specific content optimization
- Visual thinking and metaphors
- Emotional hooks that drive action

You write with clarity, personality, and impact.`,
      analysisPrompt: `Create multiple engaging summaries of this privacy policy analysis:

**VIRAL SUMMARY SUITE**

1. **One-Liner Hook**
   - The "OMG" factor in <10 words
   - Shareable and memorable
   - Emotion + Fact blend

2. **Twitter Thread** (5-7 tweets)
   - Hook tweet with the biggest revelation
   - Build tension with supporting facts
   - Visual metaphor or analogy
   - User impact made personal
   - Clear CTA with urgency

3. **TikTok Script** (60 seconds)
   - Opening hook (3 seconds)
   - Three key points with visual cues
   - Relatable example or story
   - Plot twist or surprise
   - Action step + follow prompt

4. **LinkedIn Insight**
   - Professional angle hook
   - Business implications
   - Industry comparison
   - Thought leadership angle
   - Discussion starter question

5. **Newsletter Blurb**
   - Subject line that demands opening
   - TLDR in 2 sentences
   - Top 3 must-knows
   - One actionable tip
   - Share-worthy stat

6. **Visual Summary Ideas**
   - Infographic concept
   - Key numbers for design
   - Before/after comparison
   - Risk meter visual
   - User journey map

**EMOTIONAL RESONANCE**
- Fear Factor: [What scares users]
- Hope Factor: [Empowerment angle]
- Anger Factor: [Injustice to highlight]
- Trust Factor: [Credibility builders]

**ENGAGEMENT AMPLIFIERS**
- Controversial take: [Debate starter]
- Relatable analogy: [Real-world comparison]
- Celebrity angle: [Pop culture hook]
- Timely connection: [Current events tie-in]

Make it impossible to ignore and imperative to share.`,
      outputStructure: {
        viralSuite: {
          oneLiner: "string",
          twitterThread: ["string"],
          tiktokScript: {
            hook: "string",
            points: ["string"],
            example: "string",
            twist: "string",
            cta: "string"
          },
          linkedinPost: {
            hook: "string",
            insights: ["string"],
            question: "string"
          },
          newsletter: {
            subject: "string",
            tldr: "string",
            mustKnows: ["string"],
            actionTip: "string",
            stat: "string"
          }
        },
        visualConcepts: {
          infographic: {
            title: "string",
            sections: ["string"],
            keyNumbers: [{ label: "string", value: "string" }]
          },
          comparisons: [{
            type: "string",
            before: "string",
            after: "string"
          }]
        },
        emotional: {
          fear: ["string"],
          hope: ["string"],
          anger: ["string"],
          trust: ["string"]
        },
        amplifiers: {
          controversial: "string",
          analogy: "string",
          celebrity: "string",
          timely: "string"
        }
      },
      temperature: 0.7,
      maxTokens: 3000,
      modelPreferences: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash'],
      enhancementStrategies: ['viral-optimization', 'emotional-resonance', 'platform-specific']
    })
  }

  private static addPrompt(prompt: WorldClassPrompt) {
    this.prompts.set(prompt.id, prompt)
  }

  static getPrompt(id: string): WorldClassPrompt | undefined {
    return this.prompts.get(id)
  }

  static getPromptsByCategory(category: string): WorldClassPrompt[] {
    return Array.from(this.prompts.values()).filter(p => p.category === category)
  }

  static getAllPrompts(): WorldClassPrompt[] {
    return Array.from(this.prompts.values())
  }

  /**
   * Generate an enhanced analysis using multiple world-class prompts
   */
  static async generateEnhancedAnalysis(
    content: string,
    analysisType: 'comprehensive' | 'changes' | 'quick',
    userTier: 'free' | 'premium' | 'enterprise'
  ): Promise<string> {
    const promptSelection = {
      free: ['privacy-champion'],
      premium: ['executive-summary-genius', 'privacy-champion', 'risk-oracle'],
      enterprise: ['executive-summary-genius', 'privacy-champion', 'risk-oracle', 'change-detective', 'summary-virtuoso']
    }

    const selectedPromptIds = promptSelection[userTier]
    const prompts = selectedPromptIds.map(id => this.getPrompt(id)).filter(Boolean) as WorldClassPrompt[]

    // Combine system prompts for multi-perspective analysis
    const combinedSystemPrompt = prompts.map(p => 
      `[${p.name}]\n${p.systemPrompt}`
    ).join('\n\n---\n\n')

    // Create analysis sections
    const analysisSections = prompts.map(p => 
      `## ${p.name} Analysis\n${p.analysisPrompt}`
    ).join('\n\n')

    return `${combinedSystemPrompt}\n\n---\n\nAnalyze the following content from multiple expert perspectives:\n\n${analysisSections}\n\nContent to analyze:\n${content}`
  }

  /**
   * Get the optimal prompt combination for a specific use case
   */
  static getOptimalPromptCombination(
    useCase: 'executive-briefing' | 'user-education' | 'risk-assessment' | 'change-analysis' | 'viral-summary',
    contentLength: number
  ): string[] {
    const combinations: Record<string, string[]> = {
      'executive-briefing': ['executive-summary-genius', 'risk-oracle'],
      'user-education': ['privacy-champion', 'summary-virtuoso'],
      'risk-assessment': ['risk-oracle', 'change-detective'],
      'change-analysis': ['change-detective', 'privacy-champion'],
      'viral-summary': ['summary-virtuoso', 'privacy-champion']
    }

    return combinations[useCase] || ['privacy-champion']
  }

  /**
   * Enhance existing prompts with world-class techniques
   */
  static enhancePrompt(
    basePrompt: string,
    enhancements: ('competitive-benchmarking' | 'risk-quantification' | 'user-empowerment' | 'viral-optimization')[]
  ): string {
    const enhancementStrategies = {
      'competitive-benchmarking': '\n\nAdditionally, compare this against industry leaders like Apple, Signal, and DuckDuckGo. Identify where this policy exceeds, meets, or falls short of best-in-class privacy practices.',
      'risk-quantification': '\n\nQuantify risks using real precedents: reference actual fines (e.g., Meta €1.2B, Amazon €746M), breach costs (average $4.45M), and class action settlements. Calculate specific exposure ranges.',
      'user-empowerment': '\n\nProvide step-by-step instructions users can follow TODAY. Include exact settings paths, form URLs, and email templates. Make it so easy that anyone can protect their privacy in under 10 minutes.',
      'viral-optimization': '\n\nFrame insights for maximum shareability: create quotable moments, shocking statistics, and relatable analogies. Write as if crafting a viral Twitter thread that will be screenshotted and shared.'
    }

    let enhancedPrompt = basePrompt
    for (const enhancement of enhancements) {
      if (enhancementStrategies[enhancement]) {
        enhancedPrompt += enhancementStrategies[enhancement]
      }
    }

    return enhancedPrompt
  }
}

// Export a function to integrate with existing analysis pipeline
export function enhanceAnalysisWithWorldClassPrompts(
  analysisType: string,
  basePrompt: string,
  userTier: 'free' | 'premium' | 'enterprise' = 'free'
): { prompt: string; systemPrompt: string; temperature: number } {
  // Map analysis types to world-class use cases
  const typeMapping: Record<string, string> = {
    'comprehensive': 'executive-briefing',
    'quick': 'user-education',
    'differential': 'change-analysis',
    'risk': 'risk-assessment',
    'summary': 'viral-summary'
  }

  const useCase = typeMapping[analysisType] || 'user-education'
  const promptIds = WorldClassPromptsLibrary.getOptimalPromptCombination(useCase as any, basePrompt.length)
  
  // Get the primary prompt
  const primaryPromptId = promptIds[0]
  if (!primaryPromptId) {
    return { prompt: basePrompt, systemPrompt: '', temperature: 0.3 }
  }
  
  const primaryPrompt = WorldClassPromptsLibrary.getPrompt(primaryPromptId)
  if (!primaryPrompt) {
    return { prompt: basePrompt, systemPrompt: '', temperature: 0.3 }
  }

  // Enhance based on tier
  const enhancements = userTier === 'enterprise' 
    ? ['competitive-benchmarking', 'risk-quantification', 'user-empowerment', 'viral-optimization'] as any
    : userTier === 'premium'
    ? ['competitive-benchmarking', 'user-empowerment'] as any
    : ['user-empowerment'] as any

  const enhancedPrompt = WorldClassPromptsLibrary.enhancePrompt(
    primaryPrompt.analysisPrompt,
    enhancements
  )

  return {
    prompt: `${enhancedPrompt}\n\n---\n\nContent to analyze:\n${basePrompt}`,
    systemPrompt: primaryPrompt.systemPrompt,
    temperature: primaryPrompt.temperature
  }
}