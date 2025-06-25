import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, ExternalLink, Shield, Clock } from 'lucide-react'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

export async function generateStaticParams() {
  return WATCHED_COMPANIES.map((company) => ({
    slug: company.slug,
  }))
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)

  if (!company) {
    notFound()
  }

  const categoryColors: Record<string, string> = {
    'technology': 'bg-blue-500/10 text-blue-700 border-blue-200',
    'social-media': 'bg-purple-500/10 text-purple-700 border-purple-200',
    'e-commerce': 'bg-green-500/10 text-green-700 border-green-200',
    'entertainment': 'bg-orange-500/10 text-orange-700 border-orange-200',
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-2xl">{company.name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="success">Active</Badge>
                    {company.category && (
                      <Badge 
                        variant="outline" 
                        className={categoryColors[company.category] || ''}
                      >
                        {company.category.replace('-', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Privacy Policy
                </h3>
                <a 
                  href={company.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View Current Policy
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Monitoring
                </h3>
                <p className="text-sm text-muted-foreground">
                  Checked every {company.checkInterval / 3600} hours
                </p>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">About Privacy Monitoring</h3>
              <p className="text-sm text-muted-foreground">
                We continuously monitor {company.name}'s privacy policy for changes. 
                Our AI analyzes updates to help you understand how your data is being used 
                and what rights you have. Add this company to your watchlist to receive 
                alerts when their privacy policy changes.
              </p>
            </div>

            <div className="flex gap-3">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                Add to Watchlist
              </button>
              <button className="px-4 py-2 border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">
                View Change History
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent privacy policy changes detected. We'll notify you when changes occur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}