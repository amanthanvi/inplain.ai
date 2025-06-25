'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { extractDomain } from '@inplain.ai/shared/utils'
import type { Company } from '@inplain.ai/shared'

interface CompanyCardProps {
  company: Company
}

export function CompanyCard({ company }: CompanyCardProps) {
  const router = useRouter()

  const handleClick = () => {
    console.log('Navigating to:', `/${company.slug}`)
    router.push(`/${company.slug}`)
  }

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full group hover:scale-[1.02] hover:border-primary/50"
      onClick={handleClick}
    >
      <CardHeader>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {company.name}
            </CardTitle>
            {company.active && (
              <Badge variant="success" className="ml-2 text-xs">Active</Badge>
            )}
          </div>
          <div className="space-y-2">
            <CardDescription className="text-sm">
              {extractDomain(company.url)}
            </CardDescription>
            {company.category && (
              <Badge variant="secondary" className="text-xs">
                {company.category}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}