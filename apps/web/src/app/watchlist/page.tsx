
// Force dynamic rendering to prevent static export
export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, Plus, Eye, Shield, Clock, Building2, 
  AlertCircle, TrendingUp, FileText, ArrowRight,
  Sparkles, CheckCircle, Settings, Star
} from 'lucide-react'
import { WATCHED_COMPANIES } from '@inplain.ai/shared'
import { AnimatedContainer } from '@/components/ui/animations'

export const metadata = {
  title: 'Watchlist - Inplain.AI',
  description: 'Monitor privacy policy changes for companies you care about',
}

interface WatchlistItem {
  company: typeof WATCHED_COMPANIES[0]
  isWatching: boolean
  lastChange?: string
  changeType?: 'minor' | 'significant' | 'critical'
  privacyScore?: 'Excellent' | 'Good' | 'Fair' | 'Poor'
}

// Simulated watchlist data - in production this would come from the database
function getWatchlistData(): WatchlistItem[] {
  return WATCHED_COMPANIES.map(company => ({
    company,
    isWatching: Math.random() > 0.3, // 70% chance of watching
    lastChange: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    changeType: ['minor', 'significant', 'critical'][Math.floor(Math.random() * 3)] as 'minor' | 'significant' | 'critical',
    privacyScore: ['Excellent', 'Good', 'Fair', 'Poor'][Math.floor(Math.random() * 4)] as 'Excellent' | 'Good' | 'Fair' | 'Poor'
  }))
}

function getChangeTypeColor(type?: 'minor' | 'significant' | 'critical') {
  switch (type) {
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'significant':
      return 'text-amber-600 bg-amber-50 border-amber-200'
    case 'minor':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

function getPrivacyScoreColor(score?: 'Excellent' | 'Good' | 'Fair' | 'Poor') {
  switch (score) {
    case 'Excellent':
      return 'text-green-600'
    case 'Good':
      return 'text-yellow-600'
    case 'Fair':
      return 'text-orange-600'
    case 'Poor':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export default async function WatchlistPage() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/login')
  }

  const watchlistItems = getWatchlistData()
  const watchedItems = watchlistItems.filter(item => item.isWatching)
  const recentChanges = watchedItems.filter(item => item.lastChange)
    .sort((a, b) => new Date(b.lastChange!).getTime() - new Date(a.lastChange!).getTime())
    .slice(0, 5)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container py-8">
          <AnimatedContainer animation="slideUp">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Watchlist</h1>
                <p className="text-muted-foreground mt-2">
                  Monitor privacy policy changes for {watchedItems.length} companies
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Notification Settings
                </Button>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Company
                </Button>
              </div>
            </div>
          </AnimatedContainer>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Quick Stats */}
        <AnimatedContainer animation="fade" delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Watching</p>
                    <p className="text-2xl font-bold">{watchedItems.length}</p>
                  </div>
                  <Eye className="h-8 w-8 text-primary opacity-20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Recent Changes</p>
                    <p className="text-2xl font-bold">{recentChanges.length}</p>
                  </div>
                  <Bell className="h-8 w-8 text-amber-600 opacity-20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical Alerts</p>
                    <p className="text-2xl font-bold">
                      {watchedItems.filter(item => item.changeType === 'critical').length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-600 opacity-20" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold">{WATCHED_COMPANIES.length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-green-600 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </AnimatedContainer>

        {/* Recent Activity */}
        {recentChanges.length > 0 && (
          <AnimatedContainer animation="slideUp" delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Latest policy changes from your watchlist
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentChanges.map((item, index) => (
                    <div
                      key={item.company.slug}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Link 
                            href={`/${item.company.slug}`}
                            className="font-medium hover:underline"
                          >
                            {item.company.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getChangeTypeColor(item.changeType)}`}
                            >
                              {item.changeType} change
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {item.lastChange && new Date(item.lastChange).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${item.company.slug}`}>
                          View <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </AnimatedContainer>
        )}

        {/* Watched Companies Grid */}
        <AnimatedContainer animation="fade" delay={0.3}>
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Your Watched Companies</h2>
              <Button variant="outline" size="sm" asChild>
                <Link href="/companies">
                  Browse All Companies
                </Link>
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {watchedItems.map((item) => (
                <Card 
                  key={item.company.slug} 
                  className="hover:shadow-lg transition-all duration-200 group"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          <Link 
                            href={`/${item.company.slug}`}
                            className="hover:underline"
                          >
                            {item.company.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {item.company.category || 'Technology'}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Privacy Score</span>
                        <span className={`font-medium ${getPrivacyScoreColor(item.privacyScore)}`}>
                          {item.privacyScore}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last Change</span>
                        <span>
                          {item.lastChange 
                            ? new Date(item.lastChange).toLocaleDateString() 
                            : 'No recent changes'
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="success" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Monitoring
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/${item.company.slug}`}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          View Policy
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Bell className="mr-1.5 h-3.5 w-3.5" />
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </AnimatedContainer>

        {/* Empty State */}
        {watchedItems.length === 0 && (
          <AnimatedContainer animation="scale">
            <Card className="text-center py-12">
              <CardContent>
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No companies in your watchlist</h3>
                <p className="text-muted-foreground mb-6">
                  Start monitoring privacy policy changes by adding companies to your watchlist
                </p>
                <Button asChild>
                  <Link href="/companies">
                    <Plus className="mr-2 h-4 w-4" />
                    Browse Companies
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </AnimatedContainer>
        )}

        {/* CTA Section */}
        <AnimatedContainer animation="slideUp" delay={0.4}>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Get AI-Powered Insights</h3>
                    <p className="text-muted-foreground">
                      Understand policy changes with plain English explanations
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/companies">
                    Explore AI Analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </div>
    </div>
  )
}