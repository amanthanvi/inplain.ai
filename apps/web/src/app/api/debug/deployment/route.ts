import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Return environment and deployment information
  const debugInfo = {
    deployment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      region: process.env.VERCEL_REGION,
      url: process.env.VERCEL_URL,
    },
    clerk: {
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 'SET' : 'NOT_SET',
      secretKey: process.env.CLERK_SECRET_KEY ? 'SET' : 'NOT_SET',
      domain: process.env.NEXT_PUBLIC_CLERK_DOMAIN,
    },
    storage: {
      kvUrl: process.env.KV_REST_API_URL ? 'SET' : 'NOT_SET',
      kvToken: process.env.KV_REST_API_TOKEN ? 'SET' : 'NOT_SET',
      blobUrl: process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'NOT_SET',
    },
    ai: {
      openrouterKey: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT_SET',
      defaultModel: process.env.DEFAULT_AI_MODEL || 'NOT_SET',
    },
    routes: {
      snapshot: '/api/snapshot/[slug]',
      summary: '/api/summary/[slug]',
      analyze: '/api/analyze/[slug]',
    },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(debugInfo, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    }
  })
}