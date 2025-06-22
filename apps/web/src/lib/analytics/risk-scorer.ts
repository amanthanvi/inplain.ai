export interface DiffResult {
  additions?: string;
  removals?: string;
  modifications?: string;
  changeCount: number;
  changeType: 'minor' | 'moderate' | 'major';
}

export interface RiskScore {
  overall: number; // 0-100
  categories: {
    privacy: number;
    security: number;
    compliance: number;
    operational: number;
    reputational: number;
  };
  factors: RiskFactor[];
  recommendation: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
}

export interface RiskFactor {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  evidence?: string;
}

export class RiskScorer {
  private static readonly RISK_PATTERNS = {
    privacy: {
      high: [
        /personal\s+data|pii|personally\s+identifiable/i,
        /biometric|genetic|health\s+data/i,
        /tracking|surveillance|monitoring/i,
        /third[\s-]party\s+sharing/i,
        /sell\s+your\s+data|share\s+with\s+advertisers/i
      ],
      medium: [
        /cookies|analytics|usage\s+data/i,
        /marketing|promotional\s+purposes/i,
        /data\s+retention|store\s+indefinitely/i
      ],
      low: [
        /anonymous|aggregate|statistical/i,
        /opt[\s-]out|choice|consent/i
      ]
    },
    security: {
      critical: [
        /no\s+encryption|unencrypted|plain[\s-]text/i,
        /vulnerability|exploit|breach/i,
        /unlimited\s+liability|no\s+liability/i
      ],
      high: [
        /weak\s+encryption|outdated\s+security/i,
        /limited\s+liability|disclaimer/i,
        /no\s+warranty|as[\s-]is/i
      ],
      medium: [
        /security\s+measures|protection/i,
        /responsible\s+disclosure/i
      ]
    },
    compliance: {
      high: [
        /gdpr|ccpa|coppa|hipaa/i,
        /legal\s+compliance|regulatory/i,
        /data\s+protection\s+officer/i
      ],
      medium: [
        /privacy\s+shield|safe\s+harbor/i,
        /industry\s+standards/i
      ]
    },
    operational: {
      high: [
        /termination|suspension|discontinue/i,
        /modify\s+without\s+notice/i,
        /sole\s+discretion/i
      ],
      medium: [
        /change\s+terms|update\s+policy/i,
        /notice\s+period|advance\s+notice/i
      ]
    }
  };

