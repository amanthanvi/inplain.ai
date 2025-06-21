interface StructuredAnalysis {
  executive_summary: string
  key_highlights: string[]
  data_collected: {
    personal_info: string[]
    usage_data: string[]
    device_data: string[]
    third_party_data: string[]
  }
  user_rights: string[]
  data_sharing: {
    with_whom: string[]
    purposes: string[]
    opt_out_available: boolean
  }
  retention_period: string
  security_measures: string
  cookies_tracking: {
    uses_cookies: boolean
    tracking_technologies: string[]
    third_party_analytics: boolean
  }
  gdpr_compliant: boolean | string
  ccpa_compliant: boolean | string
  contact_info: string
  notable_concerns: string[]
  positive_aspects: string[]
  overall_privacy_score: string
  recommendations: string[]
}

export function formatAnalysisToMarkdown(analysis: StructuredAnalysis): string {
  const sections: string[] = []

  // Executive Summary
  sections.push(`# Privacy Policy Analysis

## Executive Summary

${analysis.executive_summary}`)

  // Privacy Score Badge
  const scoreEmoji = {
    excellent: '🟢',
    good: '🟡',
    fair: '🟠',
    poor: '🔴'
  }[analysis.overall_privacy_score] || '⚪'

  sections.push(`## Overall Privacy Score: ${scoreEmoji} ${analysis.overall_privacy_score.toUpperCase()}`)

  // Key Highlights
  if (analysis.key_highlights?.length > 0) {
    sections.push(`## 🔍 Key Highlights

${analysis.key_highlights.map(h => `- ${h}`).join('\n')}`)
  }

  // Data Collection
  if (analysis.data_collected) {
    const dataTypes = []
    
    if (analysis.data_collected.personal_info?.length > 0) {
      dataTypes.push(`### Personal Information
${analysis.data_collected.personal_info.map(d => `- ${d}`).join('\n')}`)
    }
    
    if (analysis.data_collected.usage_data?.length > 0) {
      dataTypes.push(`### Usage Data
${analysis.data_collected.usage_data.map(d => `- ${d}`).join('\n')}`)
    }
    
    if (analysis.data_collected.device_data?.length > 0) {
      dataTypes.push(`### Device Data
${analysis.data_collected.device_data.map(d => `- ${d}`).join('\n')}`)
    }
    
    if (analysis.data_collected.third_party_data?.length > 0) {
      dataTypes.push(`### Third-Party Data
${analysis.data_collected.third_party_data.map(d => `- ${d}`).join('\n')}`)
    }
    
    if (dataTypes.length > 0) {
      sections.push(`:::collapsible 📊 Data Collection Details
${dataTypes.join('\n\n')}
:::`)
    }
  }

  // User Rights
  if (analysis.user_rights?.length > 0) {
    sections.push(`## ✅ Your Rights

${analysis.user_rights.map(r => `- ✓ ${r}`).join('\n')}`)
  }

  // Data Sharing
  if (analysis.data_sharing) {
    const sharingDetails = []
    
    if (analysis.data_sharing.with_whom?.length > 0) {
      sharingDetails.push(`**Shared with:** ${analysis.data_sharing.with_whom.join(', ')}`)
    }
    
    if (analysis.data_sharing.purposes?.length > 0) {
      sharingDetails.push(`**Purposes:** ${analysis.data_sharing.purposes.join(', ')}`)
    }
    
    sharingDetails.push(`**Opt-out available:** ${analysis.data_sharing.opt_out_available ? '✅ Yes' : '❌ No'}`)
    
    sections.push(`:::collapsible 🤝 Data Sharing
${sharingDetails.join('\n\n')}
:::`)
  }

  // Technical Details Table
  const technicalDetails = []
  
  technicalDetails.push(`## 🔧 Technical Details

| Aspect | Details |
|--------|---------|`)
  
  if (analysis.retention_period) {
    technicalDetails.push(`| **Data Retention** | ${analysis.retention_period} |`)
  }
  
  if (analysis.security_measures) {
    technicalDetails.push(`| **Security** | ${analysis.security_measures} |`)
  }
  
  if (analysis.cookies_tracking) {
    const cookieDetails = []
    if (analysis.cookies_tracking.uses_cookies) {
      cookieDetails.push('Uses cookies')
    }
    if (analysis.cookies_tracking.third_party_analytics) {
      cookieDetails.push('Third-party analytics')
    }
    if (analysis.cookies_tracking.tracking_technologies?.length > 0) {
      cookieDetails.push(`Technologies: ${analysis.cookies_tracking.tracking_technologies.join(', ')}`)
    }
    if (cookieDetails.length > 0) {
      technicalDetails.push(`| **Tracking** | ${cookieDetails.join(' • ')} |`)
    }
  }
  
  sections.push(technicalDetails.join('\n'))

  // Compliance
  const complianceItems = []
  
  if (analysis.gdpr_compliant !== undefined) {
    const gdprStatus = typeof analysis.gdpr_compliant === 'boolean' 
      ? (analysis.gdpr_compliant ? '✅ Compliant' : '❌ Non-compliant')
      : '❓ Unclear'
    complianceItems.push(`- **GDPR:** ${gdprStatus}`)
  }
  
  if (analysis.ccpa_compliant !== undefined) {
    const ccpaStatus = typeof analysis.ccpa_compliant === 'boolean'
      ? (analysis.ccpa_compliant ? '✅ Compliant' : '❌ Non-compliant') 
      : '❓ Unclear'
    complianceItems.push(`- **CCPA:** ${ccpaStatus}`)
  }
  
  if (complianceItems.length > 0) {
    sections.push(`## 📋 Regulatory Compliance

${complianceItems.join('\n')}`)
  }

  // Concerns and Positives
  const assessmentSections = []
  
  if (analysis.notable_concerns?.length > 0) {
    assessmentSections.push(`### ⚠️ Notable Concerns

${analysis.notable_concerns.map(c => `- ${c}`).join('\n')}`)
  }
  
  if (analysis.positive_aspects?.length > 0) {
    assessmentSections.push(`### 👍 Positive Aspects

${analysis.positive_aspects.map(p => `- ${p}`).join('\n')}`)
  }
  
  if (assessmentSections.length > 0) {
    sections.push(`:::collapsible 📝 Assessment
${assessmentSections.join('\n\n')}
:::`)
  }

  // Recommendations
  if (analysis.recommendations?.length > 0) {
    sections.push(`## 💡 Recommendations for Users

${analysis.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`)
  }

  // Contact Info
  if (analysis.contact_info) {
    sections.push(`---

**Privacy Contact:** ${analysis.contact_info}`)
  }

  return sections.join('\n\n')
}

export function formatErrorToMarkdown(error: string): string {
  return `# ⚠️ Analysis Error

An error occurred while analyzing this privacy policy:

\`\`\`
${error}
\`\`\`

Please try again later or contact support if the issue persists.`
}

export function formatLoadingMarkdown(): string {
  return `# 🔄 Analyzing Privacy Policy...

The AI is currently analyzing this privacy policy. This may take a few moments.

## What we're analyzing:

- Data collection practices
- User rights and controls
- Data sharing policies
- Security measures
- Regulatory compliance
- Potential concerns

Please wait while we generate a comprehensive analysis...`
}