import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
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
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    bucketName: process.env.SUPABASE_BUCKET_NAME || 'deploy-files',
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

// Supabase client configuration
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

const BUCKET_NAME = config.supabase.bucketName;
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

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, req.file.buffer, {
          contentType: 'text/html; charset=utf-8',
          upsert: false,
          metadata: {
            'original-filename': req.file.originalname,
            'upload-timestamp': new Date().toISOString(),
          },
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      const deploymentUrl = `${config.server.baseUrl}/${slug}`;

      res.json({
        slug,
        url: deploymentUrl,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(deploymentUrl)}`,
      });
    } catch (error: any) {
      console.error('Deploy error:', error);
      const errorMessage = error.message || 'Deployment failed';
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        supabaseUrl: config.supabase.url,
        bucket: BUCKET_NAME
      });
      res.status(500).json({
        error: process.env.NODE_ENV === 'development'
          ? `Deployment failed: ${errorMessage}`
          : 'Deployment failed'
      });
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

    // Download from Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(fileName);

    if (error) {
      console.error('Supabase download error:', error);
      return res.status(404).send('File not found');
    }

    if (!data) {
      return res.status(404).send('File not found');
    }

    // Convert Blob to text
    const htmlContent = await data.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(htmlContent);
  } catch (error: any) {
    console.error('Fetch error:', error);
    res.status(500).send('Error retrieving file');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📤 Upload: POST /api/deploy`);
  console.log(`📄 View: GET /:slug`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Storage: Supabase (${config.supabase.bucketName})`);
  console.log(`🔗 Base URL: ${config.server.baseUrl}`);
});
