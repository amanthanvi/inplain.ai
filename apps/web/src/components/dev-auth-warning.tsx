'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DEV_AUTH_WARNING } from '@/lib/dev-auth';

export function DevAuthWarning() {
  const [isDevAuth, setIsDevAuth] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Check if dev auth is enabled
    const checkDevAuth = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const headers = response.headers;
        
        if (headers.get('X-Dev-Auth-Active') === 'true') {
          setIsDevAuth(true);
          
          // Log warning to console
          console.warn('🔓 DEV AUTH BYPASS ACTIVE 🔓');
          console.warn(DEV_AUTH_WARNING.message);
          console.warn('Details:', DEV_AUTH_WARNING.details);
        }
      } catch (error) {
        console.error('Failed to check dev auth status:', error);
      }
    };

    checkDevAuth();
  }, []);

  if (!isDevAuth || isDismissed) {
    return null;
  }

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="bg-yellow-500 text-black p-2 rounded-full shadow-lg animate-pulse">
          <AlertTriangle className="h-6 w-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg">{DEV_AUTH_WARNING.title}</h3>
              <p className="text-sm mt-1">{DEV_AUTH_WARNING.message}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium hover:underline">
                  View Details
                </summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {DEV_AUTH_WARNING.details.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-yellow-600 rounded transition-colors"
              title="Minimize"
            >
              <span className="text-sm">_</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-yellow-600 rounded transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}