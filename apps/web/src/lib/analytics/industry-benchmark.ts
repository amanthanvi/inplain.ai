export interface CompanyData {
  slug: string;
  name: string;
  url?: string;
  domain?: string;
}

export interface BenchmarkData {
  industry: string;
  metrics: BenchmarkMetrics;
  percentiles: PercentileData;
  peers: PeerComparison[];
  insights: BenchmarkInsight[];
}

export interface BenchmarkMetrics {
  privacyScore: number;
  updateFrequency: number; // updates per year
  transparencyScore: number;
  userRightsScore: number;
  dataProtectionScore: number;
  thirdPartySharing: number;
}

export interface PercentileData {
  overall: number;
  privacy: number;
  transparency: number;
  userRights: number;
  dataProtection: number;
}

export interface PeerComparison {
  company: string;
  similarity: number; // 0-1
  metrics: Partial<BenchmarkMetrics>;
  strengths: string[];
  weaknesses: string[];
}

export interface BenchmarkInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'trend';
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

export class IndustryBenchmark {
  private static readonly INDUSTRY_STANDARDS: Record<string, Partial<BenchmarkMetrics>> = {
    'technology': {
      privacyScore: 75,
      updateFrequency: 4,
      transparencyScore: 70,
      userRightsScore: 80,
      dataProtectionScore: 85,
      thirdPartySharing: 45
    },
    'social-media': {
      privacyScore: 65,
      updateFrequency: 6,
      transparencyScore: 60,
      userRightsScore: 70,
      dataProtectionScore: 75,
      thirdPartySharing: 65
    },
    'finance': {
      privacyScore: 85,
      updateFrequency: 3,
      transparencyScore: 80,
      userRightsScore: 85,
      dataProtectionScore: 90,
      thirdPartySharing: 30
    },
    'healthcare': {
      privacyScore: 90,
      updateFrequency: 2,
      transparencyScore: 85,
      userRightsScore: 90,
      dataProtectionScore: 95,
      thirdPartySharing: 20
    },
    'e-commerce': {
      privacyScore: 70,
      updateFrequency: 4,
      transparencyScore: 65,
      userRightsScore: 75,
      dataProtectionScore: 80,
      thirdPartySharing: 55
    },
    'media': {
      privacyScore: 60,
      updateFrequency: 3,
      transparencyScore: 55,
      userRightsScore: 65,
      dataProtectionScore: 70,
      thirdPartySharing: 70
    }
  };

  static async generateBenchmark(
    company: CompanyData,
    policyAnalysis?: any
  ): Promise<BenchmarkData> {
    const industry = this.detectIndustry(company);
    const metrics = await this.calculateMetrics(company, policyAnalysis);
    const percentiles = this.calculatePercentiles(metrics, industry);
    const peers = await this.findPeerComparisons(company, industry);
    const insights = this.generateInsights(metrics, percentiles, industry);

    return {
      industry,
      metrics,
      percentiles,
      peers,
      insights
    };
  }

  private static detectIndustry(company: CompanyData): string {
    const name = company.name.toLowerCase();
    const domain = company.slug.toLowerCase();

    // Simple industry detection based on company name/domain
    if (name.includes('bank') || name.includes('financial') || domain.includes('pay')) {
      return 'finance';
    } else if (name.includes('health') || name.includes('medical')) {
      return 'healthcare';
    } else if (name.includes('shop') || name.includes('store') || name.includes('market')) {
      return 'e-commerce';
    } else if (name.includes('social') || name.includes('chat') || name.includes('connect')) {
      return 'social-media';
    } else if (name.includes('news') || name.includes('media') || name.includes('content')) {
      return 'media';
    }
    
    return 'technology'; // default
  }

  private static async calculateMetrics(
    company: CompanyData,
    analysis?: any
  ): Promise<BenchmarkMetrics> {
    // In a real implementation, these would be calculated from actual policy analysis
    // For now, we'll simulate realistic values
    
    const baseScore = 50 + Math.random() * 30;
    
    return {
      privacyScore: Math.round(baseScore + (analysis?.privacyScore || Math.random() * 20)),
      updateFrequency: Math.round(2 + Math.random() * 6),
      transparencyScore: Math.round(baseScore - 5 + Math.random() * 20),
      userRightsScore: Math.round(baseScore + 5 + Math.random() * 20),
      dataProtectionScore: Math.round(baseScore + 10 + Math.random() * 20),
      thirdPartySharing: Math.round(20 + Math.random() * 60)
    };
  }

