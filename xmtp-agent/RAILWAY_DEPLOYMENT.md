# Railway Deployment Guide

## Database Persistence Setup

The XMTP agent requires persistent storage for its database to maintain installation data across deployments. Without proper persistence, each deployment creates a new installation, eventually hitting XMTP's installation limit.

### Volume Configuration

The agent is configured to use Railway's persistent volumes through `railway.toml`:

```toml
[[deploy.volumes]]
mountPath = "/data"
name = "xmtp-database"
```

### Verification Steps

1. **Check Volume Exists:**
   - Go to Railway Dashboard → Your Project → Your Service
   - Navigate to the "Volumes" tab
   - Confirm `xmtp-database` volume exists and is mounted at `/data`

2. **Create Volume (if missing):**
   - Click "Add Volume"
   - Name: `xmtp-database`
   - Mount Path: `/data`
   - Click "Add"

3. **Redeploy After Volume Creation:**
   - After creating or modifying volumes, redeploy your service
   - Railway Dashboard → Your Service → Deployments → "Redeploy"

### Environment Variables

The following environment variables are automatically set by `railway.toml`:
- `XMTP_DB_DIRECTORY=/data` (points to persistent volume)
- `XMTP_ENV=production`
- `NODE_ENV=production`

**Important:** Do NOT set `XMTP_DB_DIRECTORY` in your `.env` file or Railway's environment variables dashboard. The value in `railway.toml` will be used for production deployments.

### Local Development

For local development, the agent defaults to `./data` directory when `XMTP_DB_DIRECTORY` is not set. This is handled automatically in `src/config/env.ts`.

### Troubleshooting Installation Issues

If you see warnings about multiple installations:

```
[WARNING] You have "X" installations. Installation ID "..." is the most recent.
```

**Causes:**
- Database not persisting (volume not mounted correctly)
- Environment variable mismatch between `.env` and Railway
- Volume created but service not redeployed

**Solutions:**
1. Verify volume is created and mounted (see steps above)
2. Ensure `XMTP_DB_DIRECTORY` is NOT in your `.env` file
3. Redeploy your Railway service
4. Check deployment logs to confirm database writes to `/data`

**Verify Persistence:**
After deployment, check logs for:
```
Configuration loaded:
- XMTP DB Directory: /data
```

Then on subsequent deployments/restarts, you should see the same installation ID being reused instead of creating new ones.

### Installation Limits

XMTP enforces installation limits to prevent abuse:
- Each unique installation consumes a slot
- Exceeding the limit will cause your agent to stop working
- Old installations can be revoked, but persistence is the best solution

**Prevention:** Ensure your database persists correctly using the volume setup above.