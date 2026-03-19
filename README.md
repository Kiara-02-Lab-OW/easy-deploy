# EasyDeploy - Deployment Tool for Everyone

Upload HTML → Get URL. No vendor lock-in.

**✨ Features:**
- 🌐 **Web UI** - Drag & drop interface for easy deployment
- 🔧 **Environment-based configuration** - Easy toggle between local/production
- 📦 **Self-hosted S3 storage** with Minio
- ⏰ **Auto-expiring deployments** (30 days)
- 🔒 **Rate limiting** built-in
- 📱 **QR codes** for easy sharing

## Quick Start

### Prerequisites
- Docker & Docker Compose
- git

### Run locally

```bash
# Clone repo
git clone <repo-url>
cd easy-deploy

# Start services (backend + Minio)
docker-compose up -d

# Initialize Minio bucket + lifecycle policy
bash setup-minio.sh

# Open the web UI
open http://localhost:3000

# Minio console at http://localhost:9001 (minioadmin / minioadmin)
```

## Using EasyDeploy

### Option 1: Web UI (Recommended)

1. Open http://localhost:3000 in your browser
2. Drag & drop your HTML file or click to browse
3. Click "Deploy Now"
4. Get your deployment URL and QR code!

### Option 2: API/cURL

```bash
# Upload an HTML file
curl -X POST http://localhost:3000/api/deploy \
  -F "file=@test.html"

# Response:
# {
#   "slug": "happy-cat-1234",
#   "url": "http://localhost:3000/happy-cat-1234",
#   "qrCode": "https://api.qrserver.com/..."
# }

# View deployed file
curl http://localhost:3000/happy-cat-1234
```

## Environment Configuration

### Setup

EasyDeploy uses environment files for configuration:

- `.env.example` - Template with all available variables
- `.env.local` - Local development (auto-loaded in dev mode)
- `.env.production` - Production settings (auto-loaded when NODE_ENV=production)

**First time setup:**
```bash
# Files are already created, but you can customize them:
cp .env.example .env.local    # Already exists
nano .env.local               # Edit if needed
```

### Available Environment Variables

```env
# Application Environment
NODE_ENV=development                    # development or production

# Server Configuration
PORT=3000                               # Server port
BASE_URL=http://localhost:3000          # Public base URL

# Minio/S3 Configuration
MINIO_ENDPOINT=http://minio:9000        # Minio endpoint
MINIO_ACCESS_KEY=minioadmin             # Access key
MINIO_SECRET_KEY=minioadmin             # Secret key
MINIO_BUCKET_NAME=kids-html             # Bucket name

# Rate Limiting
RATE_LIMIT_WINDOW_MS=300000             # 5 minutes in ms
RATE_LIMIT_MAX_REQUESTS=1               # Max uploads per window

# File Upload
MAX_FILE_SIZE_MB=10                     # Max file size in MB

# Lifecycle Policy
FILE_EXPIRY_DAYS=30                     # Auto-delete after N days
```

### Toggle Between Environments

**Local Development:**
```bash
# Automatically uses .env.local
docker-compose up -d
```

**Production:**
```bash
# Set NODE_ENV=production to use .env.production
# Or set variables directly in your hosting platform
```

## Architecture

```
EasyDeploy
├── Web UI (/)
│   └── Drag & drop HTML upload interface
├── API
│   ├── POST /api/deploy    → validate + upload to Minio
│   ├── GET /:slug          → fetch from Minio
│   └── GET /health         → health check
├── Node.js Express (port 3000)
│   └── Rate limit: 1/5min per IP (configurable)
├── Minio S3 (port 9000, 9001 console)
│   ├── Bucket: kids-html (configurable)
│   └── Lifecycle: auto-delete after 30 days
```

## API Reference

### GET /

Web UI for drag-and-drop HTML deployment.

### POST /api/deploy

Upload HTML file for deployment.

**Request:**
```
Content-Type: multipart/form-data
file: [.html file, max 10MB (configurable)]
```

