'use client';

import { useState, useEffect } from 'react';
import { AuthService } from '@/lib/auth';

export interface Session {
  id: string;
  email: string;
  tier: 'free' | 'premium' | 'enterprise';
  sessionId: string;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/session', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSession({
          ...data.user,
          sessionId: token
        });
      } else {
        localStorage.removeItem('session_token');
      }
    } catch (error) {
      console.error('Session check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    localStorage.setItem('session_token', data.sessionId);
    setSession({
      ...data.user,
      sessionId: data.sessionId
    });
    
    return data;
  };

  const logout = async () => {
    const token = localStorage.getItem('session_token');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
    
    localStorage.removeItem('session_token');
    setSession(null);
  };

  return {
    session,
    loading,
    login,
    logout,
    refetch: checkSession
  };
}