import { kv } from '@vercel/kv'

/**
 * Get unsubscribe analytics (admin only)
 */
export async function getUnsubscribeAnalytics(days: number = 30): Promise<{
  totalUnsubscribes: number
  reasonBreakdown: Record<string, number>
  dailyStats: Array<{ date: string; count: number }>
  recentFeedback: Array<{ email: string; reason?: string; feedback?: string; timestamp: string }>
}> {
  const promises = []
  const dates = []
  
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    dates.push(dateStr)
    
    promises.push(kv.get(`email:stats:unsubscribed:${dateStr}`))
  }
  
  const results = await Promise.all(promises)
  const dailyStats = []
  let totalUnsubscribes = 0
  
  for (let i = 0; i < dates.length; i++) {
    const count = (results[i] as number) || 0
    totalUnsubscribes += count
    dailyStats.push({
      date: dates[i],
      count
    })
  }
  
  // Get reason breakdown
  const reasonBreakdown: Record<string, number> = {}
  try {
    const reasons = await kv.get('email:stats:unsubscribe_reasons') as Record<string, number> || {}
    Object.assign(reasonBreakdown, reasons)
  } catch (error) {
    console.error('Failed to get reason breakdown:', error)
  }
  
  // Get recent feedback
  const recentFeedback = []
  try {
    const feedback = await kv.lrange('email:unsubscribe_feedback', 0, 9) // Get last 10
    for (const item of feedback) {
      try {
        const parsed = JSON.parse(item as string)
        recentFeedback.push(parsed)
      } catch (error) {
        console.error('Failed to parse feedback item:', error)
      }
    }
  } catch (error) {
    console.error('Failed to get recent feedback:', error)
  }
  
  return {
    totalUnsubscribes,
    reasonBreakdown,
    dailyStats: dailyStats.reverse(), // Most recent first
    recentFeedback
  }
}