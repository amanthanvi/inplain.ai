import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    vercel: process.env.VERCEL_ENV || 'not-on-vercel',
    message: 'API routes are working!'
  })
}