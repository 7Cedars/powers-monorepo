# Alternative Deployment Options for Powers XMTP Bot

Vercel doesn't support custom Dockerfiles for serverless deployments. Here are your options:

## Option 1: Railway (Recommended - Easiest) ⭐

Railway has excellent Docker support and is very simple to deploy.

### Steps:

1. **Sign up at [railway.app](https://railway.app)**

2. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

3. **Deploy from the bot directory:**
   ```bash
   cd bot
   railway init
   railway up
   ```

4. **Set environment variables:**
   ```bash
   railway variables set BOT_PRIVATE_KEY=your_key
   railway variables set XMTP_ENV=production
   railway variables set WEBHOOK_SECRET_MANDATE_ADOPTED=your_secret
   railway variables set WEBHOOK_SECRET_ROLE_SET=your_secret
   railway variables set ALCHEMY_API_KEY_SEPOLIA=your_key
   # ... add other env vars
   ```

5. **Get your deployment URL:**
   ```bash
   railway domain
   ```

6. **Update Alchemy webhooks** with the new Railway URL

**Pricing:** 
- $5/month for Hobby plan (500 hours)
- Very generous free trial
- Pay-as-you-go after trial

---

## Option 2: Render (Simple & Reliable)

Render has great Docker support and automatic deployments from Git.

### Steps:

1. **Sign up at [render.com](https://render.com)**

2. **Create new Web Service:**
   - Connect your GitHub repo
   - Select the `bot` directory as root
   - Choose "Docker" as environment
   - Set instance type: Starter ($7/month) or Free

3. **Add environment variables** in the Render dashboard

4. **Deploy** - Render auto-deploys from Git

5. **Get your URL** and update Alchemy webhooks

**Pricing:**
- Free tier available (with limitations)
- Starter: $7/month
- Auto-sleep on free tier (not ideal for webhooks)

---

## Option 3: Fly.io (Best for Global Distribution)

Fly.io is optimized for containerized apps with excellent performance.

### Steps:

1. **Install flyctl:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   flyctl auth login
   ```

2. **Launch app from bot directory:**
   ```bash
   cd bot
   flyctl launch
   ```
   
   - Name your app
   - Choose region
   - Accept Dockerfile detection

3. **Set secrets:**
   ```bash
   flyctl secrets set BOT_PRIVATE_KEY=your_key
   flyctl secrets set XMTP_ENV=production
   flyctl secrets set WEBHOOK_SECRET_MANDATE_ADOPTED=your_secret
   # ... add other secrets
   ```

4. **Deploy:**
   ```bash
   flyctl deploy
   ```

5. **Get URL and update Alchemy:**
   ```bash
   flyctl info
   ```

**Pricing:**
- $5-10/month for basic usage
- Free trial available

---

## Option 4: Keep Vercel (Try Node 20+ Runtime)

Try using Vercel's standard Node runtime - Node 20+ might have better GLIBC support.

### Steps:

1. **Revert vercel.json to serverless:**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.1.1"
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

2. **Update package.json to use Node 20:**
Add this at the top level:
```json
"engines": {
  "node": "20.x"
}
```

3. **Deploy:**
```bash
vercel --prod
```

4. **If it fails with GLIBC error**, you'll need to use Option 1, 2, or 3

**Note:** This likely won't work, but worth a quick try if you really want to stay on Vercel.

---

## Option 5: Self-Host on VPS (Cheapest)

Deploy to any VPS (DigitalOcean, Linode, AWS EC2, etc.)

### Quick setup:

```bash
# On your VPS
git clone your-repo
cd bot
docker build -t powers-bot .
docker run -d -p 3000:3000 --env-file .env --restart always powers-bot
```

Set up nginx reverse proxy for HTTPS.

**Pricing:** 
- $4-6/month for basic VPS
- Requires more DevOps knowledge

---

## My Recommendation

**Use Railway (Option 1)** because:
- ✅ Simplest setup (just `railway up`)
- ✅ Excellent Docker support
- ✅ Automatic HTTPS
- ✅ Easy environment variable management
- ✅ Good developer experience
- ✅ Fair pricing ($5/month)
- ✅ Auto-redeploy from Git

The Docker setup we created will work perfectly on Railway, Render, or Fly.io with zero changes!

---

## Migration Checklist

Whichever platform you choose:

- [ ] Deploy to new platform
- [ ] Verify health endpoint works
- [ ] Update Alchemy webhook URLs
- [ ] Test with a real Powers deployment
- [ ] Monitor logs for first few events
- [ ] Set up any platform-specific monitoring
- [ ] (Optional) Delete Vercel deployment

---

**Need help?** I can guide you through any of these options. Railway is the fastest to get running.