**Response (200):**
```json
{
  "slug": "happy-cat-1234",
  "url": "http://localhost:3000/happy-cat-1234",
  "qrCode": "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=..."
}
```

**Errors:**
- 400: No file / wrong format
- 429: Too many requests (rate limited)
- 500: Server error

### GET /:slug

Retrieve deployed HTML file.

**Response (200):** HTML content, `text/html` MIME type

**Errors:**
- 404: File not found
- 500: Server error

### GET /health

Health check endpoint.

**Response (200):**
```json
{ "status": "ok" }
```

## Development

### Local without Docker

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start dev server
npm run dev

# Requires Minio running separately or mocked S3
```

### Build for production

```bash
npm run build
npm start
```

## Deployment

### Railway (Recommended Cloud Platform)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects the Dockerfile

3. **Add Minio Service**
   - In Railway dashboard, click "New" → "Database" → "Add Minio"
   - Or deploy Minio as a separate service

4. **Set Environment Variables** in Railway dashboard:
   ```env
   NODE_ENV=production
   PORT=3000
   BASE_URL=https://your-app.railway.app
   MINIO_ENDPOINT=<minio-internal-url>
   MINIO_ACCESS_KEY=<your-key>
   MINIO_SECRET_KEY=<your-secret>
   MINIO_BUCKET_NAME=kids-html
   ```

5. **Configure Minio**
   - Create bucket via Minio console
   - Set public read policy
   - Configure lifecycle rules (30-day expiry)

6. **Access Your App**
   - Railway provides a public URL automatically
   - Update `BASE_URL` environment variable with this URL

### Single VPS (DigitalOcean, Linode, etc.)

1. **SSH into VPS**
   ```bash
   ssh root@your-vps-ip
   ```

2. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

3. **Clone repo & configure**
   ```bash
   git clone <repo-url>
   cd easy-deploy

   # Update .env.local with your domain
   nano .env.local
   # Change BASE_URL to your domain
   ```

4. **Start services**
   ```bash
   docker-compose up -d
   bash setup-minio.sh
   ```

5. **(Optional) Add SSL with Caddy**
   Add to docker-compose.yml:
   ```yaml
   caddy:
     image: caddy:latest
     ports:
       - "80:80"
       - "443:443"
     volumes:
       - ./Caddyfile:/etc/caddy/Caddyfile
       - caddy-data:/data
     networks:
       - kids-network
   ```

## File Storage

- **Default:** Minio (S3-compatible, self-hosted)
- **Alternative:** Use AWS S3, Cloudflare R2, or any S3-compatible service
- **Lifecycle:** Files auto-delete after 30 days (configurable)
- **Slug format:** `{adjective}-{animal}-{4-digit-number}` (e.g., `happy-cat-1234`)
- **Max size:** 10MB per file (configurable via `MAX_FILE_SIZE_MB`)

## Rate Limiting

- **Default:** 1 upload per IP per 5 minutes
- **Configurable:** Set `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`
- **Response:** 429 Too Many Requests
- **Storage:** In-memory (resets on restart, use Redis for multi-instance)

## Project Structure

```
easy-deploy/
├── src/
│   └── server.ts           # Express server with all routes
├── public/
│   └── index.html          # Web UI
├── .env.example            # Environment template
├── .env.local              # Local development config
├── .env.production         # Production config
├── docker-compose.yml      # Docker services
├── Dockerfile              # Container build
├── setup-minio.sh          # Minio initialization script
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## Security Notes

- `.env.local` and `.env.production` are excluded from git
- Only `.env.example` is committed (no secrets)
- Rate limiting prevents abuse
- Slug validation prevents directory traversal
- Files auto-expire after 30 days

## License

MIT

## Questions?

- Minio docs: https://docs.min.io
- Express docs: https://expressjs.com
- AWS S3 SDK: https://docs.aws.amazon.com/sdk-for-javascript/
- Railway docs: https://docs.railway.app
