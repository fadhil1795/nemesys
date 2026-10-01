import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Local storage directory
export const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads/tickets');

// Ensure local directory exists
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

/**
 * Get configured S3 Client dynamically (always reloads .env)
 */
export function getS3Client(): { client: S3Client | null; bucket: string; endpoint: string; publicUrl: string } {
  // Always load latest .env from backend directory
  dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

  const STORAGE_DRIVER = process.env.STORAGE_DRIVER || '';
  if (STORAGE_DRIVER === 'local') {
    return { client: null, bucket: '', endpoint: '', publicUrl: '' };
  }

  const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
  const S3_REGION = process.env.S3_REGION || 'garage';
  const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
  const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
  const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'nemesys';
  const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE !== 'false';
  const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || '';

  if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
    try {
      const client = new S3Client({
        endpoint: S3_ENDPOINT,
        region: S3_REGION,
        credentials: {
          accessKeyId: S3_ACCESS_KEY,
          secretAccessKey: S3_SECRET_KEY,
        },
        forcePathStyle: S3_FORCE_PATH_STYLE,
      });
      return { client, bucket: S3_BUCKET_NAME, endpoint: S3_ENDPOINT, publicUrl: S3_PUBLIC_URL };
    } catch (err) {
      console.error('[Storage] Error creating S3 client:', err);
    }
  }
  return { client: null, bucket: S3_BUCKET_NAME, endpoint: '', publicUrl: '' };
}

/**
 * Get current storage driver status
 */
export function getStorageInfo() {
  const { client, bucket, endpoint } = getS3Client();
  return {
    driver: client ? 's3-garage' : 'local-disk',
    endpoint: endpoint || null,
    bucket: bucket || null,
    localPath: LOCAL_UPLOADS_DIR,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
  };
}

/**
 * Fetch object stream from Garage S3 or Local Disk
 */
export async function getObjectStream(key: string): Promise<{ stream: any; contentType: string; contentLength?: number } | null> {
  const { client, bucket } = getS3Client();
  if (client) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const response = await client.send(command);
      return {
        stream: response.Body,
        contentType: response.ContentType || 'image/jpeg',
        contentLength: response.ContentLength,
      };
    } catch (err) {
      console.error('[Storage] Error fetching object from Garage S3:', err);
    }
  }

  // Local fallback
  const localFilePath = path.join(__dirname, '../../uploads', key);
  if (fs.existsSync(localFilePath)) {
    const ext = path.extname(localFilePath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
    const stream = fs.createReadStream(localFilePath);
    return {
      stream,
      contentType,
    };
  }

  return null;
}

/**
 * Upload a binary buffer to Garage S3 or Local Filesystem
 */
export async function uploadFileBuffer(
  buffer: Buffer,
  originalFilename: string,
  mimetype: string = 'image/jpeg',
  folder: string = 'tickets'
): Promise<{ url: string; filename: string; storage: string; size: number }> {
  // Generate unique filename
  const rawExt = path.extname(originalFilename);
  const ext = rawExt || (mimetype.includes('png') ? '.png' : mimetype.includes('webp') ? '.webp' : '.jpg');
  const randomHex = crypto.randomBytes(6).toString('hex');
  const filename = `${folder}-${Date.now()}-${randomHex}${ext}`;

  // 1. Try S3 / Garage if configured
  const { client: s3Client, bucket: S3_BUCKET_NAME, endpoint: S3_ENDPOINT, publicUrl: S3_PUBLIC_URL } = getS3Client();
  if (s3Client) {
    try {
      const key = `${folder}/${filename}`;
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      });

      await s3Client.send(command);

      // Determine public URL (use /api/upload/view/ proxy for maximum compatibility)
      let s3Url = `/api/upload/view/${key}`;
      if (S3_PUBLIC_URL && !S3_PUBLIC_URL.includes(':30188')) {
        const cleanBase = S3_PUBLIC_URL.replace(/\/$/, '');
        if (cleanBase.endsWith(`/${S3_BUCKET_NAME}`)) {
          s3Url = `${cleanBase}/${key}`;
        } else {
          s3Url = `${cleanBase}/${S3_BUCKET_NAME}/${key}`;
        }
      }

      console.log(`[Storage] Successfully uploaded to Garage S3: key=${key} -> Proxy URL: ${s3Url}`);
      return {
        url: s3Url,
        filename: key,
        storage: 'garage-s3',
        size: buffer.length
      };
    } catch (err: any) {
      console.error(`[Storage] S3 upload failed, falling back to local storage:`, err?.message || err);
      // Fallback to local storage below
    }
  }

  // 2. Local physical file storage fallback
  const targetDir = path.join(__dirname, '../../uploads', folder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);

  const localUrl = `/uploads/${folder}/${filename}`;
  console.log(`[Storage] Saved physical file to local disk: ${filePath} -> URL: ${localUrl}`);

  return {
    url: localUrl,
    filename: `${folder}/${filename}`,
    storage: 'local-disk',
    size: buffer.length
  };
}

/**
 * Upload Base64 data URL to Garage S3 or Local Filesystem
 */
export async function uploadBase64Image(
  base64DataUrl: string,
  folder: string = 'tickets'
): Promise<{ url: string; filename: string; storage: string; size: number }> {
  if (!base64DataUrl || typeof base64DataUrl !== 'string') {
    throw new Error('Data gambar kosong');
  }

  // If it's already a full URL or relative uploads URL, return as is
  if (base64DataUrl.startsWith('http://') || base64DataUrl.startsWith('https://') || base64DataUrl.startsWith('/uploads/') || base64DataUrl.startsWith('/api/upload/view/')) {
    return {
      url: base64DataUrl,
      filename: path.basename(base64DataUrl),
      storage: 'existing',
      size: 0
    };
  }

  let mimetype = 'image/jpeg';
  let base64Content = base64DataUrl;

  const commaIndex = base64DataUrl.indexOf(',');
  if (commaIndex !== -1 && base64DataUrl.startsWith('data:')) {
    const meta = base64DataUrl.substring(5, commaIndex); // e.g. "image/png;base64"
    const matchType = meta.match(/^([^;]+)/);
    if (matchType) {
      mimetype = matchType[1];
    }
    base64Content = base64DataUrl.substring(commaIndex + 1);
  }

  // Remove any whitespace or newline characters from base64
  const cleanBase64 = base64Content.replace(/\s/g, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const ext = mimetype.includes('png') ? '.png' : mimetype.includes('webp') ? '.webp' : '.jpg';
  const originalFilename = `upload-${Date.now()}${ext}`;

  return await uploadFileBuffer(buffer, originalFilename, mimetype, folder);
}
