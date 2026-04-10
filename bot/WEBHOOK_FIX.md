# Webhook "Invalid Payload Structure" Fix

## Problem Summary

Alchemy was correctly firing webhook calls to the Railway deployment, but the bot was rejecting them with "Invalid payload structure" error.

## Root Causes Identified

### 1. GraphQL Response Wrapper
Alchemy GraphQL webhooks wrap their response in a `data` field:
```json
{
  "data": {
    "block": { ... }
  }
}
```

But the validation function only checked for:
```json
{
  "block": { ... }
}
```

### 2. Express Body Parsing Conflict
The server had both middlewares trying to parse JSON:
```typescript
app.use(express.json());
app.use(express.raw({ type: 'application/json' }));
```

This caused:
- Signature verification issues (needed raw body string)
- Race condition between parsers
- Potential body corruption

## Changes Made

### 1. Updated Payload Validation (`lib/security/webhook-auth.ts`)
✅ Now handles both wrapper formats:
```typescript
const block = payload.data?.block || payload.block;
```

✅ Added detailed error logging to help debug future issues

### 2. Fixed Body Parsing (`server.ts`)
✅ Removed conflicting `express.raw()` middleware
✅ Added `verify` callback to preserve raw body:
```typescript
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
```

### 3. Updated Signature Verification (`lib/security/webhook-auth.ts`)
✅ Now uses raw body when available:
```typescript
const body = req.rawBody || JSON.stringify(req.body);
```

### 4. Updated Request Conversion (`server.ts`)
✅ Passes `rawBody` property to webhook handlers:
```typescript
function createVercelRequest(req: any): any {
  return {
    ...
    rawBody: req.rawBody, // Critical for signature verification
  };
}
```

### 5. Updated Webhook Handlers
✅ `api/webhooks/role-set.ts` - extracts payload correctly:
```typescript
const payload = (req.body.data || req.body) as AlchemyGraphQLWebhook;
```

✅ `api/webhooks/mandate-adopted.ts` - same update applied

## Files Changed

1. `bot/lib/security/webhook-auth.ts` - Validation and signature verification
2. `bot/server.ts` - Express middleware configuration
3. `bot/api/webhooks/role-set.ts` - Payload extraction
4. `bot/api/webhooks/mandate-adopted.ts` - Payload extraction

## Testing Checklist

- [ ] **Rebuild and redeploy to Railway**
  ```bash
  cd bot
  # Railway will auto-deploy from git push
  git add .
  git commit -m "fix: resolve webhook payload validation issues"
  git push
  ```

- [ ] **Verify deployment health**
  ```bash
  curl https://bot-railway-production-d5c8.up.railway.app/health
  # Should return: {"status":"ok","timestamp":"..."}
  ```

- [ ] **Trigger a test webhook**
  - Deploy a Powers contract or trigger a role change
  - Check Railway logs for the webhook processing
  - Look for successful payload validation (no "Invalid payload structure" errors)

- [ ] **Monitor Railway logs**
  ```bash
  # In Railway dashboard, check for:
  # - "PowersRoleSet event received..."
  # - No signature verification errors
  # - No payload validation errors
  # - Successful group operations
  ```

## What to Look For in Logs

### ✅ Success indicators:
```
PowersRoleSet event received for 0x... on chain 11155111
Role assigned/revoked - roleId: X, account: 0x...
DM sent to 0x...
Found X mandates for role Y
Executing Z group operations
```

### ❌ Error indicators (should NOT appear anymore):
```
Invalid payload structure
Payload validation failed: missing block object
Missing X-Alchemy-Signature header
Invalid webhook signature
```

## Additional Improvements Made

- Enhanced error logging with detailed validation feedback
- Better type safety with structured error messages
- Preserved backward compatibility (handles both payload formats)

## Next Steps

1. Deploy the changes to Railway
2. Test with a real PowersRoleSet event
3. Monitor logs for successful processing
4. If issues persist, check the detailed error logs added in this fix

## Rollback Plan

If issues occur, revert commits:
```bash
git log --oneline  # Find commit hash before these changes
git revert <commit-hash>
git push
```

---
**Last Updated:** 2026-04-10  
**Changes By:** AI Assistant  
**Status:** Ready for deployment and testing
