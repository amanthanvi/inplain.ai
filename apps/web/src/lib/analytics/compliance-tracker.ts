export interface ComplianceStatus {
  regulation: string;
  compliant: boolean;
  score: number; // 0-100
  requirements: ComplianceRequirement[];
  lastAssessed: string;
  recommendations: string[];
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  evidence?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ComplianceReport {
  overallScore: number;
  regulations: ComplianceStatus[];
  criticalIssues: ComplianceRequirement[];
  improvements: string[];
  certificationReady: boolean;
}

export class ComplianceTracker {
  private static readonly REGULATIONS = {
    GDPR: {
      name: 'General Data Protection Regulation (GDPR)',
      requirements: [
        {
          id: 'gdpr-1',
          description: 'Clear and explicit consent for data processing',
          keywords: ['consent', 'permission', 'opt-in', 'agree'],
          severity: 'critical' as const
        },
        {
          id: 'gdpr-2',
          description: 'Right to access personal data',
          keywords: ['access', 'request', 'personal data', 'information'],
          severity: 'high' as const
        },
        {
          id: 'gdpr-3',
          description: 'Right to erasure (right to be forgotten)',
          keywords: ['delete', 'erasure', 'forgotten', 'remove'],
          severity: 'high' as const
        },
        {
          id: 'gdpr-4',
          description: 'Data portability',
          keywords: ['export', 'download', 'portability', 'transfer'],
          severity: 'medium' as const
        },
        {
          id: 'gdpr-5',
          description: 'Privacy by design and default',
          keywords: ['privacy by design', 'default', 'protection'],
          severity: 'high' as const
        },
        {
          id: 'gdpr-6',
          description: 'Data Protection Officer (DPO) designation',
          keywords: ['data protection officer', 'dpo', 'privacy officer'],
          severity: 'medium' as const
        },
        {
          id: 'gdpr-7',
          description: 'Breach notification within 72 hours',
          keywords: ['breach', 'notification', '72 hours', 'incident'],
          severity: 'critical' as const
        }
      ]
    },
    CCPA: {
      name: 'California Consumer Privacy Act (CCPA)',
      requirements: [
        {
          id: 'ccpa-1',
          description: 'Right to know what personal information is collected',
          keywords: ['collect', 'personal information', 'categories'],
          severity: 'high' as const
        },
        {
          id: 'ccpa-2',
          description: 'Right to delete personal information',
          keywords: ['delete', 'removal', 'personal information'],
          severity: 'high' as const
        },
        {
          id: 'ccpa-3',
          description: 'Right to opt-out of sale of personal information',
          keywords: ['opt-out', 'sale', 'do not sell', 'personal information'],
          severity: 'critical' as const
        },
        {
          id: 'ccpa-4',
          description: 'Right to non-discrimination',
          keywords: ['discrimination', 'equal', 'service', 'price'],
          severity: 'high' as const
        },
        {
          id: 'ccpa-5',
          description: 'Financial incentives disclosure',
          keywords: ['financial incentive', 'reward', 'program'],
          severity: 'medium' as const
        }
      ]
    },
    COPPA: {
      name: "Children's Online Privacy Protection Act (COPPA)",
      requirements: [
        {
          id: 'coppa-1',
          description: 'Parental consent for children under 13',
          keywords: ['children', 'under 13', 'parental consent', 'minors'],
          severity: 'critical' as const
        },
        {
          id: 'coppa-2',
          description: 'Age verification mechanisms',
          keywords: ['age', 'verification', 'birthday', 'date of birth'],
          severity: 'high' as const
        },
        {
          id: 'coppa-3',
          description: 'Parental access to children\'s data',
          keywords: ['parent', 'access', 'review', 'children data'],
          severity: 'high' as const
        },
        {
          id: 'coppa-4',
          description: 'Limited data retention for children',
          keywords: ['retention', 'children', 'delete', 'necessary'],
          severity: 'medium' as const
        }
      ]
    },
    HIPAA: {
      name: 'Health Insurance Portability and Accountability Act (HIPAA)',
      requirements: [
        {
          id: 'hipaa-1',
          description: 'Protection of Protected Health Information (PHI)',
          keywords: ['health', 'medical', 'phi', 'patient'],
          severity: 'critical' as const
        },
        {
          id: 'hipaa-2',
          description: 'Minimum necessary standard',
          keywords: ['minimum necessary', 'limited', 'health information'],
          severity: 'high' as const
        },
        {
          id: 'hipaa-3',
          description: 'Business Associate Agreements (BAA)',
          keywords: ['business associate', 'baa', 'third party', 'health'],
          severity: 'critical' as const
        },
        {
          id: 'hipaa-4',
          description: 'Breach notification requirements',
          keywords: ['breach', 'notification', 'health', 'hipaa'],
          severity: 'critical' as const
        }
      ]
    }
  };

  static async assessCompliance(
    policyContent: string,
    regulations: string[] = ['GDPR', 'CCPA']
  ): Promise<ComplianceReport> {
    const complianceStatuses: ComplianceStatus[] = [];
    const allCriticalIssues: ComplianceRequirement[] = [];

    for (const regulationKey of regulations) {
      const regulation = this.REGULATIONS[regulationKey as keyof typeof this.REGULATIONS];
      if (!regulation) continue;

      const requirements: ComplianceRequirement[] = [];
      let compliantCount = 0;

      for (const req of regulation.requirements) {
        const status = this.assessRequirement(policyContent, req);
        requirements.push(status);

        if (status.status === 'compliant') {
          compliantCount++;
        } else if (status.status === 'non-compliant' && status.severity === 'critical') {
          allCriticalIssues.push(status);
        }
      }

      const score = Math.round((compliantCount / requirements.length) * 100);
      const compliant = score >= 80 && !requirements.some(r => 
        r.status === 'non-compliant' && r.severity === 'critical'
      );

      complianceStatuses.push({
        regulation: regulation.name,
        compliant,
        score,
        requirements,
        lastAssessed: new Date().toISOString(),
        recommendations: this.generateRecommendations(requirements, regulationKey)
      });
    }

    const overallScore = Math.round(
      complianceStatuses.reduce((sum, cs) => sum + cs.score, 0) / complianceStatuses.length
    );

    return {
      overallScore,
      regulations: complianceStatuses,
      criticalIssues: allCriticalIssues,
      improvements: this.generateImprovements(complianceStatuses),
      certificationReady: overallScore >= 90 && allCriticalIssues.length === 0
    };
  }

  private static assessRequirement(
    content: string,
    requirement: typeof this.REGULATIONS.GDPR.requirements[0]
  ): ComplianceRequirement {
    const contentLower = content.toLowerCase();
    let matchCount = 0;
    let evidence: string | undefined;

    for (const keyword of requirement.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        matchCount++;
        if (!evidence) {
          // Extract surrounding context as evidence
          const index = contentLower.indexOf(keyword.toLowerCase());
          if (index !== -1) {
            const start = Math.max(0, index - 50);
            const end = Math.min(content.length, index + keyword.length + 50);
            evidence = '...' + content.substring(start, end).trim() + '...';
          }
        }
      }
    }

    let status: ComplianceRequirement['status'];
    if (matchCount >= requirement.keywords.length * 0.6) {
      status = 'compliant';
    } else if (matchCount > 0) {
      status = 'partial';
    } else {
      status = 'non-compliant';
    }

    return {
      id: requirement.id,
      description: requirement.description,
      status,
      evidence,
      severity: requirement.severity
    };
  }

  private static generateRecommendations(
    requirements: ComplianceRequirement[],
    regulation: string
  ): string[] {
    const recommendations: string[] = [];
    const nonCompliant = requirements.filter(r => 
      r.status === 'non-compliant' || r.status === 'partial'
    );

    for (const req of nonCompliant) {
      switch (req.id) {
        case 'gdpr-1':
          recommendations.push('Add clear consent mechanisms with granular options for different types of data processing');
          break;
        case 'gdpr-2':
          recommendations.push('Implement a data access request process and clearly document it in the privacy policy');
          break;
        case 'gdpr-3':
          recommendations.push('Add a clear data deletion process and specify the procedure for users to request deletion');
          break;
        case 'gdpr-7':
          recommendations.push('Include breach notification procedures and commit to 72-hour notification timeline');
          break;
        case 'ccpa-3':
          recommendations.push('Add a prominent "Do Not Sell My Personal Information" link and opt-out mechanism');
          break;
        case 'coppa-1':
          recommendations.push('Implement age verification and parental consent mechanisms for users under 13');
          break;
        default:
          recommendations.push(`Address requirement: ${req.description}`);
      }
    }

    if (recommendations.length === 0 && requirements.every(r => r.status === 'compliant')) {
      recommendations.push(`Maintain current ${regulation} compliance standards`);
      recommendations.push('Consider regular compliance audits to ensure ongoing adherence');
    }

    return recommendations;
  }

  private static generateImprovements(statuses: ComplianceStatus[]): string[] {
    const improvements: string[] = [];

    // Overall recommendations
    const avgScore = statuses.reduce((sum, s) => sum + s.score, 0) / statuses.length;
    
    if (avgScore < 50) {
      improvements.push('Comprehensive privacy policy overhaul recommended');
      improvements.push('Consider engaging a privacy law expert for compliance review');
    } else if (avgScore < 80) {
      improvements.push('Several compliance gaps identified - prioritize critical requirements');
      improvements.push('Implement a privacy compliance management system');
    } else {
      improvements.push('Strong compliance foundation - focus on maintaining standards');
      improvements.push('Consider pursuing privacy certifications');
    }

    // Specific improvements
    const weakestRegulation = statuses.reduce((min, s) => 
      s.score < min.score ? s : min
    );
    
    if (weakestRegulation.score < 70) {
      improvements.push(`Priority: Improve ${weakestRegulation.regulation} compliance (currently ${weakestRegulation.score}%)`);
    }

    // Cross-regulation improvements
    const commonGaps = this.findCommonGaps(statuses);
    for (const gap of commonGaps) {
      improvements.push(`Address across all regulations: ${gap}`);
    }

    return improvements;
  }

  private static findCommonGaps(statuses: ComplianceStatus[]): string[] {
    const gaps: Record<string, number> = {};

    for (const status of statuses) {
      for (const req of status.requirements) {
        if (req.status !== 'compliant') {
          const key = this.categorizeRequirement(req.description);
          gaps[key] = (gaps[key] || 0) + 1;
        }
      }
    }

    return Object.entries(gaps)
      .filter(([_, count]) => count >= 2)
      .map(([gap]) => gap);
  }

  private static categorizeRequirement(description: string): string {
    if (description.includes('consent')) return 'User consent mechanisms';
    if (description.includes('delete') || description.includes('erasure')) return 'Data deletion rights';
    if (description.includes('access')) return 'Data access rights';
    if (description.includes('breach')) return 'Breach notification';
    if (description.includes('children')) return 'Children\'s privacy';
    return description;
  }

  static generateComplianceMatrix(report: ComplianceReport): string {
    const lines: string[] = [];
    
    lines.push('# Compliance Matrix Report');
    lines.push(`Generated: ${new Date().toISOString()}\n`);
    
    lines.push(`## Overall Compliance Score: ${report.overallScore}%`);
    lines.push(`Certification Ready: ${report.certificationReady ? '✅ Yes' : '❌ No'}\n`);
    
    for (const regulation of report.regulations) {
      lines.push(`### ${regulation.regulation}`);
      lines.push(`**Score:** ${regulation.score}% | **Status:** ${regulation.compliant ? '✅ Compliant' : '⚠️ Non-Compliant'}\n`);
      
      lines.push('| Requirement | Status | Severity |');
      lines.push('|------------|---------|----------|');
      
      for (const req of regulation.requirements) {
        const statusEmoji = {
          'compliant': '✅',
          'partial': '⚡',
          'non-compliant': '❌',
          'not-applicable': '➖'
        }[req.status];
        
        lines.push(`| ${req.description} | ${statusEmoji} ${req.status} | ${req.severity} |`);
      }
      
      if (regulation.recommendations.length > 0) {
        lines.push('\n**Recommendations:**');
        for (const rec of regulation.recommendations) {
          lines.push(`- ${rec}`);
        }
      }
      lines.push('');
    }
    
    if (report.criticalIssues.length > 0) {
      lines.push('## ⚠️ Critical Issues Requiring Immediate Attention');
      for (const issue of report.criticalIssues) {
        lines.push(`- **${issue.description}** (${issue.id})`);
      }
      lines.push('');
    }
    
    lines.push('## Improvement Roadmap');
    for (let i = 0; i < report.improvements.length; i++) {
      lines.push(`${i + 1}. ${report.improvements[i]}`);
    }
    
    return lines.join('\n');
  }
}