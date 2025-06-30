
'use client'

import { notFound } from 'next/navigation'
import EnhancedCompanyPage from './page-enhanced'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'

// Generate static params for all companies
export async function generateStaticParams() {
  return WATCHED_COMPANIES.map((company) => ({
    slug: company.slug,
  }))
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    return {
      title: 'Company Not Found - Inplain.AI'
    }
  }
  
  return {
    title: `${company.name} Policy Changes - Inplain.AI`,
    description: `Track privacy policy and terms of service changes for ${company.name}`,
    openGraph: {
      title: `${company.name} Privacy Policy Tracker`,
      description: `Monitor ${company.name}'s privacy policy changes with AI-powered analysis`,
    }
  }
}

export default async function CompanyPage({ params }: PageProps) {
  const { slug } = await params
  const company = WATCHED_COMPANIES.find(c => c.slug === slug)
  
  if (!company) {
    notFound()
  }
  
  return <EnhancedCompanyPage slug={slug} />
}