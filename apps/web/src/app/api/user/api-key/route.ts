import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Premium feature check
    if (user.tier === 'free') {
      return NextResponse.json(
        { error: 'API access is only available for premium users' },
        { status: 403 }
      );
    }
    
    const apiKey = await AuthService.generateApiKey(user.id);
    
    return NextResponse.json({
      apiKey,
      message: 'API key generated successfully. Store it securely - you won\'t be able to see it again.'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Generate API key error:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}