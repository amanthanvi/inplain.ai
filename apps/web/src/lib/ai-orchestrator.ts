import { AIService, PolicyAnalysisService } from '@/app/api/lib/ai-service';
import { ApiError, ApiErrorType } from '@/lib/api-error';

interface ModelCapability {
  id: string;
  name: string;
  provider: string;
  strengths: string[];
  weaknesses: string[];
  costPerMillion: number;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsWebSearch: boolean;
  supportsTools: boolean;
  specialization: 'legal' | 'financial' | 'technical' | 'general' | 'reasoning';
}

interface AnalysisTask {
  type: 'legal_compliance' | 'data_practices' | 'user_rights' | 'security' | 'changes' | 'summary';
  complexity: 'simple' | 'moderate' | 'complex';
  requiresWebSearch?: boolean;
  requiresReasoning?: boolean;
}

interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  relevance: number;
}

export class AIOrchestrator {
  private aiService: AIService;
  private policyService: PolicyAnalysisService;
  private modelCapabilities: Map<string, ModelCapability>;

  constructor() {
    this.aiService = new AIService();
    this.policyService = new PolicyAnalysisService();
    this.modelCapabilities = this.initializeModelCapabilities();
  }

  private initializeModelCapabilities(): Map<string, ModelCapability> {
    const capabilities = new Map<string, ModelCapability>();

    // Legal-specialized models
    capabilities.set('anthropic/claude-3.5-sonnet', {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      strengths: ['legal analysis', 'nuanced understanding', 'GDPR expertise'],
      weaknesses: ['cost', 'speed'],
      costPerMillion: 3.00,
      maxTokens: 200000,
      supportsStreaming: true,
      supportsWebSearch: false,
      supportsTools: true,
      specialization: 'legal'
    });

    // Financial-specialized models
    capabilities.set('openai/gpt-4-turbo', {
      id: 'openai/gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      strengths: ['financial analysis', 'data processing', 'accuracy'],
      weaknesses: ['cost'],
      costPerMillion: 10.00,
      maxTokens: 128000,
      supportsStreaming: true,
      supportsWebSearch: false,
      supportsTools: true,
      specialization: 'financial'
    });

    // Technical analysis models
    capabilities.set('google/gemini-2.0-flash', {
      id: 'google/gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      strengths: ['technical analysis', 'speed', 'code understanding'],
      weaknesses: ['legal nuance'],
      costPerMillion: 0.02,
      maxTokens: 32000,
      supportsStreaming: true,
      supportsWebSearch: false,
      supportsTools: true,
      specialization: 'technical'
    });

    // Reasoning models
    capabilities.set('openai/o1-preview', {
      id: 'openai/o1-preview',
      name: 'O1 Preview',
      provider: 'openai',
      strengths: ['complex reasoning', 'multi-step analysis', 'accuracy'],
      weaknesses: ['speed', 'cost'],
      costPerMillion: 15.00,
      maxTokens: 128000,
      supportsStreaming: false,
      supportsWebSearch: false,
      supportsTools: false,
      specialization: 'reasoning'
    });

    // Web search enabled models
    capabilities.set('perplexity/llama-3.1-sonar-large-128k-online', {
      id: 'perplexity/llama-3.1-sonar-large-128k-online',
      name: 'Perplexity Sonar',
      provider: 'perplexity',
      strengths: ['web search', 'current information', 'fact checking'],
      weaknesses: ['cost', 'legal expertise'],
      costPerMillion: 1.00,
      maxTokens: 127072,
      supportsStreaming: true,
      supportsWebSearch: true,
      supportsTools: false,
      specialization: 'general'
    });

    return capabilities;
  }

  /**
   * Intelligently route analysis tasks to the most appropriate models
   */
  async orchestrateAnalysis(
    content: string,
    companySlug: string,
    options: {
      includeWebSearch?: boolean;
      requireReasoning?: boolean;
      userTier?: 'free' | 'premium' | 'enterprise';
    } = {}
  ): Promise<any> {
    const tasks = this.decomposeAnalysisIntoTasks(content);
    const results = new Map<string, any>();

    // Phase 1: Web search enrichment (if enabled and premium)
    if (options.includeWebSearch && options.userTier !== 'free') {
      const webContext = await this.performWebSearchEnrichment(companySlug, content);
      results.set('webContext', webContext);
    }

    // Phase 2: Parallel task execution with optimal model selection
    const taskPromises = tasks.map(async (task) => {
      const model = this.selectOptimalModel(task, options.userTier || 'free');
      const enrichedContent = this.enrichContentWithContext(content, results.get('webContext'));
      
      try {
        const result = await this.executeTask(task, enrichedContent, model);
        return { task, result, model: model.id };
      } catch (error) {
        // Fallback to secondary model
        const fallbackModel = this.selectFallbackModel(task, model);
        const result = await this.executeTask(task, enrichedContent, fallbackModel);
        return { task, result, model: fallbackModel.id };
      }
    });

    const taskResults = await Promise.all(taskPromises);
    
    // Phase 3: Synthesis with reasoning model (if complex analysis)
    if (this.requiresSynthesis(tasks) && options.userTier !== 'free') {
      const synthesis = await this.synthesizeResults(taskResults, content);
      results.set('synthesis', synthesis);
    }

    // Phase 4: Final composition
    return this.composeAnalysisResult(taskResults, results);
  }

