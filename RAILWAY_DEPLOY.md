# Railway Deployment Guide

## Current Issue

The deployment is failing because **Minio S3 storage is not configured** on Railway.

### Error Analysis
- `/api/deploy` returns 500 error
- This happens because the S3 client cannot connect to Minio
- Minio is not deployed on Railway yet

## Solution Options

### Option 1: Use Cloudflare R2 (Recommended - Free & Fast)

Cloudflare R2 is S3-compatible and has a generous free tier.

**Steps:**

1. **Create Cloudflare R2 Bucket**
   - Go to https://dash.cloudflare.com
   - Navigate to R2 → Create Bucket
   - Name it: `easydeploy-storage`

2. **Get R2 Credentials**
   - Go to R2 → Manage R2 API Tokens
   - Create API Token with "Object Read & Write" permissions
   - Save the Access Key ID and Secret Access Key

3. **Set Railway Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=3000
   BASE_URL=https://easy-deploy-production.up.railway.app

   MINIO_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   MINIO_ACCESS_KEY=<your-r2-access-key>
   MINIO_SECRET_KEY=<your-r2-secret-key>
   MINIO_BUCKET_NAME=easydeploy-storage

   RATE_LIMIT_WINDOW_MS=300000
   RATE_LIMIT_MAX_REQUESTS=1
   MAX_FILE_SIZE_MB=10
   FILE_EXPIRY_DAYS=30
   ```

4. **Configure R2 Bucket for Public Access**
   - In R2 bucket settings, enable public access for reading objects
   - Or set up custom domain for cleaner URLs

### Option 2: Deploy Minio on Railway

1. **Add Minio Service**
   - In Railway dashboard, click "New" → "Empty Service"
   - Deploy using Minio Docker image: `minio/minio:latest`
   - Set environment variables:
     ```bash
     MINIO_ROOT_USER=admin
     MINIO_ROOT_PASSWORD=<strong-password>
     ```
   - Start command: `minio server /data --console-address ":9001"`

2. **Create Private Network**
   - Enable Railway's private networking
   - Connect backend to Minio service

3. **Update Backend Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=3000
   BASE_URL=https://easy-deploy-production.up.railway.app

   MINIO_ENDPOINT=http://minio.railway.internal:9000
   MINIO_ACCESS_KEY=admin
   MINIO_SECRET_KEY=<strong-password>
   MINIO_BUCKET_NAME=kids-html
   ```

4. **Initialize Minio Bucket**
   - Access Minio console at the public URL Railway provides
   - Create bucket named `kids-html`
   - Set lifecycle policy for 30-day expiration

### Option 3: Use AWS S3

1. **Create S3 Bucket**
   - Go to AWS Console → S3
   - Create bucket with public read access

2. **Create IAM User**
   - Create user with S3 full access
   - Generate access key

3. **Set Railway Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=3000
   BASE_URL=https://easy-deploy-production.up.railway.app

   MINIO_ENDPOINT=https://s3.amazonaws.com
   MINIO_ACCESS_KEY=<aws-access-key>
   MINIO_SECRET_KEY=<aws-secret-key>
   MINIO_BUCKET_NAME=<your-bucket-name>
   ```

## After Configuration

1. **Redeploy on Railway**
   - Push changes or trigger manual redeploy
   - Railway will rebuild with new environment variables

2. **Test the Deployment**
   - Visit your Railway URL
   - Try uploading an HTML file
   - Check Railway logs for any errors

3. **Monitor Logs**
   ```bash
   # View live logs in Railway dashboard
   # or use Railway CLI:
   railway logs
   ```

## Troubleshooting

### Check Railway Logs
- Go to Railway dashboard → Your service → Deployments → View Logs
- Look for S3/Minio connection errors
- Verify environment variables are loaded

### Common Issues

1. **Connection timeout**
   - Minio endpoint is wrong or unreachable
   - Check MINIO_ENDPOINT URL

2. **Access denied**
   - Wrong credentials
   - Check MINIO_ACCESS_KEY and MINIO_SECRET_KEY

3. **Bucket not found**
   - Bucket doesn't exist
   - Create bucket manually or check MINIO_BUCKET_NAME

4. **Port issues**
   - Railway assigns dynamic PORT
   - Our code reads from process.env.PORT (already configured)

## Recommended Next Steps

1. ✅ Use Cloudflare R2 (free, fast, S3-compatible)
2. Set all environment variables in Railway
3. Redeploy
4. Test upload functionality
5. Monitor logs for any issues
