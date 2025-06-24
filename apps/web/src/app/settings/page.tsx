'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Bell,
  Webhook,
  Key,
  Shield,
  CreditCard,
  AlertCircle,
  Check,
  Copy,
  RefreshCw,
  Activity
} from 'lucide-react';
import { AnimatedCard, AnimatedButton } from '@/components/ui/animated-components';
import { useThemeStore } from '@/lib/theme-system';
import dynamic from 'next/dynamic';

const PerformanceDashboard = dynamic(() => import('@/components/performance-dashboard').then(mod => mod.PerformanceDashboard), {
  ssr: false
});

interface UserSettings {
  email: string;
  name: string;
  tier: 'free' | 'premium' | 'enterprise';
  emailAlerts: boolean;
  alertFrequency: 'instant' | 'daily' | 'weekly';
  webhookUrl?: string;
  apiKey?: string;
  usage: {
    apiCalls: number;
    analysisCount: number;
    lastReset: string;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.user);
      }
      
      // Fetch webhook config
      const webhookRes = await fetch('/api/webhooks');
      if (webhookRes.ok) {
        const webhookData = await webhookRes.json();
        setWebhookSecret(webhookData.webhookSecret);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (res.ok) {
        const data = await res.json();
        setSettings(data.user);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const generateApiKey = async () => {
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'POST'
      });
      
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => prev ? { ...prev, apiKey: data.apiKey } : null);
      }
    } catch (error) {
      console.error('Error generating API key:', error);
    }
  };

  const testWebhook = async () => {
    setTestingWebhook(true);
    try {
      const res = await fetch('/api/webhooks?action=test', {
        method: 'POST'
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
    } finally {
      setTestingWebhook(false);
    }
  };

  const copyApiKey = () => {
    if (settings?.apiKey) {
      navigator.clipboard.writeText(settings.apiKey);
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    }
  };

  if (loading || !settings) {
    return <div>Loading...</div>;
  }

  const usageLimits = {
    free: { api: 100, analysis: 20 },
    premium: { api: 5000, analysis: 1000 },
    enterprise: { api: -1, analysis: -1 }
  };

  const userLimits = usageLimits[settings.tier];
  const usagePercent = userLimits.api === -1 
    ? 0 
    : ((settings.usage.apiCalls + settings.usage.analysisCount) / (userLimits.api + userLimits.analysis)) * 100;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <div className="space-y-6">
        {/* Profile Section */}
        <AnimatedCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Profile</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="mt-1 w-full px-3 py-2 border rounded-lg bg-background"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={settings.email}
                disabled
                className="mt-1 w-full px-3 py-2 border rounded-lg bg-muted"
              />
            </div>
            
            <AnimatedButton
              onClick={() => updateSettings({ name: settings.name })}
              disabled={saving}
              size="small"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </AnimatedButton>
          </div>
        </AnimatedCard>

        {/* Subscription Section */}
        <AnimatedCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Subscription</h2>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-2xl font-bold capitalize">{settings.tier}</p>
              <p className="text-sm text-muted-foreground">Current plan</p>
            </div>
            
            {settings.tier !== 'enterprise' && (
              <AnimatedButton variant="primary">
                Upgrade {settings.tier === 'free' ? 'to Premium' : 'to Enterprise'}
              </AnimatedButton>
            )}
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span>API & Analysis Usage</span>
                <span>
                  {settings.usage.apiCalls + settings.usage.analysisCount}
                  {userLimits.api !== -1 && ` / ${userLimits.api + userLimits.analysis}`}
                </span>
              </div>
              <div className="mt-1 w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Resets on {new Date(settings.usage.lastReset).toLocaleDateString()}
            </p>
          </div>
        </AnimatedCard>

        {/* Notifications Section */}
        <AnimatedCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Receive email notifications for watchlist changes
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) => updateSettings({ emailAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {settings.emailAlerts && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Alert Frequency
                </label>
                <select
                  value={settings.alertFrequency}
                  onChange={(e) => updateSettings({ 
                    alertFrequency: e.target.value as 'instant' | 'daily' | 'weekly' 
                  })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
              </div>
            )}
          </div>
        </AnimatedCard>

        {/* Webhook Section (Premium only) */}
        {settings.tier !== 'free' && (
          <AnimatedCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Webhook className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Webhook Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={settings.webhookUrl || ''}
                  onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                  placeholder="https://your-server.com/webhook"
                  className="mt-1 w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Webhook Secret
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={webhookSecret}
                    disabled
                    className="flex-1 px-3 py-2 border rounded-lg bg-muted font-mono text-sm"
                  />
                  <AnimatedButton
                    variant="secondary"
                    size="small"
                    onClick={() => {/* Regenerate secret */}}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Regenerate</span>
                  </AnimatedButton>
                </div>
              </div>
              
              <div className="flex gap-2">
                <AnimatedButton
                  onClick={() => updateSettings({ webhookUrl: settings.webhookUrl })}
                  disabled={saving}
                  size="small"
                >
                  Save Webhook
                </AnimatedButton>
                
                <AnimatedButton
                  variant="secondary"
                  onClick={testWebhook}
                  disabled={!settings.webhookUrl || testingWebhook}
                  size="small"
                >
                  {testingWebhook ? 'Testing...' : 'Test Webhook'}
                </AnimatedButton>
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* API Access (Premium only) */}
        {settings.tier !== 'free' && (
          <AnimatedCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5" />
              <h2 className="text-xl font-semibold">API Access</h2>
            </div>
            
            <div className="space-y-4">
              {settings.apiKey ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    API Key
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={`pk_${'•'.repeat(32)}`}
                      disabled
                      className="flex-1 px-3 py-2 border rounded-lg bg-muted font-mono text-sm"
                    />
                    <AnimatedButton
                      variant="secondary"
                      size="small"
                      onClick={copyApiKey}
                      className="flex items-center gap-2"
                    >
                      {copiedApiKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedApiKey ? 'Copied!' : 'Copy'}</span>
                    </AnimatedButton>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Keep your API key secure. You can regenerate it at any time.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Key className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate an API key to access Inplain.AI programmatically
                  </p>
                  <AnimatedButton onClick={generateApiKey}>
                    Generate API Key
                  </AnimatedButton>
                </div>
              )}
            </div>
          </AnimatedCard>
        )}

        {/* Security Section */}
        <AnimatedCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Security</h2>
          </div>
          
          <div className="space-y-4">
            <AnimatedButton variant="secondary" className="w-full justify-start">
              Change Password
            </AnimatedButton>
            
            <AnimatedButton variant="secondary" className="w-full justify-start">
              Enable Two-Factor Authentication
            </AnimatedButton>
            
            <AnimatedButton variant="danger" className="w-full justify-start">
              Delete Account
            </AnimatedButton>
          </div>
        </AnimatedCard>

        {/* Performance Dashboard (Enterprise only) */}
        {settings.tier === 'enterprise' && (
          <AnimatedCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Performance Metrics</h2>
            </div>
            
            <PerformanceDashboard />
          </AnimatedCard>
        )}
      </div>
    </div>
  );
}