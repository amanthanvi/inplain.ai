import { NextRequest, NextResponse } from 'next/server';
import { FeedbackService, FeedbackStatusSchema } from '@/lib/feedback';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';

// GET /api/feedback/[id] - Get specific feedback
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.role === 'admin';
    
    const feedback = await FeedbackService.getFeedback(params.id);
    
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    
    // Check permissions
    if (!isAdmin && feedback.context.userId !== user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error getting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to get feedback' },
      { status: 500 }
    );
  }
}

// PATCH /api/feedback/[id] - Update feedback (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    const isAdmin = user?.publicMetadata?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const body = await req.json();
    
    // Validate status if provided
    if (body.status) {
      FeedbackStatusSchema.parse(body.status);
    }
    
    const feedback = await FeedbackService.updateFeedbackStatus(
      params.id,
      body.status,
      body.notes,
      body.assignedTo || user.id
    );
    
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    
    return NextResponse.json(feedback);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }
    
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    );
  }
}