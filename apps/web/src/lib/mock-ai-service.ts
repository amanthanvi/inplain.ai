/**
 * Mock AI Service for demo/development when OpenRouter API is not configured
 */

export class MockAIService {
  private mockResponses = {
    comprehensive: {
      executive_summary: "This privacy policy outlines comprehensive data practices including collection, usage, sharing, and user rights. The policy demonstrates transparency in data handling and provides clear mechanisms for user control.",
      
      data_collection: [
        "Personal identifiers (name, email, phone)",
        "Device and browser information",
        "Usage data and interaction patterns",
        "Location data (with consent)",
        "Payment information (encrypted)"
      ],
      
      data_usage: [
        "Service provision and improvement",
        "Security and fraud prevention",
        "Legal compliance",
        "Marketing (with consent)",
        "Analytics and research"
      ],
      
      third_party_sharing: [
        "Service providers (data processors)",
        "Legal authorities (when required)",
        "Business partners (anonymized data)",
        "No selling of personal data"
      ],
      
      user_rights: [
        "Access your personal data",
        "Request data correction",
        "Delete your account and data",
        "Data portability",
        "Opt-out of marketing"
      ],
      
      data_retention: "Data retained for service duration plus legal requirements",
      
      security_measures: "Industry-standard encryption, access controls, regular audits, incident response procedures",
      
      cookies_tracking: {
        uses_cookies: true,
        tracking_technologies: ["Cookies", "Local storage", "Analytics pixels"],
        third_party_analytics: true,
        analytics_providers: ["Google Analytics", "Internal analytics"]
      },
      
      gdpr_compliant: true,
      gdpr_features: ["Data Protection Officer", "Privacy by Design", "Data Processing Agreements"],
      
      ccpa_compliant: true,
      ccpa_features: ["Do Not Sell option", "Annual privacy rights", "Non-discrimination"],
      
      contact_info: "privacy@example.com",
      
      notable_concerns: [
        "Broad data retention periods",
        "Complex third-party ecosystem",
        "Opt-out rather than opt-in for some features"
      ],
      
      positive_aspects: [
        "Clear user rights section",
        "Strong security commitments",
        "Regular policy updates",
        "Accessible language"
      ],
      
      overall_privacy_score: "good",
      score_reasoning: "Comprehensive coverage with strong user rights, though some areas could be more restrictive",
      
      recommendations: [
        "Review connected third-party apps",
        "Adjust privacy settings in account dashboard",
        "Enable two-factor authentication",
        "Regularly review data access logs"
      ]
    },
    
    differential: {
      change_summary: "The privacy policy has been updated to reflect new data practices, enhanced user rights, and compliance with recent regulations. Key changes focus on transparency and user control.",
      
      key_highlights: [
        "Added explicit consent requirements for data processing",
        "Introduced new user rights for data portability",
        "Updated data retention periods to be more specific",
        "Clarified third-party data sharing practices",
        "Enhanced security commitments with specific measures"
      ],
      
      risk_level: "low",
      
      categories: [
        "user_rights",
        "data_retention",
        "consent_mechanisms",
        "third_party_sharing",
        "security_measures"
      ],
      
      user_impact: "Generally positive changes that enhance user privacy rights and provide more control over personal data. Users should review new consent options.",
      
      recommended_actions: [
        "Review and update your privacy preferences",
        "Check new data export options",
        "Verify third-party app permissions"
      ]
    }
  }
  
  async generateComprehensiveAnalysis(): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    return this.mockResponses.comprehensive
  }
  
  async generateDifferentialAnalysis(): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    return this.mockResponses.differential
  }
  
  getStreamingResponse(): ReadableStream {
    const encoder = new TextEncoder()
    const mockContent = JSON.stringify(this.mockResponses.comprehensive, null, 2)
    const chunks = this.chunkString(mockContent, 50)
    let chunkIndex = 0
    
    return new ReadableStream({
      start(controller) {
        // Send metadata
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'metadata',
          model: 'mock-model',
          snapshotId: 'mock-snapshot',
          wordCount: 1000
        })}\n\n`))
        
        // Stream content chunks
        const interval = setInterval(() => {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'content',
              content: chunks[chunkIndex]
            })}\n\n`))
            chunkIndex++
          } else {
            // Send completion
            clearInterval(interval)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              analysis: {
                id: crypto.randomUUID(),
                structured_content: mockContent,
                raw_content: mockContent,
                model: 'mock-model',
                generatedAt: new Date().toISOString()
              }
            })}\n\n`))
            controller.close()
          }
        }, 100)
      }
    })
  }
  
  private chunkString(str: string, size: number): string[] {
    const chunks = []
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size))
    }
    return chunks
  }
}