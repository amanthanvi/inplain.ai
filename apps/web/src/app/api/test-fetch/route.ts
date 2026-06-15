import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'This diagnostic endpoint is disabled' }, { status: 410 })
  }

  const url = request.nextUrl.searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
  }
  
  try {
    console.log(`[Test-Fetch] Testing fetch for ${url}`)
    
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Inplain.AI/1.0; +https://inplain.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow' as RequestRedirect
    }
    
    const startTime = Date.now()
    const response = await fetch(url, fetchOptions)
    const fetchTime = Date.now() - startTime
    
    const text = await response.text()
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      contentLength: text.length,
      fetchTime: `${fetchTime}ms`,
      preview: text.substring(0, 500),
      url: response.url,
      redirected: response.redirected
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
