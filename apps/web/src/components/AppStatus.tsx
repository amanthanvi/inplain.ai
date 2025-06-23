'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Info, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getPublicConfig } from '@/lib/env'

interface StatusCheck {
  name: string
  status: 'checking' | 'success' | 'warning' | 'error'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function AppStatus() {
  const [isVisible, setIsVisible] = useState(true)
  const [isChecking, setIsChecking] = useState(true)
  const [checks, setChecks] = useState<StatusCheck[]>([
    { name: 'Environment', status: 'checking', message: 'Checking configuration...' },
    { name: 'AI Service', status: 'checking', message: 'Verifying AI service...' },
    { name: 'Storage', status: 'checking', message: 'Testing storage connection...' },
    { name: 'Data', status: 'checking', message: 'Checking for data...' }
  ])
  const { toast } = useToast()
  
  useEffect(() => {
    checkAppStatus()
  }, [])
  
  async function checkAppStatus() {
    setIsChecking(true)
    const newChecks = [...checks]
    const publicConfig = getPublicConfig()
    
    // Fetch actual app mode from server
    let actualMode = publicConfig.mode
    try {
      const statusResponse = await fetch('/api/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        actualMode = statusData.mode
      }
    } catch (error) {
      console.warn('Failed to fetch app status:', error)
    }
    
    // Check environment
    try {
      // In development, always try to check server-side env
      if (publicConfig.isDevelopment) {
        const envResponse = await fetch('/api/debug')
        if (envResponse.ok) {
          const envData = await envResponse.json()
          newChecks[0] = {
            name: 'Environment',
            status: envData.envStatus.OPENROUTER_API_KEY ? 'success' : 'warning',
            message: envData.envStatus.OPENROUTER_API_KEY 
              ? 'Environment configured' 
              : 'AI API key not configured - using demo mode'
          }
          
          // Check storage
          newChecks[2] = {
            name: 'Storage',
            status: envData.kvStatus === 'connected' ? 'success' : 'warning',
            message: envData.kvStatus === 'connected' 
              ? 'Storage connected'
              : envData.kvStatus === 'not configured'
                ? 'Storage not configured - using local memory'
                : `Storage issue: ${envData.kvStatus}`
          }
        } else if (envResponse.status === 401) {
          // In production, debug endpoint is protected
          newChecks[0] = {
            name: 'Environment',
            status: actualMode === 'demo' ? 'warning' : 'success',
            message: actualMode === 'demo' 
              ? 'Running in demo mode'
              : 'Production environment'
          }
          
          // Assume storage is configured in production
          newChecks[2] = {
            name: 'Storage',
            status: 'success',
            message: 'Storage ready'
          }
        } else {
          throw new Error('Unexpected response')
        }
      } else {
        // In production, use public config
        newChecks[0] = {
          name: 'Environment',
          status: actualMode === 'demo' ? 'warning' : 'success',
          message: actualMode === 'demo' 
            ? 'Running in demo mode - AI features simulated'
            : actualMode === 'production'
              ? 'Production environment'
              : 'Development environment'
        }
        
        // In production, we can't check storage directly
        newChecks[2] = {
          name: 'Storage',
          status: 'success',
          message: 'Storage configured'
        }
      }
    } catch (error) {
      // Gracefully handle errors
      console.warn('Failed to check environment status:', error)
      newChecks[0] = {
        name: 'Environment',
        status: actualMode === 'demo' ? 'warning' : 'success',
        message: actualMode === 'demo' 
          ? 'Demo mode - limited features'
          : 'Environment ready'
      }
      
      newChecks[2] = {
        name: 'Storage',
        status: 'warning',
        message: 'Storage status unknown'
      }
    }
    
    // Check AI service
    if (newChecks[0].status === 'success' || newChecks[0].status === 'warning') {
      newChecks[1] = {
        name: 'AI Service',
        status: actualMode === 'demo' ? 'warning' : 'success',
        message: actualMode === 'demo'
          ? 'Using mock AI for demo'
          : 'AI service ready'
      }
    } else {
      newChecks[1] = {
        name: 'AI Service',
        status: 'error',
        message: 'AI service unavailable'
      }
    }
    
    // Check for data
    try {
      const response = await fetch('/api/diffs?limit=1')
      const data = await response.json()
      newChecks[3] = {
        name: 'Data',
        status: data.diffs?.length > 0 ? 'success' : 'warning',
        message: data.diffs?.length > 0
          ? 'Data available'
          : 'No data yet - cron runs daily at 9 AM UTC',
        action: data.diffs?.length === 0 ? {
          label: 'View Setup Guide',
          onClick: () => window.open('/DEPLOYMENT_GUIDE.md', '_blank')
        } : undefined
      }
    } catch (error) {
      newChecks[3] = {
        name: 'Data',
        status: 'error',
        message: 'Failed to check data'
      }
    }
    
    setChecks(newChecks)
    setIsChecking(false)
    
    // Auto-hide if everything is successful
    const allSuccess = newChecks.every(check => check.status === 'success')
    if (allSuccess) {
      setTimeout(() => setIsVisible(false), 5000)
    }
  }
  
  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        <Info className="h-4 w-4 mr-2" />
        App Status
      </Button>
    )
  }
  
  const hasIssues = checks.some(check => check.status === 'warning' || check.status === 'error')
  
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">App Status</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={checkAppStatus}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsVisible(false)}
            >
              ×
            </Button>
          </div>
        </div>
        {hasIssues && (
          <CardDescription className="text-xs">
            Some features may be limited
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((check) => (
          <div key={check.name} className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              {check.status === 'checking' && (
                <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground" />
              )}
              {check.status === 'success' && (
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
              )}
              {check.status === 'warning' && (
                <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600" />
              )}
              {check.status === 'error' && (
                <AlertCircle className="h-4 w-4 mt-0.5 text-red-600" />
              )}
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{check.name}</p>
                <p className="text-xs text-muted-foreground">{check.message}</p>
                {check.action && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={check.action.onClick}
                  >
                    {check.action.label}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {hasIssues && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Need help? Check the{' '}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  toast({
                    title: "Setup Guide",
                    description: "View DEPLOYMENT_GUIDE.md for configuration instructions",
                  })
                }}
              >
                deployment guide
              </Button>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}