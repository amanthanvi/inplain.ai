import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '../../lib/storage-utils'
import { z } from 'zod'

const requestSchema = z.object({
  blobKey: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { blobKey } = requestSchema.parse(body)

    const storage = getStorage()
    if (!storage) {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 }
      )
    }

    const content = await storage.getDiffContent(blobKey)
    
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