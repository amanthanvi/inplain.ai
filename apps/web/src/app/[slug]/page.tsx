import { notFound } from 'next/navigation'
import { getCompanyBySlug } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CompanyPageSimple({ params }: PageProps) {
  const { slug } = await params
  const company = await getCompanyBySlug(slug)
  
  if (!company) {
    notFound()
  }
  
  return (
    <div className="container py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">{company.name}</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="success">Active</Badge>
                {company.category && (
                  <Badge variant="secondary">{company.category}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Company Details</h3>
              <p><strong>Slug:</strong> {company.slug}</p>
              <p><strong>URL:</strong> {company.url}</p>
              <p><strong>Category:</strong> {company.category || 'Not specified'}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Privacy Policy</h3>
              <p className="text-sm text-muted-foreground">
                Track privacy policy changes for {company.name} with AI-powered analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}