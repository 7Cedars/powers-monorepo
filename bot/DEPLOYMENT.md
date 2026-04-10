# Docker Deployment Guide for Powers XMTP Bot

This guide explains how to deploy the Powers XMTP Bot using Docker on Vercel to resolve native module compatibility issues.

## Problem Solved

The bot uses `@xmtp/node-sdk` which contains native Node.js bindings compiled for GLIBC 2.38+. Vercel's default serverless runtime uses Amazon Linux 2 with GLIBC 2.26, causing the error:

```
Error: /lib64/libc.so.6: version `GLIBC_2.38' not found
```

Our solution: Deploy as a containerized application using Ubuntu 24.04 (GLIBC 2.39).

## Architecture Changes

### Before (Serverless Functions)
- Individual API routes as serverless functions
- Managed by `@vercel/node` runtime
- ❌ Incompatible with XMTP native bindings

### After (Docker Container)
- Express server wrapping webhook handlers
- Ubuntu 24.04 container with full control
- ✅ Compatible with XMTP native bindings

## Files Changed/Added

### New Files
1. **`Dockerfile`** - Defines the container image
2. **`.dockerignore`** - Optimizes Docker build
3. **`server.ts`** - Express server wrapping webhooks
4. **`DEPLOYMENT.md`** - This guide

### Modified Files
1. **`package.json`** - Added Express, updated scripts
2. **`vercel.json`** - Changed to Docker build configuration
3. **`tsconfig.json`** - Updated for import attributes (from previous fix)
4. **`lib/powers/abi.ts`** - Added JSON import attribute (from previous fix)

## Prerequisites

Before deploying:

1. ✅ All environment variables set in Vercel dashboard
2. ✅ Alchemy webhooks configured
3. ✅ Bot wallet initialized with XMTP

## Deployment Steps

### 1. Install Dependencies Locally

```bash
cd bot
pnpm install
```

### 2. Test Locally (Optional)

Build and run the Docker container locally:

```bash
# Build the image
docker build -t powers-bot .

# Run the container
docker run -p 3001:3001 \
  -e BOT_PRIVATE_KEY="your_key" \
  -e XMTP_ENV="production" \
  -e WEBHOOK_SECRET_MANDATE_ADOPTED="your_secret" \
  -e WEBHOOK_SECRET_ROLE_SET="your_secret" \
  -e ALCHEMY_API_KEY_SEPOLIA="your_key" \
  powers-bot

# Test health check
curl http://localhost:3001/health
```

### 3. Deploy to Vercel

#### Option A: Via Vercel CLI

```bash
# From the bot directory
cd bot

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Option B: Via Git Push

1. Commit your changes:
```bash
git add .
git commit -m "feat: add Docker deployment for XMTP bot"
git push
```

2. Vercel will automatically detect and build the Dockerfile

### 4. Update Alchemy Webhooks

Update your webhook URLs to point to the new deployment:

**Before:**
```
https://your-app.vercel.app/api/webhooks/role-set?chainId=11155111
```

**After (same URL, but now served by Express):**
```
https://your-app.vercel.app/api/webhooks/role-set?chainId=11155111
```

The URLs remain the same! The only change is the backend implementation.

### 5. Verify Deployment

1. **Check Health Endpoint:**
   ```bash
   curl https://your-app.vercel.app/health
   ```
   
   Expected response:
   ```json
   {"status":"ok","timestamp":"2026-04-10T09:24:00.000Z"}
   ```

2. **Check Vercel Logs:**
   ```bash
   vercel logs
   ```
   
   Look for:
   ```
   Powers XMTP Bot server listening on port 3000
   XMTP client initialized. Bot inbox ID: ...
   ```

3. **Test Webhook:**
   Deploy a Powers instance on Sepolia and verify the webhook is triggered

## Environment Variables

Ensure these are set in Vercel Dashboard → Settings → Environment Variables:

