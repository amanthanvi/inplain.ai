import { kv } from '@vercel/kv';
import { AuthService, User } from './auth';
import { WatchlistService } from './watchlist';
import { StorageClient } from '@/app/api/lib/storage';
import { Parser } from '@json2csv/plainjs';
import JSZip from 'jszip';

export type ExportFormat = 'json' | 'csv' | 'pdf' | 'zip';

export interface ExportOptions {
  format: ExportFormat;
  includeAnalysis?: boolean;
  includeHistory?: boolean;
  includeAlerts?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  companies?: string[];
}

export class ExportService {
  private storage: StorageClient;

  constructor() {
    this.storage = new StorageClient();
  }

  async exportUserData(userId: string, options: ExportOptions): Promise<Buffer> {
    const user = await AuthService.getUserById(userId);
    if (!user) throw new Error('User not found');

    // Check usage limits
    const limits = await AuthService.checkUsageLimits(userId);
    if (!limits.allowed && user.tier === 'free') {
      throw new Error('Export limit reached. Upgrade to premium for unlimited exports.');
    }

    // Track usage
    await AuthService.trackUsage(userId, 'api');

    const exportData: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        userId: user.id,
        format: options.format,
        options
      },
      data: {}
    };

    // Export watchlists
    const watchlists = await WatchlistService.getUserWatchlists(userId);
    exportData.data.watchlists = watchlists;

    // Export alerts if requested
    if (options.includeAlerts) {
      const alerts = await WatchlistService.getUserAlerts(userId, 1000);
      exportData.data.alerts = alerts.filter(alert => {
        if (!options.dateRange) return true;
        const alertDate = new Date(alert.createdAt);
        return alertDate >= options.dateRange.start && alertDate <= options.dateRange.end;
      });
    }

    // Export company data if specified
    if (options.companies && options.companies.length > 0) {
      exportData.data.companies = {};
      
      for (const companySlug of options.companies) {
        const companyData: any = {
          slug: companySlug,
          snapshots: [],
          analysis: null
        };

        // Get snapshots
        const snapshotMetas = await this.storage.getLatestSnapshots(companySlug, 100);
        const snapshots = snapshotMetas.map(s => s.id);
        
        if (options.includeHistory) {
          // Include full history
          companyData.snapshots = await Promise.all(
            snapshotMetas.map(async (metadata) => {
              const content = await this.storage.getSnapshotContent(metadata.blobKey);
              return { id: metadata.id, metadata, content };
            })
          );
        } else {
          // Just include latest snapshot
          if (snapshotMetas.length > 0) {
            const latestMeta = snapshotMetas[0];
            if (latestMeta) {
              const content = await this.storage.getSnapshotContent(latestMeta.blobKey);
              companyData.snapshots = [{ id: latestMeta.id, metadata: latestMeta, content }];
            }
          }
        }

        // Include analysis if requested
        if (options.includeAnalysis && snapshots.length > 0) {
          const analysisKey = `analysis-advanced:${companySlug}:${snapshots[0]}:expert:${user.tier}`;
          companyData.analysis = await kv.get(analysisKey);
        }

        exportData.data.companies[companySlug] = companyData;
      }
    }

    // Format based on requested type
    switch (options.format) {
      case 'json':
        return Buffer.from(JSON.stringify(exportData, null, 2));
      
      case 'csv':
        return this.exportAsCSV(exportData);
      
      case 'pdf':
        return this.exportAsPDF(exportData);
      
      case 'zip':
        return this.exportAsZip(exportData);
      
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private async exportAsCSV(data: any): Promise<Buffer> {
    const csvData: any[] = [];

    // Flatten watchlist data
    if (data.data.watchlists) {
      for (const watchlist of data.data.watchlists) {
        for (const site of watchlist.sites) {
          csvData.push({
            type: 'watchlist',
            watchlistName: watchlist.name,
            companySlug: site.companySlug,
            companyName: site.companyName,
            addedAt: site.addedAt,
            tags: site.tags.join(', '),
            emailAlerts: watchlist.emailAlerts,
            webhookEnabled: watchlist.webhookEnabled,
            alertThreshold: watchlist.alertThreshold
          });
        }
      }
    }

    // Flatten alerts data
    if (data.data.alerts) {
      for (const alert of data.data.alerts) {
        csvData.push({
          type: 'alert',
          alertId: alert.id,
          companySlug: alert.companySlug,
          changeType: alert.changeType,
          summary: alert.summary,
          createdAt: alert.createdAt,
          read: alert.read,
          emailSent: alert.emailSent,
          webhookSent: alert.webhookSent
        });
      }
    }

    const parser = new Parser({});
    const csv = parser.parse(csvData);
    return Buffer.from(csv);
  }

  private async exportAsPDF(data: any): Promise<Buffer> {
    // This would use a PDF generation library like puppeteer or pdfkit
    // For now, we'll create a simple text representation
    let pdfContent = `Inplain.AI Data Export\n`;
    pdfContent += `Generated: ${data.metadata.exportDate}\n\n`;

    if (data.data.watchlists) {
      pdfContent += `WATCHLISTS (${data.data.watchlists.length})\n`;
      pdfContent += '='.repeat(50) + '\n';
      
      for (const watchlist of data.data.watchlists) {
        pdfContent += `\n${watchlist.name}\n`;
        pdfContent += '-'.repeat(watchlist.name.length) + '\n';
        pdfContent += `Sites monitored: ${watchlist.sites.length}\n`;
        pdfContent += `Email alerts: ${watchlist.emailAlerts ? 'Yes' : 'No'}\n`;
        pdfContent += `Alert threshold: ${watchlist.alertThreshold}\n`;
        
        if (watchlist.sites.length > 0) {
          pdfContent += '\nMonitored sites:\n';
          for (const site of watchlist.sites) {
            pdfContent += `  - ${site.companyName} (${site.companySlug})\n`;
          }
        }
      }
    }

    if (data.data.alerts) {
      pdfContent += `\n\nALERTS (${data.data.alerts.length})\n`;
      pdfContent += '='.repeat(50) + '\n';
      
      for (const alert of data.data.alerts.slice(0, 50)) { // Limit to 50 alerts
        pdfContent += `\n${alert.companySlug} - ${alert.changeType.toUpperCase()}\n`;
        pdfContent += `Date: ${new Date(alert.createdAt).toLocaleDateString()}\n`;
        pdfContent += `Summary: ${alert.summary}\n`;
      }
    }

    // In production, this would generate a proper PDF
    return Buffer.from(pdfContent);
  }

  private async exportAsZip(data: any): Promise<Buffer> {
    const zip = new JSZip();

    // Add metadata
    zip.file('metadata.json', JSON.stringify(data.metadata, null, 2));

    // Add watchlists
    if (data.data.watchlists) {
      const watchlistsFolder = zip.folder('watchlists');
      if (watchlistsFolder) {
        watchlistsFolder.file(
          'all_watchlists.json',
          JSON.stringify(data.data.watchlists, null, 2)
        );

        // Add individual watchlist files
        for (const watchlist of data.data.watchlists) {
          watchlistsFolder.file(
            `${watchlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`,
            JSON.stringify(watchlist, null, 2)
          );
        }
      }
    }

    // Add alerts
    if (data.data.alerts) {
      const alertsFolder = zip.folder('alerts');
      if (alertsFolder) {
        alertsFolder.file(
          'all_alerts.json',
          JSON.stringify(data.data.alerts, null, 2)
        );

        // Group alerts by company
        const alertsByCompany: Record<string, any[]> = {};
        for (const alert of data.data.alerts) {
          const slug = alert.companySlug;
          if (!alertsByCompany[slug]) {
            alertsByCompany[slug] = [];
          }
          alertsByCompany[slug]!.push(alert);
        }

        for (const [company, companyAlerts] of Object.entries(alertsByCompany)) {
          alertsFolder.file(
            `${company}_alerts.json`,
            JSON.stringify(companyAlerts, null, 2)
          );
        }
      }
    }

    // Add company data
    if (data.data.companies) {
      const companiesFolder = zip.folder('companies');
      if (companiesFolder) {
        for (const [slug, companyData] of Object.entries(data.data.companies) as [string, any][]) {
          const companyFolder = companiesFolder.folder(slug);
          if (companyFolder) {
            // Add snapshots
            if (companyData.snapshots) {
              const snapshotsFolder = companyFolder.folder('snapshots');
              if (snapshotsFolder) {
                for (const snapshot of companyData.snapshots) {
                  snapshotsFolder.file(
                    `${snapshot.id}.json`,
                    JSON.stringify(snapshot, null, 2)
                  );
                }
              }
            }

            // Add analysis
            if (companyData.analysis) {
              companyFolder.file(
                'analysis.json',
                JSON.stringify(companyData.analysis, null, 2)
              );
            }
          }
        }
      }
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return zipBuffer;
  }

  async exportCompanyHistory(
    companySlug: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<Buffer> {
    const snapshotMetas = await this.storage.getLatestSnapshots(companySlug, 100);
    const history: any[] = [];

    for (const metadata of snapshotMetas) {
      const content = await this.storage.getSnapshotContent(metadata.blobKey);
      
      history.push({
        snapshotId: metadata.id,
        timestamp: metadata.capturedAt,
        contentLength: content?.length || 0,
        url: metadata.url
      });
    }

    if (format === 'csv') {
      const parser = new Parser({});
      const csv = parser.parse(history);
      return Buffer.from(csv);
    }

    return Buffer.from(JSON.stringify(history, null, 2));
  }

  async exportAnalysisReport(
    companySlug: string,
    snapshotId: string,
    analysis: any
  ): Promise<Buffer> {
    const report = {
      company: companySlug,
      snapshotId,
      generatedAt: new Date().toISOString(),
      analysis: {
        executiveSummary: analysis.executiveSummary,
        scores: analysis.comprehensiveScores,
        synthesis: analysis.synthesis,
        expertAnalyses: analysis.expertAnalyses
      }
    };

    // In production, this could generate a formatted PDF report
    return Buffer.from(JSON.stringify(report, null, 2));
  }
}