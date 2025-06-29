import { NextRequest, NextResponse } from 'next/server';
import { FeedbackService } from '@/lib/feedback';
import { currentUser } from '@clerk/nextjs/server';

// GET /api/feedback/analytics - Get feedback analytics (admin only)
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const analytics = await FeedbackService.getAnalytics();
    
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error getting feedback analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}