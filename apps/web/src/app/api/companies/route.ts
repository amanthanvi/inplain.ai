import { NextRequest, NextResponse } from 'next/server'
import { Company } from '@inplain.ai/shared'

// Extended list of companies to track
const ALL_COMPANIES: Company[] = [
  // Big Tech
  { slug: 'google', name: 'Google', url: 'https://policies.google.com/privacy', active: true, checkInterval: 86400, category: 'Big Tech' },
  { slug: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/privacy/policy', active: true, checkInterval: 86400, category: 'Big Tech' },
  { slug: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=468496', active: true, checkInterval: 86400, category: 'Big Tech' },
  { slug: 'microsoft', name: 'Microsoft', url: 'https://privacy.microsoft.com/en-us/privacystatement', active: true, checkInterval: 86400, category: 'Big Tech' },
  { slug: 'apple', name: 'Apple', url: 'https://www.apple.com/legal/privacy/', active: true, checkInterval: 86400, category: 'Big Tech' },
  
  // Social Media
  { slug: 'twitter', name: 'Twitter/X', url: 'https://twitter.com/privacy', active: true, checkInterval: 86400, category: 'Social Media' },
  { slug: 'instagram', name: 'Instagram', url: 'https://help.instagram.com/519522125107875', active: true, checkInterval: 86400, category: 'Social Media' },
  { slug: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/legal/privacy-policy', active: true, checkInterval: 86400, category: 'Social Media' },
  { slug: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/legal/privacy-policy', active: true, checkInterval: 86400, category: 'Social Media' },
  { slug: 'snapchat', name: 'Snapchat', url: 'https://www.snap.com/privacy/privacy-policy', active: true, checkInterval: 86400, category: 'Social Media' },
  { slug: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/policies/privacy-policy', active: true, checkInterval: 86400, category: 'Social Media' },
  { slug: 'pinterest', name: 'Pinterest', url: 'https://policy.pinterest.com/privacy-policy', active: true, checkInterval: 86400, category: 'Social Media' },
  
  // Streaming & Entertainment
  { slug: 'netflix', name: 'Netflix', url: 'https://help.netflix.com/legal/privacy', active: true, checkInterval: 86400, category: 'Streaming' },
  { slug: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/howyoutubeworks/our-commitments/protecting-user-data/', active: true, checkInterval: 86400, category: 'Streaming' },
  { slug: 'spotify', name: 'Spotify', url: 'https://www.spotify.com/legal/privacy-policy/', active: true, checkInterval: 86400, category: 'Streaming' },
  { slug: 'disney-plus', name: 'Disney+', url: 'https://www.disneyplus.com/legal/privacy-policy', active: true, checkInterval: 86400, category: 'Streaming' },
  { slug: 'hulu', name: 'Hulu', url: 'https://www.hulu.com/privacy', active: true, checkInterval: 86400, category: 'Streaming' },
  { slug: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/p/legal/privacy-notice/', active: true, checkInterval: 86400, category: 'Streaming' },
  
  // E-commerce
  { slug: 'ebay', name: 'eBay', url: 'https://www.ebay.com/help/policies/member-behaviour-policies/user-privacy-notice-privacy-policy', active: true, checkInterval: 86400, category: 'E-commerce' },
  { slug: 'walmart', name: 'Walmart', url: 'https://corporate.walmart.com/privacy-security/privacy-policy', active: true, checkInterval: 86400, category: 'E-commerce' },
  { slug: 'etsy', name: 'Etsy', url: 'https://www.etsy.com/legal/privacy/', active: true, checkInterval: 86400, category: 'E-commerce' },
  { slug: 'shopify', name: 'Shopify', url: 'https://www.shopify.com/legal/privacy', active: true, checkInterval: 86400, category: 'E-commerce' },
  { slug: 'alibaba', name: 'Alibaba', url: 'https://rule.alibaba.com/rule/detail/2034.htm', active: true, checkInterval: 86400, category: 'E-commerce' },
  
  // Productivity & SaaS
  { slug: 'zoom', name: 'Zoom', url: 'https://zoom.us/privacy', active: true, checkInterval: 86400, category: 'Productivity' },
  { slug: 'slack', name: 'Slack', url: 'https://slack.com/privacy-policy', active: true, checkInterval: 86400, category: 'Productivity' },
  { slug: 'dropbox', name: 'Dropbox', url: 'https://www.dropbox.com/privacy', active: true, checkInterval: 86400, category: 'Productivity' },
  { slug: 'notion', name: 'Notion', url: 'https://www.notion.so/Privacy-Policy', active: true, checkInterval: 86400, category: 'Productivity' },
  { slug: 'atlassian', name: 'Atlassian', url: 'https://www.atlassian.com/legal/privacy-policy', active: true, checkInterval: 86400, category: 'Productivity' },
  
  // Gaming
  { slug: 'epic-games', name: 'Epic Games', url: 'https://www.epicgames.com/site/en-US/privacypolicy', active: true, checkInterval: 86400, category: 'Gaming' },
  { slug: 'steam', name: 'Steam', url: 'https://store.steampowered.com/privacy_agreement/', active: true, checkInterval: 86400, category: 'Gaming' },
  { slug: 'playstation', name: 'PlayStation', url: 'https://www.playstation.com/legal/privacy-policy/', active: true, checkInterval: 86400, category: 'Gaming' },
  { slug: 'xbox', name: 'Xbox', url: 'https://privacy.microsoft.com/en-us/privacystatement', active: true, checkInterval: 86400, category: 'Gaming' },
  { slug: 'nintendo', name: 'Nintendo', url: 'https://www.nintendo.com/privacy-policy/', active: true, checkInterval: 86400, category: 'Gaming' },
  
  // Finance & Payments
  { slug: 'paypal', name: 'PayPal', url: 'https://www.paypal.com/us/webapps/mpp/ua/privacy-full', active: true, checkInterval: 86400, category: 'Finance' },
  { slug: 'stripe', name: 'Stripe', url: 'https://stripe.com/privacy', active: true, checkInterval: 86400, category: 'Finance' },
  { slug: 'square', name: 'Square', url: 'https://squareup.com/legal/general/privacy', active: true, checkInterval: 86400, category: 'Finance' },
  { slug: 'venmo', name: 'Venmo', url: 'https://venmo.com/legal/us-privacy-policy/', active: true, checkInterval: 86400, category: 'Finance' },
  { slug: 'coinbase', name: 'Coinbase', url: 'https://www.coinbase.com/legal/privacy', active: true, checkInterval: 86400, category: 'Finance' },
  
  // AI & Tech Tools
  { slug: 'openai', name: 'OpenAI', url: 'https://openai.com/policies/privacy-policy', active: true, checkInterval: 86400, category: 'AI' },
  { slug: 'anthropic', name: 'Anthropic', url: 'https://www.anthropic.com/privacy', active: true, checkInterval: 86400, category: 'AI' },
  { slug: 'github', name: 'GitHub', url: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement', active: true, checkInterval: 86400, category: 'Developer Tools' },
  { slug: 'gitlab', name: 'GitLab', url: 'https://about.gitlab.com/privacy/', active: true, checkInterval: 86400, category: 'Developer Tools' },
  
  // Transportation
  { slug: 'uber', name: 'Uber', url: 'https://www.uber.com/legal/en/document/?name=privacy-notice', active: true, checkInterval: 86400, category: 'Transportation' },
  { slug: 'lyft', name: 'Lyft', url: 'https://www.lyft.com/privacy', active: true, checkInterval: 86400, category: 'Transportation' },
  { slug: 'airbnb', name: 'Airbnb', url: 'https://www.airbnb.com/help/article/2908', active: true, checkInterval: 86400, category: 'Travel' },
  { slug: 'booking', name: 'Booking.com', url: 'https://www.booking.com/content/privacy.html', active: true, checkInterval: 86400, category: 'Travel' },
  
  // Communication
  { slug: 'whatsapp', name: 'WhatsApp', url: 'https://www.whatsapp.com/legal/privacy-policy', active: true, checkInterval: 86400, category: 'Communication' },
  { slug: 'telegram', name: 'Telegram', url: 'https://telegram.org/privacy', active: true, checkInterval: 86400, category: 'Communication' },
  { slug: 'discord', name: 'Discord', url: 'https://discord.com/privacy', active: true, checkInterval: 86400, category: 'Communication' },
  { slug: 'signal', name: 'Signal', url: 'https://signal.org/legal/', active: true, checkInterval: 86400, category: 'Communication' }
]

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