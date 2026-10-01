import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadFileBuffer, uploadBase64Image, getStorageInfo, getObjectStream } from '../services/storageService';

const uploadRouter = Router();

// Configure multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG, WebP) yang diizinkan'));
    }
  },
});

/**
 * GET /api/upload/storage-info
 * Check active storage driver (Garage S3 or Local Disk)
 */
uploadRouter.get('/storage-info', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    storage: getStorageInfo(),
  });
});

/**
 * GET /api/upload/view/*
 * Direct proxy & stream images from Garage S3 or Local Disk
 * Solves private bucket permissions, CORS, and Vercel proxy issues seamlessly!
 */
uploadRouter.get('/view/*', async (req: Request, res: Response) => {
  try {
    const rawKey = req.params[0]; // e.g. "tickets/tickets-12345.png"
    if (!rawKey) {
      return res.status(400).send('File key required');
    }

    // Clean up key if full URL or leading slashes are present
    const key = rawKey.replace(/^nemesys\//, '').replace(/^\/+/, '');

    const obj = await getObjectStream(key);
    if (!obj || !obj.stream) {
      return res.status(404).send('File not found in storage');
    }

    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Handle stream piping
    if (typeof (obj.stream as any).pipe === 'function') {
      (obj.stream as any).pipe(res);
    } else if (typeof (obj.stream as any).transformToByteArray === 'function') {
      const byteArray = await (obj.stream as any).transformToByteArray();
      res.send(Buffer.from(byteArray));
    } else {
      res.send(obj.stream);
    }
  } catch (err: any) {
    console.error('Error viewing file:', err);
    res.status(500).send('Error retrieving file');
  }
});

/**
 * POST /api/upload/ticket-photo
 * Multipart form-data upload for ticket evidence photos
 */
uploadRouter.post('/ticket-photo', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File foto tidak ditemukan dalam request (gunakan key "photo" atau "file")' });
    }

    const folder = (req.body.folder as string) || 'tickets';
    const result = await uploadFileBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    res.json({
      success: true,
      message: 'Foto berhasil disimpan',
      url: result.url,
      filename: result.filename,
      storage: result.storage,
      size: result.size,
    });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: error.message || 'Gagal menyimpan file foto' });
  }
});

/**
 * POST /api/upload/ticket-photo-base64
 * Base64 image upload for camera capture
 */
uploadRouter.post('/ticket-photo-base64', async (req: Request, res: Response) => {
  try {
    const { image, folder } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Data gambar Base64 tidak ditemukan' });
    }

    const result = await uploadBase64Image(image, folder || 'tickets');

    res.json({
      success: true,
      message: 'Foto berhasil disimpan',
      url: result.url,
      filename: result.filename,
      storage: result.storage,
      size: result.size,
    });
  } catch (error: any) {
    console.error('Error uploading base64 photo:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses gambar Base64' });
  }
});

export default uploadRouter;
