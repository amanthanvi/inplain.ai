import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage/adapter'
import { z } from 'zod'

const requestSchema = z.object({
  slug: z.string(),
  diffId: z.string()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const diffId = searchParams.get('diffId')

    if (!slug || !diffId) {
      return NextResponse.json(
        { error: 'Missing required parameters: slug and diffId' },
        { status: 400 }
      )
    }

    if (!storage) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      )
    }

    const content = await storage.getDiffContent(slug, diffId)
    
    if (!content) {
      return NextResponse.json(
        { error: 'Diff content not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(content)
  } catch (error) {
    console.error('Error fetching diff content:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, diffId } = requestSchema.parse(body)

    if (!storage) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      )
    }

    const content = await storage.getDiffContent(slug, diffId)
    
    if (!content) {
      return NextResponse.json(
        { error: 'Diff content not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(content)
  } catch (error) {
    console.error('Error fetching diff content:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}