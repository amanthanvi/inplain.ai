'use client'

import { useEffect } from 'react'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration)
          
          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  if (confirm('A new version is available! Would you like to update?')) {
                    window.location.reload()
                  }
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        // Don't request immediately, wait for user interaction
      }
      
      // Handle app installed event
      window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully')
        // Track installation
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'pwa_installed' })
        })
      })
      
      // Update last online time
      const updateOnlineStatus = () => {
        localStorage.setItem('lastOnline', Date.now().toString())
      }
      
      window.addEventListener('online', updateOnlineStatus)
      window.addEventListener('focus', updateOnlineStatus)
      updateOnlineStatus()
      
      return () => {
        window.removeEventListener('online', updateOnlineStatus)
        window.removeEventListener('focus', updateOnlineStatus)
      }
    }
  }, [])
  
  return (
    <>
      {children}
      <InstallPrompt />
    </>
  )
}