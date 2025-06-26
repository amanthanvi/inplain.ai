import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { kv } from '@vercel/kv'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Keep alive interval (30 seconds)
const KEEP_ALIVE_INTERVAL = 30000

// Client timeout (5 minutes)
const CLIENT_TIMEOUT = 300000

interface StreamClient {
  userId: string
  controller: ReadableStreamDefaultController
  encoder: TextEncoder
  lastActivity: number
}

// Store active connections
const activeClients = new Map<string, StreamClient>()

// Cleanup inactive clients periodically
setInterval(() => {
  const now = Date.now()
  for (const [clientId, client] of activeClients) {
    if (now - client.lastActivity > CLIENT_TIMEOUT) {
      console.log(`Removing inactive client: ${clientId}`)
      try {
        client.controller.close()
      } catch (error) {
        // Client already disconnected
      }
      activeClients.delete(clientId)
    }
  }
}, 60000) // Check every minute

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const clientId = `${userId}-${Date.now()}`
  console.log(`New SSE connection: ${clientId}`)

  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      // Store client info
      const client: StreamClient = {
        userId,
        controller,
        encoder,
        lastActivity: Date.now()
      }
      activeClients.set(clientId, client)

      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({ 
        clientId,
        timestamp: new Date().toISOString() 
      })}\n\n`
      controller.enqueue(encoder.encode(connectEvent))

      // Send keep-alive ping
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
          client.lastActivity = Date.now()
        } catch (error) {
          // Client disconnected
          clearInterval(keepAliveInterval)
          activeClients.delete(clientId)
        }
      }, KEEP_ALIVE_INTERVAL)

      // Check for notifications from Redis pub/sub
      const checkNotifications = async () => {
        try {
          // Check for queued notifications for this user
          const notifications = await kv.lrange(`notifications:${userId}`, 0, 10)
          
          if (notifications && notifications.length > 0) {
            // Send notifications and remove from queue
            for (const notification of notifications) {
              const event = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`
              controller.enqueue(encoder.encode(event))
            }
            
            // Clear sent notifications
            await kv.ltrim(`notifications:${userId}`, notifications.length, -1)
          }
        } catch (error) {
          console.error('Error checking notifications:', error)
        }
      }

      // Check for notifications periodically
      const notificationInterval = setInterval(checkNotifications, 5000)

      // Subscribe to Redis pub/sub for real-time updates
      subscribeToUpdates(userId, (event: any) => {
        try {
          let eventString = ''
          
          switch (event.type) {
            case 'policy-change':
              eventString = `event: policy-change\ndata: ${JSON.stringify(event.data)}\n\n`
              break
            case 'risk-alert':
              eventString = `event: risk-alert\ndata: ${JSON.stringify(event.data)}\n\n`
              break
            case 'analysis-complete':
              eventString = `event: analysis-complete\ndata: ${JSON.stringify(event.data)}\n\n`
              break
            default:
              eventString = `event: message\ndata: ${JSON.stringify(event)}\n\n`
          }
          
          controller.enqueue(encoder.encode(eventString))
          client.lastActivity = Date.now()
        } catch (error) {
          console.error('Error sending event:', error)
        }
      })

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        console.log(`Client disconnected: ${clientId}`)
        clearInterval(keepAliveInterval)
        clearInterval(notificationInterval)
        activeClients.delete(clientId)
        unsubscribeFromUpdates(userId)
        controller.close()
      })
    }
  })

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
    }
  })
}

// Redis pub/sub subscription management
const subscriptions = new Map<string, any>()

async function subscribeToUpdates(userId: string, callback: (event: any) => void) {
  try {
    // In production, this would use Redis pub/sub
    // For now, we'll simulate with polling
    const checkForUpdates = async () => {
      try {
        // Check for policy changes affecting user's watchlist
        const watchlist = await kv.smembers(`watchlist:${userId}`)
        
        for (const companySlug of watchlist) {
          const latestChange = await kv.get(`changes:${companySlug}:latest`)
          if (latestChange) {
            callback({
              type: 'policy-change',
              data: latestChange
            })
            // Mark as sent
            await kv.del(`changes:${companySlug}:latest`)
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
      }
    }
    
    const interval = setInterval(checkForUpdates, 10000) // Check every 10 seconds
    subscriptions.set(userId, interval)
  } catch (error) {
    console.error('Error subscribing to updates:', error)
  }
}

function unsubscribeFromUpdates(userId: string) {
  const interval = subscriptions.get(userId)
  if (interval) {
    clearInterval(interval)
    subscriptions.delete(userId)
  }
}

// Utility function to broadcast to all connected clients
// Note: This function is internal to this module and not exported
// In a production system, you would use a proper pub/sub system
// or a separate notification service
function broadcastToUser(userId: string, event: any) {
  for (const [clientId, client] of activeClients) {
    if (client.userId === userId) {
      try {
        const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        client.controller.enqueue(client.encoder.encode(eventString))
      } catch (error) {
        // Client disconnected
        activeClients.delete(clientId)
      }
    }
  }
}