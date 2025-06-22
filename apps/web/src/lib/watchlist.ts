import { kv } from '@vercel/kv';
import { AuthService, User } from './auth';

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  sites: WatchlistSite[];
  emailAlerts: boolean;
  webhookEnabled: boolean;
  alertThreshold: 'any' | 'significant' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchlistSite {
  companySlug: string;
  companyName: string;
  addedAt: Date;
  lastChecked?: Date;
  lastChange?: Date;
  customNotes?: string;
  tags: string[];
}

export interface WatchlistAlert {
  id: string;
  watchlistId: string;
  userId: string;
  companySlug: string;
  changeType: 'minor' | 'significant' | 'critical';
  summary: string;
  details: any;
  createdAt: Date;
  read: boolean;
  emailSent: boolean;
  webhookSent: boolean;
}

export class WatchlistService {
  static async createWatchlist(
    userId: string,
    name: string,
    description?: string
  ): Promise<Watchlist> {
    const watchlistId = `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const watchlist: Watchlist = {
      id: watchlistId,
      userId,
      name,
      description,
      sites: [],
      emailAlerts: true,
      webhookEnabled: false,
      alertThreshold: 'significant',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await kv.hset(`watchlist:${watchlistId}`, watchlist as unknown as { [field: string]: unknown });
    await kv.sadd(`user:watchlists:${userId}`, watchlistId);
    
    // Update user's custom watchlists
    const user = await AuthService.getUserById(userId);
    if (user) {
      await AuthService.updateUser(userId, {
        customWatchlists: [...user.customWatchlists, watchlistId]
      });
    }

    return watchlist;
  }

  static async getWatchlist(watchlistId: string): Promise<Watchlist | null> {
    const watchlist = await kv.hgetall(`watchlist:${watchlistId}`) as Watchlist | null;
    return watchlist;
  }

  static async getUserWatchlists(userId: string): Promise<Watchlist[]> {
    const watchlistIds = await kv.smembers(`user:watchlists:${userId}`);
    const watchlists = await Promise.all(
      watchlistIds.map(id => this.getWatchlist(id))
    );
    return watchlists.filter(w => w !== null) as Watchlist[];
  }

  static async updateWatchlist(
    watchlistId: string,
    updates: Partial<Watchlist>
  ): Promise<Watchlist | null> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) return null;

    const updatedWatchlist = {
      ...watchlist,
      ...updates,
      updatedAt: new Date()
    };

    await kv.hset(`watchlist:${watchlistId}`, updatedWatchlist as unknown as { [field: string]: unknown });
    return updatedWatchlist;
  }

  static async deleteWatchlist(watchlistId: string): Promise<boolean> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) return false;

    await kv.del(`watchlist:${watchlistId}`);
    await kv.srem(`user:watchlists:${watchlist.userId}`, watchlistId);
    
    // Update user's custom watchlists
    const user = await AuthService.getUserById(watchlist.userId);
    if (user) {
      await AuthService.updateUser(watchlist.userId, {
        customWatchlists: user.customWatchlists.filter(id => id !== watchlistId)
      });
    }

    return true;
  }

  static async addSiteToWatchlist(
    watchlistId: string,
    companySlug: string,
    companyName: string,
    tags: string[] = []
  ): Promise<boolean> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) return false;

    // Check if site already exists
    const existingSite = watchlist.sites.find(s => s.companySlug === companySlug);
    if (existingSite) return false;

    const site: WatchlistSite = {
      companySlug,
      companyName,
      addedAt: new Date(),
      tags
    };

    watchlist.sites.push(site);
    await this.updateWatchlist(watchlistId, { sites: watchlist.sites });

    // Add to reverse index for efficient lookups
    await kv.sadd(`site:watchlists:${companySlug}`, watchlistId);

    return true;
  }

  static async removeSiteFromWatchlist(
    watchlistId: string,
    companySlug: string
  ): Promise<boolean> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) return false;

    watchlist.sites = watchlist.sites.filter(s => s.companySlug !== companySlug);
    await this.updateWatchlist(watchlistId, { sites: watchlist.sites });

    // Remove from reverse index
    await kv.srem(`site:watchlists:${companySlug}`, watchlistId);

    return true;
  }

  static async updateSiteInWatchlist(
    watchlistId: string,
    companySlug: string,
    updates: Partial<WatchlistSite>
  ): Promise<boolean> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) return false;

    const siteIndex = watchlist.sites.findIndex(s => s.companySlug === companySlug);
    if (siteIndex === -1) return false;

    const existingSite = watchlist.sites[siteIndex];
    if (!existingSite) return false;
    
    watchlist.sites[siteIndex] = {
      ...existingSite,
      ...updates,
      // Ensure required fields are never undefined
      companySlug: updates.companySlug ?? existingSite.companySlug,
      companyName: updates.companyName ?? existingSite.companyName,
      tags: updates.tags ?? existingSite.tags
    };

    await this.updateWatchlist(watchlistId, { sites: watchlist.sites });
    return true;
  }

  static async getWatchlistsForSite(companySlug: string): Promise<Watchlist[]> {
    const watchlistIds = await kv.smembers(`site:watchlists:${companySlug}`);
    const watchlists = await Promise.all(
      watchlistIds.map(id => this.getWatchlist(id))
    );
    return watchlists.filter(w => w !== null) as Watchlist[];
  }

  static async createAlert(
    watchlistId: string,
    companySlug: string,
    changeType: 'minor' | 'significant' | 'critical',
    summary: string,
    details: any
  ): Promise<WatchlistAlert> {
    const watchlist = await this.getWatchlist(watchlistId);
    if (!watchlist) throw new Error('Watchlist not found');

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: WatchlistAlert = {
      id: alertId,
      watchlistId,
      userId: watchlist.userId,
      companySlug,
      changeType,
      summary,
      details,
      createdAt: new Date(),
      read: false,
      emailSent: false,
      webhookSent: false
    };

    await kv.hset(`alert:${alertId}`, alert as unknown as { [field: string]: unknown });
    await kv.lpush(`user:alerts:${watchlist.userId}`, alertId);
    await kv.expire(`user:alerts:${watchlist.userId}`, 30 * 24 * 60 * 60); // 30 days

    // Update site's last change
    await this.updateSiteInWatchlist(watchlistId, companySlug, {
      lastChange: new Date()
    });

    return alert;
  }

  static async getUserAlerts(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WatchlistAlert[]> {
    const alertIds = await kv.lrange(`user:alerts:${userId}`, offset, offset + limit - 1);
    const alerts = await Promise.all(
      alertIds.map(id => kv.hgetall(`alert:${id}`).then(a => a as WatchlistAlert | null))
    );
    return alerts.filter(a => a !== null) as WatchlistAlert[];
  }

  static async markAlertAsRead(alertId: string): Promise<boolean> {
    const alert = await kv.hgetall(`alert:${alertId}`) as WatchlistAlert | null;
    if (!alert) return false;

    alert.read = true;
    await kv.hset(`alert:${alertId}`, alert as unknown as { [field: string]: unknown });
    return true;
  }

  static async getUnreadAlertCount(userId: string): Promise<number> {
    const alerts = await this.getUserAlerts(userId, 100);
    return alerts.filter(a => !a.read).length;
  }

  static async shouldSendAlert(
    watchlist: Watchlist,
    changeType: 'minor' | 'significant' | 'critical'
  ): Promise<boolean> {
    const thresholdMap = {
      'any': ['minor', 'significant', 'critical'],
      'significant': ['significant', 'critical'],
      'critical': ['critical']
    };

    return thresholdMap[watchlist.alertThreshold].includes(changeType);
  }

  static async processChangeForWatchlists(
    companySlug: string,
    changeType: 'minor' | 'significant' | 'critical',
    summary: string,
    details: any
  ): Promise<void> {
    const watchlists = await this.getWatchlistsForSite(companySlug);
    
    for (const watchlist of watchlists) {
      if (await this.shouldSendAlert(watchlist, changeType)) {
        const alert = await this.createAlert(
          watchlist.id,
          companySlug,
          changeType,
          summary,
          details
        );

        // Queue email and webhook notifications
        if (watchlist.emailAlerts) {
          await kv.lpush('email:queue', {
            alertId: alert.id,
            userId: watchlist.userId,
            type: 'watchlist_alert'
          });
        }

        if (watchlist.webhookEnabled) {
          await kv.lpush('webhook:queue', {
            alertId: alert.id,
            watchlistId: watchlist.id,
            userId: watchlist.userId
          });
        }
      }
    }
  }
}