  static async scoreChanges(diff: DiffResult): Promise<RiskScore> {
    const factors: RiskFactor[] = [];
    const scores: Record<string, number> = {
      privacy: 0,
      security: 0,
      compliance: 0,
      operational: 0,
      reputational: 0
    };

    // Analyze additions
    if (diff.additions) {
      this.analyzeContent(diff.additions, 'added', factors, scores, 1.2);
    }

    // Analyze removals (can be risky too)
    if (diff.removals) {
      this.analyzeContent(diff.removals, 'removed', factors, scores, 0.8);
    }

    // Analyze modifications
    if (diff.modifications) {
      this.analyzeContent(diff.modifications, 'modified', factors, scores, 1.0);
    }

    // Calculate overall score
    const categoryScores = Object.values(scores);
    const maxPossibleScore = categoryScores.length * 100;
    const totalScore = categoryScores.reduce((a, b) => a + b, 0);
    const overall = Math.min(100, (totalScore / maxPossibleScore) * 100);

    // Determine recommendation
    let recommendation: RiskScore['recommendation'] = 'low';
    if (overall >= 75 || (scores['security'] || 0) >= 75) {
      recommendation = 'critical';
    } else if (overall >= 50 || (scores['privacy'] || 0) >= 60) {
      recommendation = 'high';
    } else if (overall >= 25) {
      recommendation = 'medium';
    }

    // Calculate confidence based on evidence
    const confidence = Math.min(1, factors.length * 0.1);

    return {
      overall: Math.round(overall),
      categories: {
        privacy: Math.round(scores['privacy'] || 0),
        security: Math.round(scores['security'] || 0),
        compliance: Math.round(scores['compliance'] || 0),
        operational: Math.round(scores['operational'] || 0),
        reputational: Math.round(scores['reputational'] || 0)
      },
      factors: factors.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }),
      recommendation,
      confidence
    };
  }

  private static analyzeContent(
    content: string,
    changeType: 'added' | 'removed' | 'modified',
    factors: RiskFactor[],
    scores: Record<string, number>,
    multiplier: number
  ) {
    // Privacy risks
    for (const [severity, patterns] of Object.entries(this.RISK_PATTERNS.privacy)) {
      for (const pattern of patterns as RegExp[]) {
        const matches = content.match(pattern);
        if (matches) {
          const weight = severity === 'high' ? 30 : severity === 'medium' ? 20 : 10;
          scores['privacy'] = (scores['privacy'] || 0) + weight * multiplier;
          
          factors.push({
            type: 'privacy',
            description: `${changeType} content related to ${this.getPatternDescription(pattern)}`,
            severity: severity as RiskFactor['severity'],
            weight: weight * multiplier,
            evidence: matches[0].substring(0, 100)
          });
        }
      }
    }

    // Security risks
    for (const [severity, patterns] of Object.entries(this.RISK_PATTERNS.security)) {
      for (const pattern of patterns as RegExp[]) {
        const matches = content.match(pattern);
        if (matches) {
          const weight = severity === 'critical' ? 40 : severity === 'high' ? 30 : 20;
          scores['security'] = (scores['security'] || 0) + weight * multiplier;
          
          factors.push({
            type: 'security',
            description: `${changeType} content about ${this.getPatternDescription(pattern)}`,
            severity: severity as RiskFactor['severity'],
            weight: weight * multiplier,
            evidence: matches[0].substring(0, 100)
          });
        }
      }
    }

    // Compliance indicators
    for (const [severity, patterns] of Object.entries(this.RISK_PATTERNS.compliance)) {
      for (const pattern of patterns as RegExp[]) {
        const matches = content.match(pattern);
        if (matches) {
          const weight = severity === 'high' ? 25 : 15;
          // Compliance mentions usually reduce risk
          scores['compliance'] = Math.max(0, (scores['compliance'] || 0) - weight * multiplier);
          
          factors.push({
            type: 'compliance',
            description: `${changeType} compliance-related content: ${this.getPatternDescription(pattern)}`,
            severity: 'low',
            weight: -weight * multiplier,
            evidence: matches[0].substring(0, 100)
          });
        }
      }
    }

    // Operational risks
    for (const [severity, patterns] of Object.entries(this.RISK_PATTERNS.operational)) {
      for (const pattern of patterns as RegExp[]) {
        const matches = content.match(pattern);
        if (matches) {
          const weight = severity === 'high' ? 25 : 15;
          scores['operational'] = (scores['operational'] || 0) + weight * multiplier;
          
          factors.push({
            type: 'operational',
            description: `${changeType} operational terms: ${this.getPatternDescription(pattern)}`,
            severity: severity as RiskFactor['severity'],
            weight: weight * multiplier,
            evidence: matches[0].substring(0, 100)
          });
        }
      }
    }

    // Reputational risk based on overall changes
    const significantChanges = factors.filter(f => f.severity === 'high' || f.severity === 'critical').length;
    if (significantChanges > 3) {
      scores['reputational'] = (scores['reputational'] || 0) + 20 * multiplier;
      factors.push({
        type: 'reputational',
        description: 'Multiple significant policy changes may impact user trust',
        severity: 'medium',
        weight: 20 * multiplier
      });
    }
  }

  private static getPatternDescription(pattern: RegExp): string {
    const patternMap: Record<string, string> = {
      'personal\\s+data|pii|personally\\s+identifiable': 'personal data handling',
      'biometric|genetic|health\\s+data': 'sensitive data collection',
      'tracking|surveillance|monitoring': 'user tracking',
      'third[\\s-]party\\s+sharing': 'third-party data sharing',
      'sell\\s+your\\s+data|share\\s+with\\s+advertisers': 'data monetization',
      'cookies|analytics|usage\\s+data': 'analytics and cookies',
      'no\\s+encryption|unencrypted|plain[\\s-]text': 'encryption concerns',
      'vulnerability|exploit|breach': 'security vulnerabilities',
      'gdpr|ccpa|coppa|hipaa': 'regulatory compliance',
      'termination|suspension|discontinue': 'service termination',
      'modify\\s+without\\s+notice': 'unilateral changes'
    };

    const patternStr = pattern.source;
    for (const [key, description] of Object.entries(patternMap)) {
      if (patternStr.includes(key)) {
        return description;
      }
    }
    
    return 'policy changes';
  }

  static generateRiskReport(score: RiskScore): string {
    const sections = [];

    sections.push(`## Risk Assessment Summary`);
    sections.push(`Overall Risk Score: **${score.overall}/100** (${score.recommendation.toUpperCase()})`);
    sections.push(`Confidence Level: ${Math.round(score.confidence * 100)}%\n`);

    sections.push(`### Risk Categories`);
    for (const [category, value] of Object.entries(score.categories)) {
      const emoji = value >= 60 ? '🔴' : value >= 30 ? '🟡' : '🟢';
      sections.push(`- **${category.charAt(0).toUpperCase() + category.slice(1)}**: ${emoji} ${value}/100`);
    }

    sections.push(`\n### Key Risk Factors`);
    const topFactors = score.factors.slice(0, 5);
    for (const factor of topFactors) {
      const severityEmoji = {
        critical: '🚨',
        high: '⚠️',
        medium: '⚡',
        low: 'ℹ️'
      }[factor.severity];
      
      sections.push(`\n${severityEmoji} **${factor.type.toUpperCase()} - ${factor.severity.toUpperCase()}**`);
      sections.push(`${factor.description}`);
      if (factor.evidence) {
        sections.push(`> "${factor.evidence}..."`);
      }
    }

    sections.push(`\n### Recommendations`);
    switch (score.recommendation) {
      case 'critical':
        sections.push(`⛔ **CRITICAL RISK**: Immediate review recommended. Consider seeking legal counsel before accepting these changes.`);
        break;
      case 'high':
        sections.push(`⚠️ **HIGH RISK**: Careful review required. Significant privacy or security implications detected.`);
        break;
      case 'medium':
        sections.push(`⚡ **MODERATE RISK**: Standard review recommended. Some notable changes that may affect users.`);
        break;
      case 'low':
        sections.push(`✅ **LOW RISK**: Minor changes detected. Standard review process should suffice.`);
        break;
    }

    return sections.join('\n');
  }

  // ML-ready feature extraction for future model training
  static extractFeatures(diff: DiffResult): number[] {
    const features: number[] = [];
    
    // Basic statistics
    features.push(diff.additions?.length || 0);
    features.push(diff.removals?.length || 0);
    features.push(diff.modifications?.length || 0);
    
    // Pattern matches
    const allContent = [
      diff.additions || '',
      diff.removals || '',
      diff.modifications || ''
    ].join(' ');

    for (const category of Object.values(this.RISK_PATTERNS)) {
      for (const patterns of Object.values(category)) {
        let matchCount = 0;
        for (const pattern of patterns as RegExp[]) {
          const matches = allContent.match(new RegExp(pattern, 'gi'));
          matchCount += matches ? matches.length : 0;
        }
        features.push(matchCount);
      }
    }

    // Normalize features
    const max = Math.max(...features);
    return features.map(f => max > 0 ? f / max : 0);
  }
}