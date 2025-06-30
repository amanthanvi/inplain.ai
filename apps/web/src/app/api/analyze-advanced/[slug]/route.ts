import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedAIService, AnalysisTask } from '@/lib/ai/unified-ai-service';
import { ModelSelector, UserTier } from '@/lib/ai/model-selector';
import { ExpertPromptsLibrary } from '@/lib/expert-prompts';
import { ContentExtractor } from '@/lib/content-extractor';
import { StorageClient } from '../../lib/storage';
import { kv } from '@vercel/kv';
import { headers } from 'next/headers';
import { getClerkAuth } from '@/lib/auth-clerk';
import { isDevAuthEnabled } from '@/lib/dev-auth';

const storage = new StorageClient();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes for complex analysis

interface AnalysisRequest {
  mode?: 'quick' | 'standard' | 'deep' | 'expert';
  includeWebSearch?: boolean;
  promptIds?: string[];
  userTier?: 'free' | 'premium' | 'enterprise';
  compareWithPrevious?: boolean;
  industryBenchmark?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: AnalysisRequest = await request.json();
    
    // Check authentication in production (skip in dev with auth bypass)
    if (process.env.NODE_ENV === 'production' && !isDevAuthEnabled()) {
      const { userId } = await getClerkAuth()
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }
    
    // Determine user tier from headers or auth
    const userTier = body.userTier || 'free';
    
    // Check rate limiting
    const rateLimitKey = `ratelimit:analyze-advanced:${slug}:${userTier}`;
    const currentCount = await kv.incr(rateLimitKey);
    if (currentCount === 1) {
      await kv.expire(rateLimitKey, 3600); // 1 hour window
    }
    
    const limits = {
      free: 5,
      premium: 50,
      enterprise: 500
    };
    
    if (currentCount > limits[userTier]) {
      return NextResponse.json(
        { error: `Rate limit exceeded. ${userTier} tier allows ${limits[userTier]} analyses per hour.` },
        { status: 429 }
      );
    }

    // Get the latest snapshot
    const snapshots = await storage.getLatestSnapshots(slug, 1);
    if (snapshots.length === 0) {
      return NextResponse.json(
        { error: `No privacy policy found for ${slug}` },
        { status: 404 }
      );
    }
    
    const snapshot = snapshots[0]!; // We know it exists because we checked length

    // Check cache for recent analysis
    const cacheKey = `analysis-advanced:${slug}:${snapshot.id}:${body.mode || 'standard'}:${userTier}`;
    const cachedAnalysis = await kv.get(cacheKey);
    
    if (cachedAnalysis && !body.includeWebSearch) {
      return NextResponse.json({ 
        analysis: cachedAnalysis,
        cached: true,
        cacheAge: '< 24 hours'
      });
    }