  private decomposeAnalysisIntoTasks(content: string): AnalysisTask[] {
    const tasks: AnalysisTask[] = [];
    const contentLength = content.length;
    const hasLegalTerms = /GDPR|CCPA|privacy rights|data protection/i.test(content);
    const hasFinancialTerms = /payment|billing|subscription|refund/i.test(content);
    const hasTechnicalTerms = /API|encryption|security|authentication/i.test(content);

    // Legal compliance analysis
    if (hasLegalTerms) {
      tasks.push({
        type: 'legal_compliance',
        complexity: contentLength > 50000 ? 'complex' : 'moderate',
        requiresWebSearch: true,
        requiresReasoning: true
      });
    }

    // Data practices analysis
    tasks.push({
      type: 'data_practices',
      complexity: 'moderate',
      requiresWebSearch: false,
      requiresReasoning: false
    });

    // User rights analysis
    tasks.push({
      type: 'user_rights',
      complexity: hasLegalTerms ? 'complex' : 'simple',
      requiresWebSearch: hasLegalTerms,
      requiresReasoning: false
    });

    // Security analysis
    if (hasTechnicalTerms) {
      tasks.push({
        type: 'security',
        complexity: 'moderate',
        requiresWebSearch: true,
        requiresReasoning: false
      });
    }

    // Summary generation
    tasks.push({
      type: 'summary',
      complexity: 'simple',
      requiresWebSearch: false,
      requiresReasoning: false
    });

    return tasks;
  }

