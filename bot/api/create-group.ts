// API endpoint for creating XMTP groups via the bot
// This allows the frontend to request group creation without exposing the bot's private key

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyMessage, isAddress } from 'viem';
import {
  createGroupWithSuperAdminPermissions,
  isBotMemberOfGroup,
  sendMessageToGroup,
} from '../lib/xmtp/groups.js';
import { webhookRateLimiter } from '../lib/security/webhook-auth.js';

interface CreateGroupRequest {
  chatroomType: 'Mandate' | 'Flow' | 'Action' | 'Vote' | 'General';
  chainId: string;
  powersAddress: string;
  contextId?: string;
  requesterAddress: string;
  signature: string;
  timestamp: number;
}

/**
 * Validates the request body structure
 */
function isValidRequest(body: any): body is CreateGroupRequest {
  return (
    body &&
    typeof body.chatroomType === 'string' &&
    ['Mandate', 'Flow', 'Action', 'Vote', 'General'].includes(body.chatroomType) &&
    typeof body.chainId === 'string' &&
    typeof body.powersAddress === 'string' &&
    typeof body.requesterAddress === 'string' &&
    typeof body.signature === 'string' &&
    typeof body.timestamp === 'number'
  );
}

/**
 * Generates the chatroom identifier
 */
function getChatroomId(
  chatroomType: string,
  chainId: string,
  powersAddress: string,
  contextId?: string
): string {
  const parts = [chatroomType, chainId, powersAddress];
  if (contextId) parts.push(contextId);
  return parts.join('-');
}

/**
 * API handler for creating XMTP groups
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1. VALIDATE REQUEST STRUCTURE
    if (!isValidRequest(req.body)) {
      console.error('Invalid request structure:', req.body);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request structure' 
      });
    }

    const {
      chatroomType,
      chainId,
      powersAddress,
      contextId,
      requesterAddress,
      signature,
      timestamp,
    } = req.body;

    // 2. VALIDATE TIMESTAMP (prevent replay attacks)
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Math.abs(now - timestamp) > fiveMinutes) {
      console.error('Timestamp too old or in future:', { timestamp, now });
      return res.status(401).json({ 
        success: false, 
        error: 'Request expired - timestamp too old' 
      });
    }

    // 3. VALIDATE ETHEREUM ADDRESSES
    if (!isAddress(requesterAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid requester address' 
      });
    }

    if (!isAddress(powersAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Powers contract address' 
      });
    }

    // 4. GENERATE CHATROOM ID
    const chatroomId = getChatroomId(chatroomType, chainId, powersAddress, contextId);

    // 5. VERIFY SIGNATURE
    const message = `Create XMTP group: ${chatroomId} at ${timestamp}`;
    
    let isValidSignature = false;
    try {
      isValidSignature = await verifyMessage({
        address: requesterAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (err) {
      console.error('Signature verification error:', err);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid signature' 
      });
    }

    if (!isValidSignature) {
      console.error('Invalid signature from:', requesterAddress);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid signature' 
      });
    }

    // 6. RATE LIMITING
    const rateLimitKey = `create-group:${requesterAddress}:${chatroomId}`;
    if (!webhookRateLimiter.check(rateLimitKey)) {
      console.error('Rate limit exceeded for:', requesterAddress);
      return res.status(429).json({ 
        success: false, 
        error: 'Rate limit exceeded - please try again later' 
      });
    }

    console.log(`Creating group for ${requesterAddress}: ${chatroomId}`);

    // 7. CHECK IF GROUP ALREADY EXISTS
    const alreadyExists = await isBotMemberOfGroup(chatroomId);
    
    if (alreadyExists) {
      console.log(`Group already exists: ${chatroomId}`);
      return res.status(200).json({ 
        success: true, 
        groupName: chatroomId,
        message: 'Group already exists',
        alreadyExists: true,
      });
    }

    // 8. CREATE THE GROUP
    try {
      const group = await createGroupWithSuperAdminPermissions(chatroomId);
      
      // Send welcome message
      const welcomeMessage = `Welcome to the ${chatroomType} coordination group!\n\nThis group is managed by the Powers XMTP Bot with full admin permissions. Members can be added by the bot or by group admins.`;
      
      await sendMessageToGroup(group, welcomeMessage);
      
      console.log(`Successfully created group: ${chatroomId}`);
      
      return res.status(200).json({ 
        success: true,
        groupName: chatroomId,
        message: 'Group created successfully',
        alreadyExists: false,
      });
      
    } catch (err) {
      console.error('Failed to create group:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create group - please try again' 
      });
    }

  } catch (error) {
    console.error('Error processing create-group request:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
    });
  }
}
