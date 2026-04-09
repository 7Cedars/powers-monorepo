// Webhook authentication and security utilities

import type { VercelRequest } from '@vercel/node';
import { createHmac } from 'crypto';

/**
 * Verify Alchemy webhook signature
 * Alchemy signs webhook payloads with HMAC-SHA256
 */
export function verifyAlchemySignature(
  req: VercelRequest,
  webhookSecret: string
): boolean {
  try {
    const signature = req.headers['x-alchemy-signature'] as string;
    
    if (!signature) {
      console.error('Missing X-Alchemy-Signature header');
      return false;
    }
    
    // Get raw body as string
    const body = JSON.stringify(req.body);
    
    // Compute expected signature
    const hmac = createHmac('sha256', webhookSecret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures (timing-safe comparison)
    return timingSafeEqual(signature, expectedSignature);
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Rate limiting using in-memory store
 * For production, consider using Redis or similar
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;
  
  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }
  
  /**
   * Check if request should be allowed
   * @param identifier Unique identifier (e.g., IP address, webhook ID)
   * @returns true if request is allowed, false if rate limit exceeded
   */
  check(identifier: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(identifier) || [];
    
    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
    
    if (validTimestamps.length >= this.maxRequests) {
      console.warn(`Rate limit exceeded for ${identifier}`);
      return false;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(identifier, validTimestamps);
    
    // Cleanup old entries periodically
    if (this.requests.size > 1000) {
      this.cleanup(now);
    }
    
    return true;
  }
  
  private cleanup(now: number): void {
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

// Global rate limiter instance
// 100 requests per minute per webhook ID
export const webhookRateLimiter = new RateLimiter(60000, 100);

/**
 * Validate Alchemy GraphQL webhook payload structure
 */
export function isValidAlchemyPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  
  // Check required top-level structure
  if (!payload.block || typeof payload.block !== 'object') {
    return false;
  }
  
  const { block } = payload;
  
  // Validate block structure
  if (typeof block.hash !== 'string' ||
      typeof block.number !== 'string' ||
      typeof block.timestamp !== 'string' ||
      !Array.isArray(block.logs)) {
    return false;
  }
  
  // Validate logs structure
  for (const log of block.logs) {
    if (!log || typeof log !== 'object') {
      return false;
    }
    
    if (!Array.isArray(log.topics) ||
        typeof log.data !== 'string' ||
        !log.account?.address ||
        !log.transaction) {
      return false;
    }
  }
  
  return true;
}
