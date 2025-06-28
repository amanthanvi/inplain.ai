import { Metadata } from 'next'
import { PerformanceMonitor } from '@/components/performance/PerformanceMonitor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Performance Dashboard | Inplain.AI',
  description: 'Monitor and optimize application performance'
}

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor real-time performance metrics and optimize user experience
        </p>
      </div>

      <PerformanceMonitor />

      {/* Additional Information */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              About Core Web Vitals
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert">
            <p>
              Core Web Vitals are a set of real-world, user-centered metrics that quantify 
              key aspects of the user experience. They measure dimensions of web usability 
              such as load time, interactivity, and the stability of content as it loads.
            </p>
            <ul>
              <li><strong>LCP (Largest Contentful Paint)</strong>: Measures loading performance</li>
              <li><strong>FID (First Input Delay)</strong>: Measures interactivity</li>
              <li><strong>CLS (Cumulative Layout Shift)</strong>: Measures visual stability</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Optimization Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>Optimize images with next/image for automatic lazy loading</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>Use dynamic imports for code splitting</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>Minimize JavaScript bundle size</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>Implement proper caching strategies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>Use CSS containment for layout stability</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}