    // Get and extract content
    const content = await storage.getSnapshotContent(snapshot.blobKey);
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to retrieve policy content' },
        { status: 500 }
      );
    }

    const extractedText = ContentExtractor.extract(content);

    // Get unified AI service
    const aiService = getUnifiedAIService();
    
    // Map mode to analysis task
    const taskMapping: Record<string, AnalysisTask> = {
      'quick': 'summary',
      'standard': 'comprehensive',
      'deep': 'risk_assessment',
      'expert': 'comprehensive'
    };
    
    const analysisTask = taskMapping[body.mode || 'standard'] || 'comprehensive';
    
    // Select optimal model based on user tier and requirements
    const { primary: selectedModel, fallbacks } = ModelSelector.selectModel({
      task: analysisTask,
      contentLength: extractedText.text.length,
      userTier: userTier as UserTier,
      responseTime: body.mode === 'quick' ? 'fast' : 'balanced',
      requiredFeatures: {
        tools: true,
        webSearch: body.includeWebSearch || (body.mode === 'expert'),
        thinking: body.mode === 'deep' || body.mode === 'expert',
        vision: false,
        streaming: false
      }
    });
    
    // Perform unified AI analysis
    const analysis = await aiService.analyze(extractedText.text, {
      task: analysisTask,
      model: selectedModel.id,
      useTools: true,
      useWebSearch: body.includeWebSearch || (body.mode === 'expert'),
      useThinking: body.mode === 'deep' || body.mode === 'expert',
      stream: false,
      includeConfidence: true,
      includeEvidence: true
    });


    // Transform unified AI response into advanced analysis format
    const advancedAnalysis = {
      task: analysis.task,
      content: analysis.content,
      confidence: analysis.confidence,
      evidence: analysis.evidence,
      model: analysis.model,
      tokensUsed: analysis.tokensUsed,
      processingTime: analysis.processingTime,
      timestamp: analysis.timestamp,
      expertAnalysis: undefined as any,
      comparison: undefined as any,
      industryBenchmark: undefined as any,
      comprehensiveScores: undefined as any,
      executiveSummary: undefined as any,
      overallScores: {
        privacy: typeof analysis.content === 'object' && analysis.content.privacy_score || 75,
        compliance: typeof analysis.content === 'object' && analysis.content.compliance_score || 80,
        transparency: 70,
        user_control: 65,
        security: 75
      }
    };

    // Add expert prompts analysis if requested
    if (body.promptIds && body.promptIds.length > 0) {
      const expertAnalysis = await performExpertPromptsAnalysis(
        extractedText.text,
        body.promptIds
      );
      advancedAnalysis.expertAnalysis = expertAnalysis;
    }

    // Add previous comparison if requested
    if (body.compareWithPrevious) {
      const comparison = await compareWithPreviousVersion(slug, snapshot.id, advancedAnalysis);
      advancedAnalysis.comparison = comparison;
    }

    // Add industry benchmark if requested
    if (body.industryBenchmark && userTier !== 'free') {
      const benchmark = await performIndustryBenchmark(slug, advancedAnalysis);
      advancedAnalysis.industryBenchmark = benchmark;
    }

    // Calculate comprehensive scores
    advancedAnalysis.comprehensiveScores = calculateComprehensiveScores(advancedAnalysis);

    // Generate executive summary
    advancedAnalysis.executiveSummary = generateExecutiveSummary(advancedAnalysis);

    // Cache the analysis
    await kv.setex(cacheKey, 86400, advancedAnalysis); // 24 hour cache

    // Track usage analytics
    await trackAnalysisUsage(slug, body.mode || 'standard', userTier);

    return NextResponse.json({
      analysis: advancedAnalysis,
      metadata: {
        snapshot_id: snapshot.id,
        analysis_date: new Date().toISOString(),
        mode: body.mode || 'standard',
        models_used: { [selectedModel.id]: selectedModel.name },
        enhanced_features: {
          web_search: body.includeWebSearch || (body.mode === 'expert'),
          reasoning: body.mode === 'deep' || body.mode === 'expert',
          expert_prompts: body.promptIds?.length || 0,
          comparison: body.compareWithPrevious || false,
          benchmark: body.industryBenchmark || false
        }
      }
    });

  } catch (error) {
    console.error('Advanced analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

async function performExpertPromptsAnalysis(
  content: string,
  promptIds: string[]
): Promise<any> {
  const results: Record<string, any> = {};
  const aiService = getUnifiedAIService();
  
  for (const promptId of promptIds) {
    const expertPrompt = ExpertPromptsLibrary.getPrompt(promptId);
    if (!expertPrompt) continue;

    try {
      const model = expertPrompt.modelPreferences[0] || 'google/gemini-2.0-flash-thinking-exp-1219:free';
      
      // Use unified AI service with custom prompts
      const response = await aiService.analyze(content, {
        task: 'comprehensive' as AnalysisTask,
        model: model,
        temperature: expertPrompt.temperature,
        maxTokens: expertPrompt.maxTokens,
        useTools: false, // Expert prompts usually don't need tools
        stream: false,
        systemPrompt: expertPrompt.systemPrompt,
        userPrompt: expertPrompt.prompt
      });

      results[expertPrompt.id] = {
        name: expertPrompt.name,
        domain: expertPrompt.domain,
        analysis: response.content
      };
    } catch (error) {
      results[expertPrompt.id] = {
        name: expertPrompt.name,
        error: 'Analysis failed'
      };
    }
  }

  return results;
}

async function compareWithPreviousVersion(
  slug: string,
  currentSnapshotId: string,
  currentAnalysis: any
): Promise<any> {
  try {
    // Get previous snapshot
    const snapshots = await kv.zrange(`snapshots:${slug}`, -2, -2, {
      withScores: true
    });

    if (!snapshots || snapshots.length === 0) {
      return { available: false, message: 'No previous version available' };
    }

    const previousSnapshotId = snapshots[0];
    
    // Get previous analysis from cache or generate
    const previousCacheKey = `analysis-advanced:${slug}:${previousSnapshotId}:standard:free`;
    let previousAnalysis = await kv.get(previousCacheKey) as any;

    if (!previousAnalysis) {
      // Generate quick analysis for previous version
      const previousContent = await storage.getSnapshotContent(previousSnapshotId as string);
      if (!previousContent) {
        return { available: false, message: 'Previous content not available' };
      }

      // For now, return unavailable for previous content comparison
      return { available: false, message: 'Previous content comparison not yet implemented' };
    }

    // Compare key metrics
    const comparison = {
      available: true,
      changes: {
        privacy_score: {
          previous: previousAnalysis?.overallScores?.privacy || 0,
          current: currentAnalysis.overallScores?.privacy || 0,
          change: (currentAnalysis.overallScores?.privacy || 0) - (previousAnalysis?.overallScores?.privacy || 0)
        },
        compliance_score: {
          previous: previousAnalysis?.overallScores?.compliance || 0,
          current: currentAnalysis.overallScores?.compliance || 0,
          change: (currentAnalysis.overallScores?.compliance || 0) - (previousAnalysis?.overallScores?.compliance || 0)
        },
        new_data_types: findNewDataTypes(previousAnalysis, currentAnalysis),
        removed_rights: findRemovedRights(previousAnalysis, currentAnalysis),
        policy_length_change: calculateLengthChange(previousAnalysis, currentAnalysis)
      },
      summary: generateComparisonSummary(previousAnalysis, currentAnalysis)
    };

    return comparison;
  } catch (error) {
    return { available: false, error: 'Comparison failed' };
  }
}

async function performIndustryBenchmark(slug: string, analysis: any): Promise<any> {
  // Use the competitive benchmark expert prompt
  const benchmarkPrompt = ExpertPromptsLibrary.getPrompt('competitive-benchmark');
  if (!benchmarkPrompt) {
    return { available: false };
  }

  try {
    const aiService = getUnifiedAIService();
    
    // Create search-enhanced prompt for industry comparison
    const prompt = `${benchmarkPrompt.prompt}

Company: ${slug}

Current Analysis Results:
${JSON.stringify(analysis.overallScores || {}, null, 2)}

Please search for and compare with:
- ${slug} competitors' privacy policies
- Industry standards for privacy practices
- Recent privacy policy trends and benchmarks`;

    // Use Perplexity model with web search capability
    const response = await aiService.analyze(prompt, {
      task: 'compliance_check' as AnalysisTask,
      model: 'perplexity/llama-3.1-sonar-large-128k-online',
      temperature: benchmarkPrompt.temperature,
      maxTokens: benchmarkPrompt.maxTokens,
      useTools: false,
      useWebSearch: true, // Enable web search for industry context
      stream: false
    });

    return {
      available: true,
      benchmark: response.content,
      confidence: response.confidence,
      sources: response.evidence
    };
  } catch (error) {
    return { available: false, error: 'Benchmark failed' };
  }
}

function calculateComprehensiveScores(analysis: any): any {
  const scores = {
    overall: 0,
    privacy: 0,
    transparency: 0,
    user_control: 0,
    security: 0,
    compliance: 0,
    innovation: 0,
    user_friendliness: 0
  };

  // Weight different components
  const weights = {
    base_scores: 0.3,
    expert_analysis: 0.3,
    web_context: 0.1,
    synthesis: 0.2,
    benchmark: 0.1
  };

  // Calculate weighted scores
  if (analysis.overallScores) {
    Object.keys(analysis.overallScores).forEach(key => {
      if (scores.hasOwnProperty(key)) {
        scores[key as keyof typeof scores] += analysis.overallScores[key] * weights.base_scores;
      }
    });
  }

  if (analysis.expertAnalysis) {
    const expertScores = extractScoresFromExpertAnalysis(analysis.expertAnalysis);
    Object.keys(expertScores).forEach(key => {
      if (scores.hasOwnProperty(key)) {
        scores[key as keyof typeof scores] += expertScores[key] * weights.expert_analysis;
      }
    });
  }

  if (analysis.synthesis?.overall_risk_assessment) {
    scores.overall = (10 - analysis.synthesis.overall_risk_assessment) * weights.synthesis;
  }

  // Normalize scores to 0-10 range
  Object.keys(scores).forEach(key => {
    scores[key as keyof typeof scores] = Math.round(scores[key as keyof typeof scores] * 10) / 10;
  });

  // Calculate letter grades
  const grades = Object.entries(scores).reduce((acc, [key, score]) => {
    acc[key] = getLetterGrade(score);
    return acc;
  }, {} as Record<string, string>);

  return { scores, grades };
}

function generateExecutiveSummary(analysis: any): any {
  const summary = {
    headline: '',
    key_findings: [] as string[],
    risk_level: '',
    recommended_actions: [] as string[],
    bottom_line: ''
  };

  // Determine risk level
  const overallScore = analysis.comprehensiveScores?.scores?.overall || 5;
  if (overallScore >= 8) {
    summary.risk_level = 'Low';
    summary.headline = 'Strong privacy practices with minor improvements needed';
  } else if (overallScore >= 6) {
    summary.risk_level = 'Moderate';
    summary.headline = 'Adequate privacy practices with several areas for improvement';
  } else if (overallScore >= 4) {
    summary.risk_level = 'High';
    summary.headline = 'Significant privacy concerns requiring immediate attention';
  } else {
    summary.risk_level = 'Critical';
    summary.headline = 'Severe privacy issues posing substantial user risk';
  }

  // Extract key findings
  if (analysis.synthesis?.critical_findings) {
    summary.key_findings = analysis.synthesis.critical_findings.slice(0, 5);
  } else {
    summary.key_findings = [
      `Privacy Score: ${analysis.comprehensiveScores?.scores?.privacy || 'N/A'}/10`,
      `Compliance Level: ${analysis.comprehensiveScores?.grades?.compliance || 'N/A'}`,
      `User Control: ${analysis.comprehensiveScores?.grades?.user_control || 'N/A'}`
    ];
  }

  // Get recommendations
  if (analysis.synthesis?.recommendations) {
    summary.recommended_actions = analysis.synthesis.recommendations.slice(0, 3);
  } else {
    summary.recommended_actions = [
      'Review and accept the privacy policy if comfortable with the practices',
      'Consider adjusting privacy settings to limit data collection',
      'Regularly review policy updates for changes'
    ];
  }

  // Generate bottom line
  summary.bottom_line = generateBottomLine(overallScore, analysis);

  return summary;
}

// Helper functions
function findNewDataTypes(previous: any, current: any): string[] {
  const prevTypes = new Set<string>(previous.data_practices?.data_types || []);
  const currTypes = new Set<string>(current.data_practices?.data_types || []);
  return Array.from(currTypes).filter(t => !prevTypes.has(t));
}

function findRemovedRights(previous: any, current: any): string[] {
  const prevRights = new Set<string>(previous.user_rights?.rights?.map((r: any) => r.name) || []);
  const currRights = new Set<string>(current.user_rights?.rights?.map((r: any) => r.name) || []);
  return Array.from(prevRights).filter(r => !currRights.has(r));
}

function calculateLengthChange(previous: any, current: any): number {
  const prevLength = previous.summary?.word_count || 0;
  const currLength = current.summary?.word_count || 0;
  return ((currLength - prevLength) / prevLength) * 100;
}

function generateComparisonSummary(previous: any, current: any): string {
  const changes = [];
  
  if (current.overallScores?.privacy > previous.overallScores?.privacy) {
    changes.push('Privacy protections have improved');
  } else if (current.overallScores?.privacy < previous.overallScores?.privacy) {
    changes.push('Privacy protections have weakened');
  }

  if (findNewDataTypes(previous, current).length > 0) {
    changes.push('New data collection categories added');
  }

  if (findRemovedRights(previous, current).length > 0) {
    changes.push('Some user rights have been removed');
  }

  return changes.length > 0 
    ? changes.join('. ') + '.'
    : 'No significant changes detected.';
}

function extractScoresFromExpertAnalysis(expertAnalysis: any): any {
  const scores: any = {};
  
  Object.values(expertAnalysis).forEach((analysis: any) => {
    if (analysis.analysis?.scores) {
      Object.entries(analysis.analysis.scores).forEach(([key, value]) => {
        if (typeof value === 'number') {
          scores[key] = (scores[key] || 0) + value;
        }
      });
    }
  });

  // Average the scores
  const count = Object.keys(expertAnalysis).length;
  Object.keys(scores).forEach(key => {
    scores[key] = scores[key] / count;
  });

  return scores;
}

function getLetterGrade(score: number): string {
  if (score >= 9) return 'A+';
  if (score >= 8.5) return 'A';
  if (score >= 8) return 'A-';
  if (score >= 7.5) return 'B+';
  if (score >= 7) return 'B';
  if (score >= 6.5) return 'B-';
  if (score >= 6) return 'C+';
  if (score >= 5.5) return 'C';
  if (score >= 5) return 'C-';
  if (score >= 4) return 'D';
  return 'F';
}

function generateBottomLine(score: number, analysis: any): string {
  if (score >= 8) {
    return 'This privacy policy demonstrates strong commitment to user privacy and can be trusted.';
  } else if (score >= 6) {
    return 'This privacy policy is acceptable but users should review specific practices carefully.';
  } else if (score >= 4) {
    return 'Users should exercise caution and consider the privacy trade-offs before proceeding.';
  } else {
    return 'Significant privacy risks detected. Users should carefully consider alternatives.';
  }
}

async function trackAnalysisUsage(slug: string, mode: string, tier: string): Promise<void> {
  const key = `analytics:usage:${new Date().toISOString().split('T')[0]}`;
  await kv.hincrby(key, `${slug}:${mode}:${tier}`, 1);
  await kv.expire(key, 2592000); // 30 days
}