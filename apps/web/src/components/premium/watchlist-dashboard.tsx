'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Plus,
  Trash2,
  Download,
  Webhook,
  Mail,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useThemeStore } from '@/lib/theme-system';
import { AnimatedCard, AnimatedButton, AnimatedList, AnimatedListItem } from '@/components/ui/animated-components';

interface Watchlist {
  id: string;
  name: string;
  description?: string;
  sites: WatchlistSite[];
  emailAlerts: boolean;
  webhookEnabled: boolean;
  alertThreshold: 'any' | 'significant' | 'critical';
  createdAt: string;
  updatedAt: string;
}

interface WatchlistSite {
  companySlug: string;
  companyName: string;
  addedAt: string;
  lastChecked?: string;
  lastChange?: string;
  tags: string[];
}

interface Alert {
  id: string;
  companySlug: string;
  changeType: 'minor' | 'significant' | 'critical';
  summary: string;
  createdAt: string;
  read: boolean;
}

export function WatchlistDashboard() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWatchlist, setSelectedWatchlist] = useState<Watchlist | null>(null);
  
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchWatchlists();
    fetchAlerts();
  }, []);

  const fetchWatchlists = async () => {
    try {
      const res = await fetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data.watchlists);
      }
    } catch (error) {
      console.error('Error fetching watchlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts?limit=10');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true })
      });
      
      if (res.ok) {
        setAlerts(alerts.map(a => 
          a.id === alertId ? { ...a, read: true } : a
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const exportData = async (format: 'json' | 'csv' | 'zip') => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          includeAlerts: true,
          includeHistory: format === 'zip',
          companies: watchlists.flatMap(w => w.sites.map(s => s.companySlug))
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `policydiff-export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const changeTypeColors = {
    minor: 'text-blue-500',
    significant: 'text-amber-500',
    critical: 'text-red-500'
  };

  const changeTypeIcons = {
    minor: <AlertCircle className="w-4 h-4" />,
    significant: <XCircle className="w-4 h-4" />,
    critical: <AlertCircle className="w-4 h-4 animate-pulse" />
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Watchlists & Alerts</h2>
          <p className="text-muted-foreground mt-1">
            Monitor privacy policy changes for companies you care about
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <AnimatedButton
            variant="secondary"
            size="small"
            onClick={() => exportData('json')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </AnimatedButton>
          
          <AnimatedButton
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Watchlist</span>
          </AnimatedButton>
        </div>
      </div>

      {/* Alerts Section */}
      <AnimatedCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Recent Alerts
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </h3>
        </div>

        <AnimatedList>
          {alerts.length === 0 ? (
            <AnimatedListItem>
              <div className="text-center py-8 text-muted-foreground">
                No alerts yet
              </div>
            </AnimatedListItem>
          ) : (
            alerts.map((alert) => (
              <AnimatedListItem key={alert.id}>
            <motion.div
              className={`p-4 rounded-lg border ${
                alert.read 
                  ? 'border-border bg-muted/30' 
                  : 'border-primary/20 bg-primary/5'
              } hover:shadow-md transition-all cursor-pointer`}
              onClick={() => !alert.read && markAlertAsRead(alert.id)}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${changeTypeColors[alert.changeType]}`}>
                    {changeTypeIcons[alert.changeType]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alert.companySlug}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        alert.changeType === 'critical' 
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : alert.changeType === 'significant'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {alert.changeType}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {alert.summary}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <button className="text-muted-foreground hover:text-foreground">
                  {alert.read ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
              </AnimatedListItem>
            ))
          )}
        </AnimatedList>
      </AnimatedCard>

      {/* Watchlists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {watchlists.map((watchlist) => (
          <div
            key={watchlist.id}
            onClick={() => setSelectedWatchlist(watchlist)}
            className="cursor-pointer"
          >
            <AnimatedCard className="p-6 hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <h4 className="font-semibold text-lg">{watchlist.name}</h4>
              <div className="flex items-center gap-2">
                {watchlist.emailAlerts && (
                  <Mail className="w-4 h-4 text-muted-foreground" />
                )}
                {watchlist.webhookEnabled && (
                  <Webhook className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
            
            {watchlist.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {watchlist.description}
              </p>
            )}
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sites monitored</span>
                <span className="font-medium">{watchlist.sites.length}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Alert threshold</span>
                <span className="font-medium capitalize">{watchlist.alertThreshold}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last updated</span>
                <span className="font-medium">
                  {new Date(watchlist.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex -space-x-2">
                {watchlist.sites.slice(0, 5).map((site, index) => (
                  <div
                    key={site.companySlug}
                    className="w-8 h-8 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-xs font-medium"
                    title={site.companyName}
                  >
                    {site.companyName.charAt(0).toUpperCase()}
                  </div>
                ))}
                {watchlist.sites.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                    +{watchlist.sites.length - 5}
                  </div>
                )}
              </div>
            </div>
          </AnimatedCard>
          </div>
        ))}
        
        {/* Add New Watchlist Card */}
        <div
          onClick={() => setShowCreateModal(true)}
          className="cursor-pointer"
        >
          <AnimatedCard
            className="p-6 border-dashed hover:shadow-lg flex items-center justify-center min-h-[200px]"
          >
            <div className="text-center">
              <Plus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Create New Watchlist</p>
            </div>
          </AnimatedCard>
        </div>
      </div>

      {/* Create Modal - Would be implemented separately */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          {/* Modal content */}
        </div>
      )}
    </div>
  );
}