# Deploy EasyDeploy to Render

This guide walks you through deploying EasyDeploy to Render using Supabase Storage as the backend.

---

## Prerequisites

1. **Render Account** - Sign up at https://render.com (free tier available)
2. **Supabase Account** - Already configured with:
   - Project URL: `https://hdwrtgzmdhpoccgpnfhm.supabase.co`
   - Bucket: `deploy-files` (public bucket)
   - Service Role Key: (from your `.env.local`)
3. **GitHub Repository** - Code pushed to GitHub

---

## Deployment Steps

### Option 1: Deploy via Render Dashboard (Recommended)

#### Step 1: Create New Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select your repository: `Kiara-02-Lab-OW/easy-deploy`
5. Click **"Connect"**

#### Step 2: Configure Service

Fill in the following settings:

**Basic Settings:**
- **Name:** `easy-deploy` (or your preferred name)
- **Region:** Choose closest to you (e.g., Oregon, Frankfurt)
- **Branch:** `main`
- **Runtime:** `Docker`
- **Instance Type:** `Free` (or paid tier if needed)

**Build Settings:**
- Render will automatically detect your `Dockerfile`
- No build command needed (Docker handles it)

**Environment Variables:**

Click **"Advanced"** and add these environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `BASE_URL` | (Leave empty initially - set after deployment) |
| `SUPABASE_URL` | `https://hdwrtgzmdhpoccgpnfhm.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `<your-service-key-from-.env.local>` |
| `SUPABASE_BUCKET_NAME` | `deploy-files` |
| `RATE_LIMIT_WINDOW_MS` | `300000` |
| `RATE_LIMIT_MAX_REQUESTS` | `1` |
| `MAX_FILE_SIZE_MB` | `10` |
| `FILE_EXPIRY_DAYS` | `30` |

**Important:**
- Get `SUPABASE_SERVICE_KEY` from your `.env.local` file
- DO NOT commit this key to GitHub

#### Step 3: Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying
3. Wait for deployment to complete (5-10 minutes first time)
4. You'll get a URL like: `https://easy-deploy-xxxx.onrender.com`

#### Step 4: Update BASE_URL

1. Copy your Render deployment URL
2. Go to **Environment** tab in your Render service
3. Update `BASE_URL` to your deployment URL (e.g., `https://easy-deploy-xxxx.onrender.com`)
4. Save changes (Render will auto-redeploy)

---

### Option 2: Deploy via Blueprint (Automated)

Render can deploy using the `render.yaml` blueprint file:

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` and configure automatically
5. Add the required environment variables (same as above)
6. Click **"Apply"**

**Note:** You still need to manually set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- Update `BASE_URL` after deployment

---

## Verify Deployment

### 1. Check Build Logs

In Render dashboard:
- Go to your service → **Logs** tab
- Look for: `💾 Storage: Supabase (deploy-files)`
- Ensure no errors during startup

### 2. Test the Application

1. Visit your Render URL: `https://easy-deploy-xxxx.onrender.com`
2. You should see the EasyDeploy upload interface
3. Upload a test HTML file
4. Verify you get a slug URL and QR code
5. Test accessing the deployed file

### 3. Check Supabase Storage

1. Go to Supabase dashboard: https://supabase.com/dashboard/project/hdwrtgzmdhpoccgpnfhm
2. Navigate to **Storage** → `deploy-files` bucket
3. Verify uploaded files appear there

---

## Troubleshooting

### Deployment Fails with "Module not found"

**Issue:** Missing dependencies
**Fix:**
```bash
# Rebuild on Render
# Go to Manual Deploy → "Clear build cache & deploy"
```

### 500 Error on /api/deploy

**Cause:** Missing or incorrect environment variables
**Fix:**
1. Go to **Environment** tab in Render
2. Verify all Supabase variables are set correctly
3. Check `SUPABASE_SERVICE_KEY` (not anon key)
4. Redeploy

### Files Not Uploading to Supabase

**Cause:** Bucket permissions or wrong bucket name
**Fix:**
1. In Supabase dashboard, go to Storage → `deploy-files`
2. Ensure bucket is **public**
3. Verify `SUPABASE_BUCKET_NAME=deploy-files`

### Rate Limit Not Working

**Cause:** Render free tier sleeps after inactivity
**Fix:**
- Upgrade to paid tier ($7/month) for always-on service
- Or accept that first request after sleep will reset rate limits

---

## Post-Deployment Configuration

### Custom Domain (Optional)

1. In Render dashboard → **Settings** → **Custom Domain**
2. Add your domain (e.g., `deploy.yourdomain.com`)
3. Update DNS records as instructed
4. Update `BASE_URL` environment variable to your custom domain

### SSL Certificate

- Render provides free SSL certificates automatically
- Your app will be available via HTTPS

### Monitoring

- **Logs:** Available in Render dashboard (last 7 days on free tier)
- **Metrics:** CPU, memory usage visible in dashboard
- **Alerts:** Set up email alerts for service failures (paid tier)

---

## Cost Comparison

### Render Free Tier
- ✅ 750 hours/month (enough for 1 always-on service)
- ✅ Automatic deploys from GitHub
- ✅ Free SSL
- ❌ Sleeps after 15 min inactivity
- ❌ Limited to 512 MB RAM

### Render Starter ($7/month)
- ✅ Always-on (no sleeping)
- ✅ 512 MB RAM
- ✅ Better support

### Supabase Free Tier
- ✅ 1 GB storage
- ✅ 2 GB bandwidth/month
- ✅ Good for this use case

**Total Cost:** $0 (both free tiers) or $7/month (Render Starter + Supabase Free)

---

## Environment Variables Reference

```bash
# Required
NODE_ENV=production
PORT=3000
BASE_URL=https://your-render-url.onrender.com
SUPABASE_URL=https://hdwrtgzmdhpoccgpnfhm.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
SUPABASE_BUCKET_NAME=deploy-files

# Optional (have defaults)
RATE_LIMIT_WINDOW_MS=300000        # 5 minutes
RATE_LIMIT_MAX_REQUESTS=1           # 1 upload per window
MAX_FILE_SIZE_MB=10                 # 10 MB max
FILE_EXPIRY_DAYS=30                 # Files expire after 30 days
```

---

## Quick Deploy Checklist

- [ ] Create Render account
- [ ] Push code to GitHub (already done ✅)
- [ ] Create new Web Service in Render
- [ ] Connect GitHub repository
- [ ] Set all environment variables
- [ ] Deploy and wait for build
- [ ] Copy deployment URL
- [ ] Update `BASE_URL` environment variable
- [ ] Test file upload
- [ ] Verify file in Supabase Storage
- [ ] Test accessing deployed file via slug

---

## Useful Commands

```bash
# Check what will be deployed
git log -1

# Push latest changes
git push origin main

# View Supabase bucket in CLI (if needed)
npx supabase storage ls deploy-files
```

---

## Support Links

- **Render Documentation:** https://render.com/docs
- **Render Status:** https://status.render.com
- **Supabase Documentation:** https://supabase.com/docs/guides/storage
- **GitHub Repository:** https://github.com/Kiara-02-Lab-OW/easy-deploy

---

**Next Steps:** Follow the deployment steps above and you'll have EasyDeploy running on Render in 10-15 minutes! 🚀
