import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs';
import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    
    // Get form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, and WebP images are allowed.' },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `feedback/${user?.id || 'anonymous'}/${nanoid()}.${fileExtension}`;
    
    // Upload to Vercel Blob
    const blob = await put(fileName, file, {
      access: 'public',
      addRandomSuffix: false,
    });
    
    return NextResponse.json({
      url: blob.url,
      id: nanoid(),
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}