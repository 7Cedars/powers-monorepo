# Webhook Security

This document outlines the security measures implemented for the Powers XMTP Bot webhooks.

## Overview

The bot exposes two webhook endpoints that receive events from Alchemy:
- `/api/webhooks/mandate-adopted` - Triggered when a mandate is adopted
- `/api/webhooks/role-set` - Triggered when a role is assigned or revoked

These endpoints are protected with multiple layers of security to prevent unauthorized access and abuse.

## Security Measures

### 1. Signature Verification

All webhook requests are verified using **HMAC-SHA256 signatures** provided by Alchemy in the `X-Alchemy-Signature` header.

**How it works:**
- Alchemy signs each webhook payload with a secret key
- The bot recomputes the signature and compares it with the received signature
- Uses timing-safe comparison to prevent timing attacks
- Requests with invalid signatures are rejected with `401 Unauthorized`

### 2. Payload Validation

Each webhook payload is validated to ensure it contains the expected structure:
- Checks for required fields (`block`, `hash`, `number`, `timestamp`, `logs`)
- Validates log structure and event topics
- Rejects malformed payloads with `400 Bad Request`

### 3. Rate Limiting

In-memory rate limiting prevents abuse:
- **Limit:** 100 requests per minute per unique block hash
- Uses block hash as identifier (unique per blockchain event)
- Requests exceeding the limit are rejected with `429 Too Many Requests`

**Note:** For production at scale, consider upgrading to Redis-based rate limiting.

### 4. Method Validation

- Only `POST` requests are accepted
- Other methods receive `405 Method Not Allowed`

## Setup Instructions

### 1. Configure Alchemy Webhooks

1. Go to your [Alchemy Dashboard](https://dashboard.alchemy.com/)
2. Navigate to **Webhooks** → **Create Webhook**
3. Select **GraphQL Webhook** type
4. Configure the webhook:
   - **Webhook URL:** `https://your-domain.vercel.app/api/webhooks/mandate-adopted?chainId={CHAIN_ID}`
   - **Event Type:** Custom event for `MandateAdopted`
   - **Signing Key:** Generate and save this secret key
5. Repeat for `role-set` webhook

### 2. Set Environment Variables

Add the webhook signing secrets to your environment:

```bash
# In Vercel Dashboard or .env file
WEBHOOK_SECRET_MANDATE_ADOPTED=your_alchemy_signing_key_1
WEBHOOK_SECRET_ROLE_SET=your_alchemy_signing_key_2
```

**Important:** 
- Never commit these secrets to version control
- Use different signing keys for each webhook
- Rotate keys periodically for enhanced security

### 3. Deploy to Vercel

```bash
cd bot
vercel --prod
```

Ensure all environment variables are set in Vercel:
- Go to **Project Settings** → **Environment Variables**
- Add all required secrets from `.env.example`

## Monitoring & Logging

The webhooks log security events:

```typescript
// Invalid signature
console.error('Invalid webhook signature');

// Rate limit exceeded
console.warn('Rate limit exceeded for {identifier}');

// Invalid payload
console.error('Invalid payload structure');
```

Monitor these logs in Vercel's Function Logs to detect:
- Attempted unauthorized access
- Malformed webhook requests
- Rate limit violations

## Testing Webhooks

### Test Signature Verification

```bash
# This should fail with 401 Unauthorized
curl -X POST https://your-domain.vercel.app/api/webhooks/mandate-adopted \
  -H "Content-Type: application/json" \
  -d '{"block":{"hash":"0x123","number":"1","timestamp":"123","logs":[]}}'
```

### Test with Valid Signature

Use Alchemy's webhook testing tool in the dashboard to send test events with valid signatures.

## Security Best Practices

1. **Rotate Secrets Regularly:** Change webhook signing keys every 90 days
2. **Monitor Logs:** Set up alerts for authentication failures
3. **Use HTTPS:** Always use HTTPS in production (automatic with Vercel)
4. **Limit IP Ranges:** Consider IP whitelisting if Alchemy provides static IPs
5. **Upgrade Rate Limiting:** For production, use Redis for distributed rate limiting

## Threat Mitigation

| Threat | Mitigation |
|--------|------------|
| Unauthorized webhook calls | HMAC signature verification |
| Replay attacks | Rate limiting by block hash |
| Payload injection | Strict payload validation |
| Timing attacks | Timing-safe signature comparison |
| DDoS | Rate limiting (100 req/min) |
| Man-in-the-middle | HTTPS only |

## Emergency Response

If you suspect a security breach:

1. **Immediately rotate** webhook signing secrets in Alchemy
2. **Update** environment variables in Vercel
3. **Review** function logs for suspicious activity
4. **Monitor** XMTP group operations for anomalies
5. **Report** any confirmed breaches to the team

## Contact

For security concerns, contact the development team or open a confidential issue.
