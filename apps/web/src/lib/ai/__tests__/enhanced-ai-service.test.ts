import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EnhancedAIService, AI_MODELS, ANALYSIS_PROMPTS, SYSTEM_PROMPTS } from '../enhanced-ai-service'

// Mock OpenAI
vi.mock('openai', () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockImplementation((params) => {
            // Return different responses based on the prompt content
            const baseResponse = {
              summary: 'Test analysis',
              score: 85,
              recommendations: ['Test recommendation'],
              insights: [
                {
                  type: 'privacy_risk',
                  title: 'Test Insight',
                  description: 'Test description',
                  importance: 'high'
                }
              ],
              data_collection: {
                types: ['personal', 'usage'],
                purposes: ['analytics', 'improvement']
              },
              user_rights: {
                access: true,
                deletion: true,
                portability: true
              }
            }
            
            return Promise.resolve({
              choices: [{
                message: {
                  content: JSON.stringify(baseResponse)
                }
              }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 50
              }
            })
          })
        }
      }
    }))
  }
})

// Mock fetch
global.fetch = vi.fn()

describe('EnhancedAIService', () => {
  let enhancedAIService: EnhancedAIService

  beforeEach(() => {
    vi.clearAllMocks()
    // Create a new instance for each test
    enhancedAIService = new EnhancedAIService('test-api-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('analyzePrivacyPolicy', () => {
    const mockPolicyText = 'This is a test privacy policy. We collect user data for analytics.'

    it('should analyze privacy policy with default options', async () => {
      const result = await enhancedAIService.analyzePrivacyPolicy(mockPolicyText, {
        analysisType: 'comprehensive'
      })

      expect(result).toHaveProperty('analysis')
      expect(result).toHaveProperty('insights')
      expect(result).toHaveProperty('perspectives')
      expect(result).toHaveProperty('confidence')
      expect(result.insights).toBeInstanceOf(Array)
    })

    it('should use multiple perspectives when specified', async () => {
      const result = await enhancedAIService.analyzePrivacyPolicy(mockPolicyText, {
        analysisType: 'comprehensive',
        perspectives: ['consumer', 'regulator', 'business']
      })

      expect(result.perspectives).toHaveProperty('consumer')
      expect(result.perspectives).toHaveProperty('regulator')
      expect(result.perspectives).toHaveProperty('business')
    })

    it('should generate insights based on configuration', async () => {
      const result = await enhancedAIService.analyzePrivacyPolicy(mockPolicyText, {
        analysisType: 'comprehensive',
        insightConfig: {
          categories: ['privacy_risks', 'compliance', 'user_rights'],
          depth: 'detailed',
          comparisons: true,
          visualizations: true,
          relatedInsights: true
        }
      })

      expect(result.insights.length).toBeGreaterThan(0)
      const insight = result.insights[0]
      expect(insight).toHaveProperty('id')
      expect(insight).toHaveProperty('type')
      expect(insight).toHaveProperty('title')
      expect(insight).toHaveProperty('importance')
    })

    it('should include metadata in analysis when provided', async () => {
      const metadata = {
        company: 'TestCorp',
        industry: 'Technology',
        previousVersions: ['Previous policy text']
      }

      const result = await enhancedAIService.analyzePrivacyPolicy(mockPolicyText, {
        analysisType: 'comprehensive',
        metadata
      })

      expect(result.analysis).toBeDefined()
      expect(result.metadata).toEqual(metadata)
    })

    it('should handle different analysis types', async () => {
      const analysisTypes = Object.keys(ANALYSIS_PROMPTS) as Array<keyof typeof ANALYSIS_PROMPTS>
      
      for (const analysisType of analysisTypes.slice(0, 3)) { // Test first 3 types
        const result = await enhancedAIService.analyzePrivacyPolicy(mockPolicyText, {
          analysisType
        })

        expect(result).toHaveProperty('analysis')
        expect(result.analysisType).toBe(analysisType)
      }
    })
  })

  describe('streamAnalysis', () => {
    it('should stream analysis results', async () => {
      const mockCreateStream = vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Test' } }] }
          yield { choices: [{ delta: { content: ' streaming' } }] }
        }
      })

      // @ts-ignore - accessing private property for testing
      const openai = enhancedAIService['openai']
      vi.mocked(openai.chat.completions.create)
        .mockImplementation(mockCreateStream)

      const chunks: string[] = []
      const generator = enhancedAIService.streamAnalysis({
        policyText: 'Test policy',
        analysisType: 'comprehensive',
        options: {
          model: AI_MODELS.fast.primary,
          temperature: 0.5,
          maxTokens: 1000
        }
      })

      for await (const chunk of generator) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Test', ' streaming'])
      expect(mockCreateStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: AI_MODELS.fast.primary,
          stream: true
        })
      )
    })
  })

  describe('getModelRecommendations', () => {
    it('should provide model recommendations', () => {
      const recommendations = enhancedAIService.getModelRecommendations()

      expect(recommendations).toHaveProperty('costOptimization')
      expect(recommendations).toHaveProperty('performanceMetrics')
      expect(recommendations).toHaveProperty('recommendations')
      expect(recommendations.recommendations).toBeInstanceOf(Array)
      expect(recommendations.recommendations.length).toBeGreaterThan(0)
    })

    it('should include performance metrics for models', () => {
      const recommendations = enhancedAIService.getModelRecommendations()
      const metrics = recommendations.performanceMetrics

      expect(metrics[AI_MODELS.fast.primary]).toHaveProperty('avgLatency')
      expect(metrics[AI_MODELS.fast.primary]).toHaveProperty('successRate')
      expect(metrics[AI_MODELS.balanced.primary]).toBeDefined()
      expect(metrics[AI_MODELS.advanced.primary]).toBeDefined()
    })
  })

  describe('AI_MODELS configuration', () => {
    it('should have proper model configurations', () => {
      expect(AI_MODELS.fast).toHaveProperty('primary')
      expect(AI_MODELS.fast).toHaveProperty('fallback')
      expect(AI_MODELS.fast).toHaveProperty('maxTokens')
      expect(AI_MODELS.fast).toHaveProperty('temperature')
      expect(AI_MODELS.fast).toHaveProperty('capabilities')

      expect(AI_MODELS.balanced).toBeDefined()
      expect(AI_MODELS.advanced).toBeDefined()
      expect(AI_MODELS.vision).toBeDefined()
      expect(AI_MODELS.code).toBeDefined()
    })

    it('should have increasing token limits', () => {
      expect(AI_MODELS.fast.maxTokens).toBeLessThan(AI_MODELS.balanced.maxTokens)
      expect(AI_MODELS.balanced.maxTokens).toBeLessThan(AI_MODELS.advanced.maxTokens)
    })

    it('should have appropriate capabilities', () => {
      expect(AI_MODELS.fast.capabilities).toContain('summarization')
      expect(AI_MODELS.balanced.capabilities).toContain('analysis')
      expect(AI_MODELS.advanced.capabilities).toContain('deep-analysis')
    })
  })

  describe('SYSTEM_PROMPTS configuration', () => {
    it('should have all required prompts', () => {
      const requiredPrompts = ['privacyExpert', 'legalAnalyst', 'securityAdvisor', 'userAdvocate', 'dataScientist', 'complianceOfficer']
      
      requiredPrompts.forEach(prompt => {
        expect(SYSTEM_PROMPTS).toHaveProperty(prompt)
      })
    })

    it('should have properly formatted prompts', () => {
      Object.values(SYSTEM_PROMPTS).forEach(prompt => {
        expect(typeof prompt).toBe('string')
        expect(prompt.length).toBeGreaterThan(50)
      })
    })
  })

  describe('ANALYSIS_PROMPTS configuration', () => {
    it('should have all analysis types', () => {
      const requiredTypes = ['comprehensive', 'comparison', 'riskFocused', 'userFriendly', 'changeAnalysis', 'technicalAudit']
      
      requiredTypes.forEach(type => {
        expect(ANALYSIS_PROMPTS).toHaveProperty(type)
      })
    })

    it('should have valid prompt configurations', () => {
      Object.values(ANALYSIS_PROMPTS).forEach(config => {
        expect(config).toHaveProperty('prompt')
        expect(typeof config.prompt).toBe('string')
        expect(config.prompt.length).toBeGreaterThan(100)
      })
    })
  })

  describe('Error handling', () => {
    it('should handle streaming errors', async () => {
      const mockError = new Error('Stream error')
      // @ts-ignore - accessing private property for testing
      const openai = enhancedAIService['openai']
      vi.mocked(openai.chat.completions.create)
        .mockRejectedValueOnce(mockError)

      const generator = enhancedAIService.streamAnalysis({
        policyText: 'Test policy',
        analysisType: 'comprehensive',
        options: {
          model: AI_MODELS.fast.primary,
          temperature: 0.5,
          maxTokens: 1000
        }
      })

      await expect(async () => {
        const chunks = []
        for await (const chunk of generator) {
          chunks.push(chunk)
        }
      }).rejects.toThrow('Stream error')
    })
  })
})