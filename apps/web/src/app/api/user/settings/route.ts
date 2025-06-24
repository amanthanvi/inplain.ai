import { NextRequest, NextResponse } from 'next/server';
import { getClerkAuth, getClerkUser, withAuth } from '@/lib/auth-clerk';
import { clerkClient } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const user = await getClerkUser();
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Get metadata from Clerk user
      const metadata = user.publicMetadata as any || {};
      const privateMetadata = user.privateMetadata as any || {};
      
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '',
          tier: metadata.tier || 'free',
          emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
          emailAlerts: metadata.emailAlerts ?? true,
          alertFrequency: metadata.alertFrequency || 'daily',
          webhookUrl: metadata.webhookUrl || null,
          apiKey: privateMetadata.apiKey ? 'pk_' + '•'.repeat(32) : null,
          usage: metadata.usage || { analysisCalls: 0, lastReset: new Date().toISOString() }
        }
      });
    } catch (error) {
      console.error('Get settings error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const body = await request.json();
      const clerk = await clerkClient();
      
      // Get current user to preserve existing metadata
      const user = await clerk.users.getUser(userId);
      const currentMetadata = user.publicMetadata as any || {};
      
      // Only allow updating certain fields
      const allowedFields = [
        'name',
        'emailAlerts',
        'alertFrequency',
        'webhookUrl'
      ];
      
      const updates: any = { ...currentMetadata };
      for (const field of allowedFields) {
        if (field in body) {
          if (field === 'name') {
            // Update name in Clerk user profile
            const [firstName, ...lastNameParts] = body.name.split(' ');
            await clerk.users.updateUser(userId, {
              firstName,
              lastName: lastNameParts.join(' ')
            });
          } else {
            updates[field] = body[field];
          }
        }
      }
      
      // Update metadata in Clerk
      const updatedUser = await clerk.users.updateUserMetadata(userId, {
        publicMetadata: updates
      });
      
      const metadata = updatedUser.publicMetadata as any || {};
      const privateMetadata = updatedUser.privateMetadata as any || {};
      
      return NextResponse.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.emailAddresses[0]?.emailAddress || '',
          name: `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.username || '',
          tier: metadata.tier || 'free',
          emailVerified: updatedUser.emailAddresses[0]?.verification?.status === 'verified',
          emailAlerts: metadata.emailAlerts ?? true,
          alertFrequency: metadata.alertFrequency || 'daily',
          webhookUrl: metadata.webhookUrl || null,
          apiKey: privateMetadata.apiKey ? 'pk_' + '•'.repeat(32) : null,
          usage: metadata.usage || { analysisCalls: 0, lastReset: new Date().toISOString() }
        }
      });
    } catch (error) {
      console.error('Update settings error:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }
  });
}