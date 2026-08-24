import { put } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Uploads a file to Vercel Blob or local disk storage based on config.
 */
export async function uploadFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || '.jpg';
  const filename = `${crypto.randomUUID()}${ext}`;

  // Check if Vercel Blob token is configured or provider is explicitly set
  const useBlob = process.env.STORAGE_PROVIDER === 'vercelBlob' || !!process.env.BLOB_READ_WRITE_TOKEN;

  if (useBlob) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required for Vercel Blob uploads!');
    }
    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: file.type,
    });
    return blob.url;
  } else {
    // Local development fallback
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure directory exists
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);
    
    return `/uploads/${filename}`;
  }
}
