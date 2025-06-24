import { NextRequest, NextResponse } from 'next/server';
import { getClerkAuth, getClerkUser } from '@/lib/auth-clerk';
import { ExportService, ExportOptions } from '@/lib/export';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getClerkAuth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const user = await getClerkUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    const body = await request.json();
    const options: ExportOptions = {
      format: body.format || 'json',
      includeAnalysis: body.includeAnalysis,
      includeHistory: body.includeHistory,
      includeAlerts: body.includeAlerts,
      dateRange: body.dateRange ? {
        start: new Date(body.dateRange.start),
        end: new Date(body.dateRange.end)
      } : undefined,
      companies: body.companies
    };

    // Validate format
    if (!['json', 'csv', 'pdf', 'zip'].includes(options.format)) {
      return NextResponse.json(
        { error: 'Invalid export format' },
        { status: 400 }
      );
    }

    // Check if user has access to advanced export formats
    // TODO: Implement tier check with Clerk metadata
    const userTier = 'free'; // Default for now
    if (userTier === 'free' && ['pdf', 'zip'].includes(options.format)) {
      return NextResponse.json(
        { error: 'PDF and ZIP exports are only available for premium users' },
        { status: 403 }
      );
    }

    const exportService = new ExportService();
    const exportData = await exportService.exportUserData(userId, options);

    // Set appropriate headers based on format
    const headers: Record<string, string> = {
      'Content-Disposition': `attachment; filename="policydiff-export-${Date.now()}.${options.format}"`,
    };

    switch (options.format) {
      case 'json':
        headers['Content-Type'] = 'application/json';
        break;
      case 'csv':
        headers['Content-Type'] = 'text/csv';
        break;
      case 'pdf':
        headers['Content-Type'] = 'application/pdf';
        break;
      case 'zip':
        headers['Content-Type'] = 'application/zip';
        break;
    }

    return new NextResponse(exportData, { headers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Export limit reached')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}