import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        emailVerified: user.emailVerified,
        emailAlerts: user.emailAlerts,
        alertFrequency: user.alertFrequency,
        webhookUrl: user.webhookUrl,
        apiKey: user.apiKey ? 'pk_' + '•'.repeat(32) : null,
        usage: user.usage
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    // Only allow updating certain fields
    const allowedFields = [
      'name',
      'emailAlerts',
      'alertFrequency',
      'webhookUrl'
    ];
    
    const updates: any = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }
    
    const updatedUser = await AuthService.updateUser(user.id, updates);
    
    return NextResponse.json({
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        name: updatedUser!.name,
        tier: updatedUser!.tier,
        emailVerified: updatedUser!.emailVerified,
        emailAlerts: updatedUser!.emailAlerts,
        alertFrequency: updatedUser!.alertFrequency,
        webhookUrl: updatedUser!.webhookUrl,
        apiKey: updatedUser!.apiKey ? 'pk_' + '•'.repeat(32) : null,
        usage: updatedUser!.usage
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}