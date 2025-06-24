import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getClerkUser } from '@/lib/auth-clerk';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const user = await getClerkUser();
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Premium feature check
      const tier = (user.publicMetadata as any)?.tier || 'free';
      if (tier === 'free') {
        return NextResponse.json(
          { error: 'API access is only available for premium users' },
          { status: 403 }
        );
      }
      
      // Generate API key
      const apiKey = `pk_${crypto.randomBytes(32).toString('hex')}`;
      
      // Store API key in Clerk user's private metadata
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...(user.privateMetadata as any || {}),
          apiKey: apiKey
        }
      });
      
      return NextResponse.json({
        apiKey,
        message: 'API key generated successfully. Store it securely - you won\'t be able to see it again.'
      });
    } catch (error) {
      console.error('Generate API key error:', error);
      return NextResponse.json(
        { error: 'Failed to generate API key' },
        { status: 500 }
      );
    }
  });
}