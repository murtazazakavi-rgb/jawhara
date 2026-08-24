import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadFile } from '@/lib/integrations/storage/provider';
import path from 'path';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_COUNT = 10;

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided.' }, { status: 400 });
    }

    if (files.length > MAX_FILE_COUNT) {
      return NextResponse.json({ error: `Cannot upload more than ${MAX_FILE_COUNT} files at once.` }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    // 2. Validate and upload each file
    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the maximum size limit of 10MB.` },
          { status: 400 }
        );
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `File "${file.name}" has an invalid type. Only JPG, PNG, and WebP are allowed.` },
          { status: 400 }
        );
      }

      // Validate file extension
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `File "${file.name}" has an invalid extension.` },
          { status: 400 }
        );
      }

      // Upload file via central provider
      const url = await uploadFile(file);
      uploadedUrls.push(url);
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (error: any) {
    console.error('File upload API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload files.' }, { status: 500 });
  }
}
