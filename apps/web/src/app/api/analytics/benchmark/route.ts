import { NextRequest, NextResponse } from 'next/server';
import { IndustryBenchmark } from '@/lib/analytics/industry-benchmark';
import { OptimizedStorageClient } from '@/app/api/lib/storage-optimized';

const storageClient = new OptimizedStorageClient();
import { validateAnalyticsAccess } from '../auth-helper';
import { kv } from '@vercel/kv';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const { user, error } = await validateAnalyticsAccess(token || null, ['enterprise']);
    
    if (!user) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }

    // Get company data
    const companyData = await kv.get(`company:${slug}`);
    if (!companyData) {
      // Create basic company data from slug
      const companyInfo = {
        slug,
        name: slug.charAt(0).toUpperCase() + slug.slice(1),
        domain: `${slug}.com`
      };
      
      // Generate benchmark
      const benchmark = await IndustryBenchmark.generateBenchmark(companyInfo as any);
      const report = IndustryBenchmark.generateBenchmarkReport(benchmark);

      return NextResponse.json({
        benchmark,
        report,
        generatedAt: new Date().toISOString()
      });
    }

    // Get latest policy analysis for enhanced metrics
    const latestAnalysis = await kv.get(`analysis-advanced:${slug}:latest:expert:premium`);

    // Generate benchmark
    const benchmark = await IndustryBenchmark.generateBenchmark(
      companyData as any,
      latestAnalysis
    );
    
    const report = IndustryBenchmark.generateBenchmarkReport(benchmark);

    return NextResponse.json({
      benchmark,
      report,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Benchmark generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate benchmark' },
      { status: 500 }
    );
  }
}