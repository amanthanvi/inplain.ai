import { NextRequest, NextResponse } from 'next/server'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

// Use the shared companies list
const ALL_COMPANIES = WATCHED_COMPANIES

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    
    let filteredCompanies = [...ALL_COMPANIES]
    
    // Filter by category
    if (category) {
      filteredCompanies = filteredCompanies.filter(c => 
        c.category?.toLowerCase() === category.toLowerCase()
      )
    }
    
    // Filter by active status
    if (active !== null) {
      filteredCompanies = filteredCompanies.filter(c => 
        c.active === (active === 'true')
      )
    }
    
    // Filter by search query
    if (search) {
      const query = search.toLowerCase()
      filteredCompanies = filteredCompanies.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.slug.toLowerCase().includes(query) ||
        c.category?.toLowerCase().includes(query) ||
        c.url.toLowerCase().includes(query)
      )
    }
    
    // Apply limit
    if (limit) {
      const limitNum = parseInt(limit, 10)
      if (!isNaN(limitNum) && limitNum > 0) {
        filteredCompanies = filteredCompanies.slice(0, limitNum)
      }
    }
    
    // Get unique categories for filtering
    const categories = [...new Set(ALL_COMPANIES.map(c => c.category).filter(Boolean))]
    
    return NextResponse.json({
      companies: filteredCompanies,
      total: filteredCompanies.length,
      categories: categories.sort()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    })
  } catch (error) {
    console.error('Companies API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

// Get company by slug
export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json()
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }
    
    const company = ALL_COMPANIES.find(c => c.slug === slug)
    
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ company })
  } catch (error) {
    console.error('Company lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    )
  }
}