  private static calculatePercentiles(
    metrics: BenchmarkMetrics,
    industry: string
  ): PercentileData {
    const industryStandards = this.INDUSTRY_STANDARDS[industry as keyof typeof this.INDUSTRY_STANDARDS] || this.INDUSTRY_STANDARDS.technology;
    
    // Calculate percentile based on industry standards
    const calculatePercentile = (value: number, standard: number) => {
      // Simulate normal distribution around industry standard
      const deviation = Math.abs(value - standard);
      const maxDeviation = standard * 0.5;
      const normalized = 1 - (deviation / maxDeviation);
      
      if (value > standard) {
        return Math.min(99, 50 + normalized * 50);
      } else {
        return Math.max(1, normalized * 50);
      }
    };

    const overallScore = (
      metrics.privacyScore * 0.3 +
      metrics.transparencyScore * 0.2 +
      metrics.userRightsScore * 0.2 +
      metrics.dataProtectionScore * 0.2 +
      (100 - metrics.thirdPartySharing) * 0.1
    );

    return {
      overall: Math.round(calculatePercentile(overallScore, 75)),
      privacy: Math.round(calculatePercentile(metrics.privacyScore, industryStandards?.privacyScore || 75)),
      transparency: Math.round(calculatePercentile(metrics.transparencyScore, industryStandards?.transparencyScore || 70)),
      userRights: Math.round(calculatePercentile(metrics.userRightsScore, industryStandards?.userRightsScore || 80)),
      dataProtection: Math.round(calculatePercentile(metrics.dataProtectionScore, industryStandards?.dataProtectionScore || 85))
    };
  }

  private static async findPeerComparisons(
    company: CompanyData,
    industry: string
  ): Promise<PeerComparison[]> {
    // In a real implementation, this would query a database of companies
    // For now, we'll generate synthetic peer data
    
    const peerTemplates = {
      'technology': ['TechCorp Plus', 'DataFlow Inc', 'CloudFirst Systems'],
      'social-media': ['ConnectHub', 'ShareSpace', 'SocialSphere'],
      'finance': ['SecureBank Pro', 'TrustFinance', 'SafeMoney Corp'],
      'healthcare': ['HealthGuard Plus', 'MedSecure', 'CareData Systems'],
      'e-commerce': ['ShopSafe Online', 'MarketTrust', 'BuySecure'],
      'media': ['ContentGuard', 'MediaTrust', 'NewsPrivacy Inc']
    };

    const peers = peerTemplates[industry as keyof typeof peerTemplates] || peerTemplates.technology;
    
    return peers.slice(0, 3).map(peerName => {
      const similarity = 0.7 + Math.random() * 0.3;
      const variation = 0.8 + Math.random() * 0.4;
      
      const industryStandard = this.INDUSTRY_STANDARDS[industry as keyof typeof this.INDUSTRY_STANDARDS] || this.INDUSTRY_STANDARDS.technology;
      const peerMetrics: Partial<BenchmarkMetrics> = {
        privacyScore: Math.round((industryStandard?.privacyScore || 75) * variation),
        transparencyScore: Math.round((industryStandard?.transparencyScore || 70) * variation),
        userRightsScore: Math.round((industryStandard?.userRightsScore || 80) * variation),
        dataProtectionScore: Math.round((industryStandard?.dataProtectionScore || 85) * variation)
      };

      const strengths: string[] = [];
      const weaknesses: string[] = [];

      // Determine strengths and weaknesses
      if (peerMetrics.privacyScore! > 80) strengths.push('Strong privacy practices');
      if (peerMetrics.privacyScore! < 60) weaknesses.push('Privacy practices need improvement');
      
      if (peerMetrics.transparencyScore! > 75) strengths.push('Excellent transparency');
      if (peerMetrics.transparencyScore! < 55) weaknesses.push('Limited transparency');
      
      if (peerMetrics.userRightsScore! > 80) strengths.push('Comprehensive user rights');
      if (peerMetrics.userRightsScore! < 60) weaknesses.push('Limited user control options');

      return {
        company: peerName,
        similarity,
        metrics: peerMetrics,
        strengths,
        weaknesses
      };
    });
  }

