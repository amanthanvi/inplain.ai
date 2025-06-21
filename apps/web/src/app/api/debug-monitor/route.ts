import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { formatTimestamp, hashContent } from '@policydiff/shared'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') || 'google'
  
  try {
    console.log('[Debug] Starting debug monitor for', slug)
    
    // Step 1: Get companies from KV
    console.log('[Debug] Step 1: Getting companies from KV')
    const companies = await kv.get<any[]>('companies:active')
    console.log('[Debug] Companies:', companies)
    
    if (!companies || companies.length === 0) {
      console.log('[Debug] No companies found, setting defaults')
      const defaultCompanies = [
        { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', checkInterval: 86400, active: true }
      ]
      await kv.set('companies:active', defaultCompanies)
    }
    
    const company = companies?.find((c: any) => c.slug === slug) || 
      { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', checkInterval: 86400, active: true }
    
    console.log('[Debug] Company:', company)
    
    // Step 2: Test fetch
    console.log('[Debug] Step 2: Testing fetch for', company.url)
    const fetchStart = Date.now()
    
    try {
      const response = await fetch(company.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PolicyDiff/1.0; +https://policydiff.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        redirect: 'follow'
      })
      
      const fetchTime = Date.now() - fetchStart
      console.log('[Debug] Fetch completed in', fetchTime, 'ms')
      console.log('[Debug] Response status:', response.status)
      console.log('[Debug] Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const text = await response.text()
      console.log('[Debug] Content length:', text.length)
      
      // Step 3: Test content hashing
      console.log('[Debug] Step 3: Testing content hash')
      const contentHash = await hashContent(text)
      console.log('[Debug] Content hash:', contentHash)
      
      // Step 4: Test KV operations
      console.log('[Debug] Step 4: Testing KV operations')
      const testKey = `debug:${slug}:${Date.now()}`
      await kv.set(testKey, { content: 'test', timestamp: formatTimestamp() }, { ex: 60 })
      const testValue = await kv.get(testKey)
      console.log('[Debug] KV test:', testValue)
      
      // Step 5: Test blob storage (without actually storing)
      console.log('[Debug] Step 5: Blob storage would store', text.length, 'bytes')
      
      return NextResponse.json({
        success: true,
        company,
        fetch: {
          status: response.status,
          contentLength: text.length,
          fetchTime: `${fetchTime}ms`,
          preview: text.substring(0, 200)
        },
        contentHash,
        kvTest: testValue,
        timestamp: formatTimestamp()
      })
      
    } catch (fetchError) {
      console.error('[Debug] Fetch error:', fetchError)
      return NextResponse.json({
        success: false,
        company,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        timestamp: formatTimestamp()
      })
    }
    
  } catch (error) {
    console.error('[Debug] General error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: formatTimestamp()
    }, { status: 500 })
  }
}