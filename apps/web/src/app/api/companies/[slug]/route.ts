import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // First check if it's a known company from our watched list
    const watchedCompany = WATCHED_COMPANIES.find(c => c.slug === slug)
    
    if (watchedCompany) {
      return NextResponse.json(watchedCompany)
    }
    
    // Check if we have any data for this company in the database
    const companyKey = `company:${slug}`
    const companyData = await kv.get(companyKey)
    
    if (companyData) {
      return NextResponse.json(companyData)
    }
    
    // Try to infer company data from slug
    const inferredCompany = {
      name: slug.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      slug: slug,
      url: `https://${slug}.com/privacy`, // Common pattern
      category: 'technology', // Default category
      description: 'Privacy policy monitoring in progress',
      lastChecked: null,
      status: 'pending'
    }
    
    // Save the inferred company data
    await kv.set(companyKey, inferredCompany, { ex: 86400 }) // Cache for 24 hours
    
    return NextResponse.json(inferredCompany)
    
  } catch (error) {
    console.error('Company API error:', error)
    
    // Even on error, return a basic company object
    const { slug } = await params
    return NextResponse.json({
      name: slug,
      slug: slug,
      url: '',
      error: 'Failed to load company data'
    })
  }
}