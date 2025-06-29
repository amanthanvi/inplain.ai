import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { notifyPolicyChange, notifyRiskAlert, notifyAnalysisComplete, notifySystem } from '@/lib/notifications/monitoring-integration'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type = 'system' } = await request.json()

    switch (type) {
      case 'policy-change':
        await notifyPolicyChange({
          companySlug: 'test-company',
          companyName: 'Test Company',
          policyType: 'privacy',
          changeType: 'moderate',
          summary: 'This is a test notification for policy changes',
          riskLevel: 'medium',
          detectedAt: new Date().toISOString(),
          diffUrl: '/test-company'
        })
        break

      case 'risk-alert':
        await notifyRiskAlert({
          companySlug: 'test-company',
          companyName: 'Test Company',
          alertType: 'data-collection',
          severity: 'critical',
          description: 'This is a test risk alert notification',
          affectedSections: ['Data Collection', 'Third Party Sharing'],
          detectedAt: new Date().toISOString()
        })
        break

      case 'analysis-complete':
        await notifyAnalysisComplete(
          userId,
          'test-company',
          'Test Company',
          'privacy policy analysis'
        )
        break

      case 'system':
      default:
        await notifySystem(
          userId,
          'Test Notification',
          'This is a test notification to verify your settings are working correctly',
          'info',
          { label: 'Dismiss' }
        )
        break
    }

    return NextResponse.json({ 
      success: true, 
      message: `Test ${type} notification sent` 
    })
  } catch (error) {
    console.error('Failed to send test notification:', error)
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}