### Required
- `BOT_PRIVATE_KEY` - Bot's Ethereum private key
- `XMTP_ENV` - `production` or `dev`
- `WEBHOOK_SECRET_MANDATE_ADOPTED` - Alchemy signing key
- `WEBHOOK_SECRET_ROLE_SET` - Alchemy signing key

### Per-Chain
- `ALCHEMY_API_KEY_SEPOLIA`
- `ALCHEMY_API_KEY_BASE_SEPOLIA`
- `ALCHEMY_API_KEY_OPTIMISM_SEPOLIA`
- `ALCHEMY_API_KEY_ARBITRUM_SEPOLIA`

### Optional
- `PORT` - Defaults to 3000 (Vercel sets this automatically)
- `NODE_ENV` - Set to `production` in vercel.json

## Troubleshooting

### Build Fails

**Error:** `Cannot find module 'express'`
**Solution:** Run `pnpm install` to update lockfile, then redeploy

**Error:** `Docker build timeout`
**Solution:** This is rare on Vercel. Try deploying again or contact Vercel support

### Runtime Errors

**Error:** `GLIBC version not found`
**Solution:** Verify Dockerfile uses Ubuntu 24.04 (check line 2)

**Error:** `Cannot connect to XMTP`
**Solution:** Ensure bot wallet is initialized with XMTP. Run initialization script locally first

**Error:** `Webhook signature invalid`
**Solution:** Verify `WEBHOOK_SECRET_*` environment variables match Alchemy dashboard

### Performance Issues

**Cold starts are slow (>10 seconds)**
- This is expected with Docker containers
- Consider upgrading to Vercel Pro for better cold start performance
- Alternative: Use a platform optimized for containers (Railway, Fly.io)

## Development Workflow

### Local Development

```bash
# Run development server (watches for changes)
pnpm dev

# Or run specific webhook handler
pnpm dev:webhook
```

### Testing Changes

```bash
# Type check
pnpm type-check

# Build
pnpm build

# Run production build locally
pnpm start
```

### Deploying Changes

1. Make your changes
2. Test locally
3. Commit and push (triggers automatic Vercel deployment)
4. Monitor deployment in Vercel dashboard

## Monitoring

### Vercel Dashboard
- **Functions** → View logs in real-time
- **Deployments** → Check build status
- **Analytics** → Monitor request volume

### Recommended Monitoring
- Set up alerts for:
  - Failed deployments
  - 5xx errors
  - High response times
- Monitor XMTP group creation success rate

## Rollback Procedure

If something goes wrong:

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

Or use the Vercel Dashboard:
1. Go to Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

## Cost Considerations

### Vercel Pricing Impact

**Docker containers on Vercel:**
- Use more GB-hours than serverless functions
- Have longer cold starts
- May require Pro plan for production use

**Estimated costs (as of 2026):**
- Hobby plan: May hit limits with moderate traffic
- Pro plan ($20/month): Recommended for production
- Enterprise: For high-traffic deployments

### Alternative Platforms

If Vercel costs are too high, consider:

1. **Railway** - Great for containerized apps, generous free tier
2. **Fly.io** - Optimized for containers, pay-per-use
3. **Render** - Simple container deployment
4. **Self-hosted** - VPS with Docker (cheapest option)

## Security Notes

1. **Never commit `.env` files** - Added to `.gitignore`
2. **Rotate webhook secrets** regularly (every 90 days)
3. **Bot private key** - Store securely, consider using a dedicated wallet
4. **HTTPS only** - Vercel enforces this automatically
5. **Webhook authentication** - All endpoints verify signatures

## Next Steps

After successful deployment:

1. ✅ Monitor first few webhook calls
2. ✅ Verify XMTP groups are created correctly
3. ✅ Test role assignment functionality
4. ✅ Set up monitoring/alerts
5. ✅ Document any platform-specific issues

## Support

For issues:
1. Check Vercel logs
2. Review this guide
3. Check XMTP documentation
4. Open an issue in the repository

---

**Last Updated:** April 10, 2026
**Deployment Method:** Docker on Vercel
**Runtime:** Ubuntu 24.04 + Node.js 24 + GLIBC 2.39