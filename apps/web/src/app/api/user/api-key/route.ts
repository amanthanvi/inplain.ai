import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getClerkUser } from '@/lib/auth-clerk';
import { clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  return withAuth(async (userId) => {
    try {
      const body = await request.json();
      const { name } = body;
      
      const user = await getClerkUser();
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Check if this is during onboarding
      const isOnboarding = name === 'Onboarding Key';
      
      // Premium feature check (skip for onboarding)
      const tier = (user.publicMetadata as any)?.tier || 'free';
      if (!isOnboarding && tier === 'free') {
        return NextResponse.json(
          { error: 'API access is only available for premium users' },
          { status: 403 }
        );
      }
      
      // Generate API key
      const apiKey = `pk_${crypto.randomBytes(32).toString('hex')}`;
      
      // Store API key in Clerk user's private metadata
      const clerk = await clerkClient();
      const existingKeys = (user.privateMetadata as any)?.apiKeys || [];
      
      const newKey = {
        key: apiKey,
        name: name || 'API Key',
        createdAt: new Date().toISOString(),
        lastUsed: null
      };
      
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...(user.privateMetadata as any || {}),
          apiKeys: [...existingKeys, newKey]
        }
      });
      
      return NextResponse.json({
        key: apiKey,
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