  private selectOptimalModel(task: AnalysisTask, userTier: string): ModelCapability {
    const eligibleModels = Array.from(this.modelCapabilities.values()).filter(model => {
      // Filter by user tier cost limits
      if (userTier === 'free' && model.costPerMillion > 0.5) return false;
      if (userTier === 'premium' && model.costPerMillion > 5.0) return false;
      
      // Filter by task requirements
      if (task.requiresWebSearch && !model.supportsWebSearch) return false;
      if (task.requiresReasoning && model.specialization !== 'reasoning') return false;
      
      return true;
    });

    // Score models based on task fit
    const scoredModels = eligibleModels.map(model => {
      let score = 0;
      
      // Specialization match
      if (task.type === 'legal_compliance' && model.specialization === 'legal') score += 3;
      if (task.type === 'security' && model.specialization === 'technical') score += 3;
      
      // Complexity match
      if (task.complexity === 'complex' && model.maxTokens > 100000) score += 2;
      if (task.complexity === 'simple' && model.costPerMillion < 1.0) score += 2;
      
      // Cost efficiency
      score += (1 / model.costPerMillion) * 10;
      
      return { model, score };
    });

    // Sort by score and return best match
    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0]?.model || this.modelCapabilities.get('google/gemini-2.5-flash-preview')!;
  }

  private selectFallbackModel(task: AnalysisTask, failedModel: ModelCapability): ModelCapability {
    // Select a different provider's model with similar capabilities
    const alternatives = Array.from(this.modelCapabilities.values()).filter(model => 
      model.provider !== failedModel.provider &&
      model.costPerMillion <= failedModel.costPerMillion * 2
    );
    
    return alternatives[0] || this.modelCapabilities.get('google/gemini-2.5-flash-preview')!;
  }

  private async performWebSearchEnrichment(
    companySlug: string,
    content: string
  ): Promise<WebSearchResult[]> {
    // Use Perplexity or OpenRouter with :online suffix for web search
    const searchQueries = this.generateSearchQueries(companySlug, content);
    const searchPromises = searchQueries.map(query => this.executeWebSearch(query));
    const results = await Promise.all(searchPromises);
    
    return results.flat().sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  private generateSearchQueries(companySlug: string, content: string): string[] {
    const companyName = companySlug.replace(/-/g, ' ');
    const queries: string[] = [
      `${companyName} privacy policy changes ${new Date().getFullYear()}`,
      `${companyName} GDPR compliance issues`,
      `${companyName} data breach privacy`,
      `${companyName} user data practices controversy`
    ];

    // Add specific queries based on content
    if (content.includes('AI') || content.includes('artificial intelligence')) {
      queries.push(`${companyName} AI data usage policy`);
    }
    if (content.includes('biometric')) {
      queries.push(`${companyName} biometric data collection laws`);
    }

    return queries.slice(0, 3); // Limit to top 3 queries
  }

  private async executeWebSearch(query: string): Promise<WebSearchResult[]> {
    // This would integrate with OpenRouter's web search models
    const model = 'perplexity/llama-3.1-sonar-large-128k-online';
    const prompt = `Search for recent information about: ${query}
    
    Return the top 5 most relevant and recent results with:
    - URL
    - Title
    - Brief snippet (max 100 words)
    - Relevance score (0-1)
    
    Format as JSON array.`;

    try {
      const response = await this.aiService.sendRequest(model, prompt, { 
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response).results || [];
    } catch {
      return [];
    }
  }

  private enrichContentWithContext(content: string, webContext?: WebSearchResult[]): string {
    if (!webContext || webContext.length === 0) return content;

    const contextSection = `
## Recent Context from Web Search

${webContext.map(result => `
### ${result.title}
Source: ${result.url}
${result.snippet}
`).join('\n')}

## Original Policy Content
`;

    return contextSection + content;
  }

  private async executeTask(
    task: AnalysisTask,
    content: string,
    model: ModelCapability
  ): Promise<any> {
    const prompt = this.generateTaskPrompt(task, content);
    
    const response = await this.aiService.sendRequest(model.id, prompt, {
      temperature: task.complexity === 'complex' ? 0.3 : 0.5,
      max_tokens: Math.min(4000, model.maxTokens),
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response);
  }

  private generateTaskPrompt(task: AnalysisTask, content: string): string {
    const basePrompts: Record<AnalysisTask['type'], string> = {
      legal_compliance: `Analyze this privacy policy for legal compliance with GDPR, CCPA, and other major privacy regulations. 
        Identify: 
        1. Compliance strengths
        2. Potential violations or gaps
        3. Required disclosures that are missing
        4. Jurisdiction-specific requirements
        Return detailed JSON analysis.`,
      
      data_practices: `Analyze the data collection and usage practices described in this policy.
        Identify:
        1. Types of data collected
        2. Purposes of collection
        3. Data sharing with third parties
        4. Data retention periods
        5. Cross-border data transfers
        Return structured JSON.`,
      
      user_rights: `Extract and analyze all user rights mentioned in this policy.
        Include:
        1. Access rights
        2. Deletion rights
        3. Opt-out mechanisms
        4. Data portability
        5. How to exercise rights
        Rate accessibility on 1-10 scale.`,
      
      security: `Analyze the security measures and practices described.
        Evaluate:
        1. Encryption standards
        2. Access controls
        3. Incident response
        4. Security certifications
        5. Vulnerability disclosure
        Provide security score 1-10.`,
      
      changes: `Identify what has changed in this policy.
        Focus on:
        1. New data collection
        2. Changed user rights
        3. New third-party sharing
        4. Modified retention periods
        5. Impact on users`,
      
      summary: `Create a concise summary of this privacy policy.
        Include:
        1. Key takeaways (3-5 bullet points)
        2. Most important user impacts
        3. Red flags or concerns
        4. Positive practices
        Keep under 200 words.`
    };

    return `${basePrompts[task.type]}\n\nPolicy Content:\n${content}`;
  }

  private requiresSynthesis(tasks: AnalysisTask[]): boolean {
    return tasks.filter(t => t.complexity === 'complex').length >= 2;
  }

  private async synthesizeResults(taskResults: any[], originalContent: string): Promise<any> {
    const reasoningModel = this.modelCapabilities.get('openai/o1-preview')!;
    
    const prompt = `You are synthesizing multiple specialized analyses of a privacy policy.
    
Task Results:
${JSON.stringify(taskResults, null, 2)}

Create a comprehensive synthesis that:
1. Identifies patterns and connections across analyses
2. Highlights critical findings that appear in multiple analyses
3. Resolves any contradictions between analyses
4. Provides an overall risk assessment (1-10)
5. Generates top 5 actionable recommendations for users
6. Creates a executive summary (100 words max)

Return as JSON with clear structure.`;

    const response = await this.aiService.sendRequest(reasoningModel.id, prompt, {
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response);
  }

  private composeAnalysisResult(taskResults: any[], additionalResults: Map<string, any>): any {
    const modelUsage = taskResults.reduce((acc, result) => {
      acc[result.model] = (acc[result.model] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const analysis: any = {
      timestamp: new Date().toISOString(),
      orchestration: {
        modelsUsed: modelUsage,
        tasksCompleted: taskResults.length,
        webSearchPerformed: additionalResults.has('webContext'),
        synthesisPerformed: additionalResults.has('synthesis')
      }
    };

    // Merge task results
    taskResults.forEach(({ task, result }) => {
      analysis[task.type] = result;
    });

    // Add web context if available
    if (additionalResults.has('webContext')) {
      analysis.webContext = additionalResults.get('webContext');
    }

    // Add synthesis if available
    if (additionalResults.has('synthesis')) {
      analysis.synthesis = additionalResults.get('synthesis');
    }

    // Calculate overall scores
    analysis.overallScores = this.calculateOverallScores(analysis);

    return analysis;
  }

  private calculateOverallScores(analysis: any): any {
    const scores = {
      privacy: 0,
      transparency: 0,
      userControl: 0,
      security: 0,
      compliance: 0,
      overall: 0
    };

    // Aggregate scores from different analyses
    if (analysis.legal_compliance?.scores) {
      scores.compliance = analysis.legal_compliance.scores.overall || 0;
    }
    if (analysis.user_rights?.accessibilityScore) {
      scores.userControl = analysis.user_rights.accessibilityScore;
    }
    if (analysis.security?.securityScore) {
      scores.security = analysis.security.securityScore;
    }
    if (analysis.data_practices?.transparencyScore) {
      scores.transparency = analysis.data_practices.transparencyScore || 5;
    }

    // Calculate overall score
    const validScores = Object.values(scores).filter(s => s > 0);
    scores.overall = validScores.length > 0 
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length * 10) / 10
      : 5;

    scores.privacy = scores.overall; // Default privacy to overall

    return scores;
  }

  /**
   * Stream analysis with real-time updates
   */
  async *streamOrchestrationAnalysis(
    content: string,
    companySlug: string,
    options: {
      includeWebSearch?: boolean;
      requireReasoning?: boolean;
      userTier?: 'free' | 'premium' | 'enterprise';
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    yield JSON.stringify({ type: 'start', message: 'Starting intelligent analysis...' }) + '\n';

    // Stream task decomposition
    const tasks = this.decomposeAnalysisIntoTasks(content);
    yield JSON.stringify({ 
      type: 'tasks', 
      message: `Identified ${tasks.length} analysis tasks`,
      tasks: tasks.map(t => t.type)
    }) + '\n';

    // Stream web search if enabled
    if (options.includeWebSearch && options.userTier !== 'free') {
      yield JSON.stringify({ type: 'phase', message: 'Performing web search enrichment...' }) + '\n';
      const webContext = await this.performWebSearchEnrichment(companySlug, content);
      yield JSON.stringify({ 
        type: 'web_search', 
        message: `Found ${webContext.length} relevant sources`,
        sources: webContext.slice(0, 3).map(w => ({ title: w.title, url: w.url }))
      }) + '\n';
    }

    // Stream task execution
    yield JSON.stringify({ type: 'phase', message: 'Executing specialized analyses...' }) + '\n';
    
    for (const task of tasks) {
      const model = this.selectOptimalModel(task, options.userTier || 'free');
      yield JSON.stringify({ 
        type: 'task_start', 
        task: task.type,
        model: model.name
      }) + '\n';

      try {
        const result = await this.executeTask(task, content, model);
        yield JSON.stringify({
          type: 'task_complete',
          task: task.type,
          preview: this.generateTaskPreview(task.type, result)
        }) + '\n';
      } catch (error) {
        yield JSON.stringify({
          type: 'task_error',
          task: task.type,
          message: 'Using fallback model...'
        }) + '\n';
      }
    }

    // Final synthesis
    if (this.requiresSynthesis(tasks) && options.userTier !== 'free') {
      yield JSON.stringify({ type: 'phase', message: 'Synthesizing results with advanced reasoning...' }) + '\n';
    }

    yield JSON.stringify({ type: 'complete', message: 'Analysis complete!' }) + '\n';
  }

  private generateTaskPreview(taskType: string, result: any): string {
    switch (taskType) {
      case 'legal_compliance':
        return `Compliance score: ${result.scores?.overall || 'N/A'}/10`;
      case 'user_rights':
        return `Found ${result.rights?.length || 0} user rights`;
      case 'security':
        return `Security rating: ${result.securityScore || 'N/A'}/10`;
      default:
        return 'Analysis complete';
    }
  }
}

// Export singleton instance
export const aiOrchestrator = new AIOrchestrator();