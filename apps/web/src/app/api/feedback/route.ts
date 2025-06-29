import { NextRequest, NextResponse } from 'next/server';
import { FeedbackService, FeedbackSubmissionSchema } from '@/lib/feedback';
import { z } from 'zod';
import { headers } from 'next/headers';
import { currentUser } from '@clerk/nextjs/server';

// GET /api/feedback - List feedback with filters
export async function GET(req: NextRequest) {
  try {
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.role === 'admin';
    
    const searchParams = req.nextUrl.searchParams;
    const options = {
      type: searchParams.get('type') as any,
      status: searchParams.get('status') as any,
      priority: searchParams.get('priority') as any,
      sentiment: searchParams.get('sentiment') as any,
      userId: isAdmin ? searchParams.get('userId') || undefined : user?.id,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Non-admin users can only see their own feedback
    if (!isAdmin && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await FeedbackService.listFeedback(options);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to list feedback' },
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit new feedback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await currentUser();
    
    // Get context information
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || 'Unknown';
    const referer = headersList.get('referer') || req.nextUrl.origin;
    
    // Add context to submission
    const submission = {
      ...body,
      context: {
        url: body.context?.url || referer,
        userAgent,
        viewport: body.context?.viewport || { width: 0, height: 0 }
      }
    };
    
    // Validate submission
    const validatedData = FeedbackSubmissionSchema.parse(submission);
    
    // Submit feedback
    const feedback = await FeedbackService.submitFeedback(validatedData, user?.id);
    
    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      );
    }
    
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}