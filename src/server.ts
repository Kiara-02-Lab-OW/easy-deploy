import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables from .env.local (for development) or .env.production
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: path.join(__dirname, '..', envFile) });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Configuration from environment variables
const config = {
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucketName: process.env.MINIO_BUCKET_NAME || 'kids-html',
  },
  server: {
    baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '300000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1', 10),
  },
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  },
};

// Minio S3 client configuration
const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: config.minio.endpoint,
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = config.minio.bucketName;
const MAX_FILE_SIZE = config.upload.maxFileSizeMB * 1024 * 1024;

// Rate limiting: simple in-memory store (IP → timestamps)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = config.rateLimit.windowMs;
const RATE_LIMIT_MAX = config.rateLimit.maxRequests;

// Multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/html' || file.originalname.endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('Only .html files are allowed'));
    }
  },
});

// Rate limiting middleware
const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }

  const timestamps = rateLimitStore.get(ip)!;
  // Remove timestamps older than window
  const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recentTimestamps.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too many requests. Try again in 5 minutes.',
    });
  }

  recentTimestamps.push(now);
  rateLimitStore.set(ip, recentTimestamps);
  next();
};

// Generate random slug
function generateSlug(): string {
  const adjectives = ['happy', 'silly', 'bouncy', 'swift', 'clever', 'bright', 'zippy', 'quirky'];
  const animals = ['cat', 'dog', 'fox', 'panda', 'penguin', 'dolphin', 'otter', 'eagle'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${adj}-${animal}-${num}`;
}

// Deploy endpoint
app.post(
  '/api/deploy',
  rateLimitMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const slug = generateSlug();
      const fileName = `${slug}.html`;

      // Upload to Minio
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: 'text/html; charset=utf-8',
          Metadata: {
            'original-filename': req.file.originalname,
            'upload-timestamp': new Date().toISOString(),
          },
        })
      );

      const deploymentUrl = `${config.server.baseUrl}/${slug}`;

      res.json({
        slug,
        url: deploymentUrl,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(deploymentUrl)}`,
      });
    } catch (error) {
      console.error('Deploy error:', error);
      res.status(500).json({ error: 'Deployment failed' });
    }
  }
);

// Home page - serve UI (must be before /:slug route)
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Serve deployed HTML (must be last to avoid catching other routes)
app.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Validate slug format (prevent directory traversal)
    if (!/^[a-z]+-[a-z]+-\d{4}$/.test(slug)) {
      return res.status(404).send('Not found');
    }

    const fileName = `${slug}.html`;

    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      })
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream the file
    if (response.Body instanceof Readable) {
      response.Body.pipe(res);
    } else {
      res.send(await response.Body?.transformToString());
    }
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).send('File not found');
    }
    console.error('Fetch error:', error);
    res.status(500).send('Error retrieving file');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📤 Upload: POST /api/deploy`);
  console.log(`📄 View: GET /:slug`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 Bucket: ${config.minio.bucketName}`);
  console.log(`🔗 Base URL: ${config.server.baseUrl}`);
});
