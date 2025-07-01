/**
 * API Documentation Generator
 * 
 * Generates OpenAPI/Swagger documentation for the API
 */

import { z } from 'zod'

/**
 * API endpoint documentation
 */
interface APIEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  summary: string
  description: string
  tags: string[]
  authentication: boolean
  parameters?: APIParameter[]
  requestBody?: APIRequestBody
  responses: APIResponse[]
  examples?: APIExample[]
}

interface APIParameter {
  name: string
  in: 'path' | 'query' | 'header'
  required: boolean
  schema: any
  description: string
}

interface APIRequestBody {
  required: boolean
  content: {
    [contentType: string]: {
      schema: any
      example?: any
    }
  }
}

interface APIResponse {
  status: number
  description: string
  content?: {
    [contentType: string]: {
      schema: any
      example?: any
    }
  }
}

interface APIExample {
  name: string
  request?: any
  response: any
}

/**
 * API Documentation Registry
 */
export class APIDocumentation {
  private static endpoints: APIEndpoint[] = []
  
  /**
   * Register an API endpoint
   */
  static register(endpoint: APIEndpoint) {
    this.endpoints.push(endpoint)
  }
  
  /**
   * Generate OpenAPI specification
   */
  static generateOpenAPISpec() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Inplain.AI API',
        version: '1.0.0',
        description: 'Privacy policy monitoring and analysis API',
        contact: {
          name: 'API Support',
          email: 'api@inplain.ai'
        }
      },
      servers: [
        {
          url: 'https://api.inplain.ai',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.inplain.ai',
          description: 'Staging server'
        }
      ],
      paths: this.generatePaths(),
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: this.generateSchemas()
      },
      tags: this.generateTags()
    }
  }
  
  private static generatePaths() {
    const paths: any = {}
    
    for (const endpoint of this.endpoints) {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {}
      }
      
      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        security: endpoint.authentication ? [{ BearerAuth: [] }] : undefined,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: this.formatResponses(endpoint.responses)
      }
    }
    
    return paths
  }
  
  private static formatResponses(responses: APIResponse[]) {
    const formatted: any = {}
    
    for (const response of responses) {
      formatted[response.status] = {
        description: response.description,
        content: response.content
      }
    }
    
    return formatted
  }
  
  private static generateSchemas() {
    return {
      Company: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          website: { type: 'string' },
          logo: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      PolicySnapshot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          companyId: { type: 'string' },
          version: { type: 'string' },
          content: { type: 'string' },
          summary: { type: 'string' },
          hash: { type: 'string' },
          capturedAt: { type: 'string', format: 'date-time' },
          changes: {
            type: 'object',
            properties: {
              added: { type: 'array', items: { type: 'string' } },
              removed: { type: 'array', items: { type: 'string' } },
              modified: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      Analysis: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          companyId: { type: 'string' },
          type: { type: 'string', enum: ['summary', 'comparison', 'premium'] },
          result: { type: 'object' },
          model: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        }
      }
    }
  }
  
  private static generateTags() {
    const tags = new Set<string>()
    
    for (const endpoint of this.endpoints) {
      endpoint.tags.forEach(tag => tags.add(tag))
    }
    
    return Array.from(tags).map(tag => ({
      name: tag,
      description: `${tag} related endpoints`
    }))
  }
}

/**
 * API endpoint documentation
 */

// Companies endpoints
APIDocumentation.register({
  path: '/api/companies',
  method: 'GET',
  summary: 'List companies',
  description: 'Get a paginated list of monitored companies',
  tags: ['Companies'],
  authentication: false,
  parameters: [
    {
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1 },
      description: 'Page number'
    },
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100 },
      description: 'Items per page'
    },
    {
      name: 'category',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Filter by category'
    }
  ],
  responses: [
    {
      status: 200,
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/Company' }
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  ]
})

APIDocumentation.register({
  path: '/api/companies/{slug}',
  method: 'GET',
  summary: 'Get company details',
  description: 'Get detailed information about a specific company',
  tags: ['Companies'],
  authentication: false,
  parameters: [
    {
      name: 'slug',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Company slug'
    }
  ],
  responses: [
    {
      status: 200,
      description: 'Successful response',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Company' }
        }
      }
    },
    {
      status: 404,
      description: 'Company not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    }
  ]
})

// Snapshots endpoints
APIDocumentation.register({
  path: '/api/companies/{slug}/snapshots',
  method: 'GET',
  summary: 'List policy snapshots',
  description: 'Get a list of policy snapshots for a company',
  tags: ['Snapshots'],
  authentication: false,
  parameters: [
    {
      name: 'slug',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Company slug'
    },
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 50 },
      description: 'Number of snapshots to return'
    }
  ],
  responses: [
    {
      status: 200,
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/PolicySnapshot' }
          }
        }
      }
    }
  ]
})

// Analysis endpoints
APIDocumentation.register({
  path: '/api/summary/{slug}',
  method: 'POST',
  summary: 'Generate AI summary',
  description: 'Generate an AI-powered summary of policy changes',
  tags: ['Analysis'],
  authentication: true,
  parameters: [
    {
      name: 'slug',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Company slug'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            analysisType: {
              type: 'string',
              enum: ['changes', 'full', 'comparison']
            },
            model: {
              type: 'string',
              enum: ['openai/gpt-4-turbo-preview', 'anthropic/claude-3-opus']
            },
            versions: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  },
  responses: [
    {
      status: 200,
      description: 'Successful response',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Analysis' }
        }
      }
    },
    {
      status: 429,
      description: 'Rate limit exceeded',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    }
  ]
})

// Health check endpoint
APIDocumentation.register({
  path: '/api/health',
  method: 'GET',
  summary: 'Health check',
  description: 'Check the health status of the API',
  tags: ['System'],
  authentication: false,
  responses: [
    {
      status: 200,
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
              version: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'boolean' },
                  redis: { type: 'boolean' },
                  externalAPIs: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }
  ]
})

/**
 * API versioning utilities
 */
export class APIVersioning {
  static readonly CURRENT_VERSION = '1.0.0'
  static readonly SUPPORTED_VERSIONS = ['1.0.0']
  
  /**
   * Parse version from request
   */
  static parseVersion(request: Request): string {
    // Check header first
    const headerVersion = request.headers.get('X-API-Version')
    if (headerVersion) return headerVersion
    
    // Check URL path
    const url = new URL(request.url)
    const pathMatch = url.pathname.match(/^\/api\/v(\d+\.\d+\.\d+)\//)
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1]
    }
    
    // Default to current version
    return this.CURRENT_VERSION
  }
  
  /**
   * Check if version is supported
   */
  static isVersionSupported(version: string): boolean {
    return this.SUPPORTED_VERSIONS.includes(version)
  }
  
  /**
   * Get deprecation notice
   */
  static getDeprecationNotice(version: string): string | null {
    // Add deprecation notices as needed
    return null
  }
}