  private static generateInsights(
    metrics: BenchmarkMetrics,
    percentiles: PercentileData,
    industry: string
  ): BenchmarkInsight[] {
    const insights: BenchmarkInsight[] = [];
    const industryStandards = this.INDUSTRY_STANDARDS[industry as keyof typeof this.INDUSTRY_STANDARDS] || this.INDUSTRY_STANDARDS.technology;

    // Privacy insights
    if (metrics.privacyScore > (industryStandards?.privacyScore || 75) + 10) {
      insights.push({
        type: 'strength',
        category: 'privacy',
        description: 'Privacy practices exceed industry standards',
        impact: 'high',
        recommendation: 'Leverage strong privacy stance as competitive advantage'
      });
    } else if (metrics.privacyScore < (industryStandards?.privacyScore || 75) - 10) {
      insights.push({
        type: 'weakness',
        category: 'privacy',
        description: 'Privacy practices below industry average',
        impact: 'high',
        recommendation: 'Prioritize privacy improvements to meet industry expectations'
      });
    }

    // Update frequency insights
    if (metrics.updateFrequency > (industryStandards?.updateFrequency || 4) * 1.5) {
      insights.push({
        type: 'weakness',
        category: 'stability',
        description: 'Policy updates more frequent than industry norm',
        impact: 'medium',
        recommendation: 'Consider consolidating updates to reduce user fatigue'
      });
    }

    // Transparency insights
    if (percentiles.transparency > 80) {
      insights.push({
        type: 'strength',
        category: 'transparency',
        description: 'Top 20% in industry for transparency',
        impact: 'medium',
        recommendation: 'Maintain transparency leadership position'
      });
    }

    // Third-party sharing insights
    if (metrics.thirdPartySharing > (industryStandards?.thirdPartySharing || 45) + 20) {
      insights.push({
        type: 'weakness',
        category: 'data-sharing',
        description: 'Extensive third-party data sharing compared to peers',
        impact: 'high',
        recommendation: 'Review and minimize third-party data sharing practices'
      });
    }

    // Overall performance
    if (percentiles.overall > 75) {
      insights.push({
        type: 'strength',
        category: 'overall',
        description: 'Top quartile performance in privacy practices',
        impact: 'high'
      });
    } else if (percentiles.overall < 25) {
      insights.push({
        type: 'opportunity',
        category: 'overall',
        description: 'Significant opportunity to improve relative to industry',
        impact: 'high',
        recommendation: 'Conduct comprehensive privacy program review'
      });
    }

    // Industry trends
    insights.push({
      type: 'trend',
      category: 'industry',
      description: `${industry} sector trending toward stricter privacy standards`,
      impact: 'medium',
      recommendation: 'Stay ahead of regulatory changes in your sector'
    });

    return insights;
  }

  static generateBenchmarkReport(benchmark: BenchmarkData): string {
    const lines: string[] = [];
    
    lines.push(`# Industry Benchmark Report: ${benchmark.industry.toUpperCase()}`);
    lines.push(`Generated: ${new Date().toISOString()}\n`);
    
    lines.push('## Performance Metrics');
    lines.push('| Metric | Score | Industry Avg | Percentile |');
    lines.push('|--------|-------|--------------|------------|');
    
    const industryAvg = this.INDUSTRY_STANDARDS[benchmark.industry as keyof typeof this.INDUSTRY_STANDARDS] || this.INDUSTRY_STANDARDS.technology;
    
    lines.push(`| Privacy Score | ${benchmark.metrics.privacyScore} | ${industryAvg?.privacyScore || 75} | ${benchmark.percentiles.privacy}th |`);
    lines.push(`| Transparency | ${benchmark.metrics.transparencyScore} | ${industryAvg?.transparencyScore || 70} | ${benchmark.percentiles.transparency}th |`);
    lines.push(`| User Rights | ${benchmark.metrics.userRightsScore} | ${industryAvg?.userRightsScore || 80} | ${benchmark.percentiles.userRights}th |`);
    lines.push(`| Data Protection | ${benchmark.metrics.dataProtectionScore} | ${industryAvg?.dataProtectionScore || 85} | ${benchmark.percentiles.dataProtection}th |`);
    lines.push(`| Update Frequency | ${benchmark.metrics.updateFrequency}/year | ${industryAvg?.updateFrequency || 4}/year | - |`);
    lines.push(`| Third-Party Sharing | ${benchmark.metrics.thirdPartySharing}% | ${industryAvg?.thirdPartySharing || 45}% | - |`);
    
    lines.push(`\n**Overall Percentile: ${benchmark.percentiles.overall}th**\n`);
    
    lines.push('## Peer Comparison');
    for (const peer of benchmark.peers) {
      lines.push(`\n### ${peer.company} (${Math.round(peer.similarity * 100)}% similarity)`);
      
      if (peer.strengths.length > 0) {
        lines.push('**Strengths:**');
        peer.strengths.forEach(s => lines.push(`- ${s}`));
      }
      
      if (peer.weaknesses.length > 0) {
        lines.push('**Weaknesses:**');
        peer.weaknesses.forEach(w => lines.push(`- ${w}`));
      }
    }
    
    lines.push('\n## Key Insights');
    
    const groupedInsights = benchmark.insights.reduce((acc, insight) => {
      if (!acc[insight.type]) acc[insight.type] = [];
      acc[insight.type]!.push(insight);
      return acc;
    }, {} as Record<string, BenchmarkInsight[]>);
    
    for (const [type, insights] of Object.entries(groupedInsights)) {
      lines.push(`\n### ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      
      for (const insight of insights) {
        const impactEmoji = {
          high: '🔴',
          medium: '🟡',
          low: '🟢'
        }[insight.impact];
        
        lines.push(`\n${impactEmoji} **${insight.category.toUpperCase()}**`);
        lines.push(insight.description);
        
        if (insight.recommendation) {
          lines.push(`> Recommendation: ${insight.recommendation}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}