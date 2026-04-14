// API endpoint for creating XMTP groups via the agent
// This allows the frontend to request group creation without exposing the agent's private key

import type { Request, Response } from 'express';
import { verifyMessage, isAddress, type Address } from 'viem';
import type { Agent } from '@xmtp/agent-sdk';
import {
  createGroupWithSuperAdminPermissions,
  tryToSendDM,
  addMembersToGroup,
  sendMessageToGroup,
} from '../../groups/management.js';
import {
  getMandateMembers,
  getFlowMembers,
  getActionMembers,
} from '../../powers/members.js';

interface CreateGroupRequest {
  chatroomType: 'Mandate' | 'Flow' | 'Action' ;
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
    ['Mandate', 'Flow', 'Action'].includes(body.chatroomType) &&
    typeof body.chainId === 'string' &&
    typeof body.powersAddress === 'string' &&
    typeof body.requesterAddress === 'string' &&
    typeof body.signature === 'string' &&
    typeof body.timestamp === 'number'
  );
}

/**
 * Generates the base chatroom identifier (without timestamp)
 * Used for signature verification
 */
function getBaseChatroomId(
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
 * Generates the unique chatroom identifier with timestamp
 * Used for actual group creation
 */
function getChatroomId(
  chatroomType: string,
  chainId: string,
  powersAddress: string,
  contextId?: string
): string {
  const baseParts = [chatroomType, chainId, powersAddress];
  if (contextId) baseParts.push(contextId);
  // Add Unix timestamp to make group names unique for testing
  const unixTime = Math.floor(Date.now() / 1000);
  baseParts.push(unixTime.toString());
  return baseParts.join('-');
}

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitStore.get(key) || 0;
  
  if (now - lastRequest < RATE_LIMIT_WINDOW) {
    return false; // Rate limited
  }
  
  rateLimitStore.set(key, now);
  return true;
}

/**
 * Express handler for creating XMTP groups
 */
export function createGroupHandler(agent: Agent) {
  return async (req: Request, res: Response) => {
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

      // 4. GENERATE BASE CHATROOM ID (for signature verification)
      const baseChatroomId = getBaseChatroomId(chatroomType, chainId, powersAddress, contextId);

      // 5. VERIFY SIGNATURE (using base chatroom ID without timestamp)
      const message = `Create XMTP group: ${baseChatroomId} at ${timestamp}`;
      
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

      // 6. GENERATE UNIQUE CHATROOM ID (for actual group creation)
      const chatroomId = getChatroomId(chatroomType, chainId, powersAddress, contextId);
      
      // 7. RATE LIMITING
      const rateLimitKey = `create-group:${requesterAddress}:${chatroomId}`;
      if (!checkRateLimit(rateLimitKey)) {
        console.error('Rate limit exceeded for:', requesterAddress);
        return res.status(429).json({ 
          success: false, 
          error: 'Rate limit exceeded - please try again later' 
        });
      }

      console.log(`Creating group for ${requesterAddress}: ${chatroomId}`);

      // 8. CREATE THE GROUP
      try {
        const group = await createGroupWithSuperAdminPermissions(agent, chatroomId);
        
        // 9. ADD MEMBERS BASED ON CHATROOM TYPE
        let membersToAdd: Address[] = [];
        
        try {
          const chainIdNum = parseInt(chainId, 10);
          
          if (chatroomType === 'Flow' && contextId) {
            // Flow chat: get members from all mandates in the flow
            console.log(`Getting flow members for flow ${contextId}`);
            membersToAdd = await getFlowMembers(
              chainIdNum,
              powersAddress as Address,
              BigInt(contextId)
            );
          } else if (chatroomType === 'Mandate' && contextId) {
            // Mandate chat: get members from the mandate's role
            console.log(`Getting mandate members for mandate ${contextId}`);
            membersToAdd = await getMandateMembers(
              chainIdNum,
              powersAddress as Address,
              BigInt(contextId)
            );
          } else if (chatroomType === 'Action' && contextId) {
            // Action chat: get members from the action's mandate role
            console.log(`Getting action members for action ${contextId}`);
            membersToAdd = await getActionMembers(
              chainIdNum,
              powersAddress as Address,
              BigInt(contextId)
            );
          }

          console.log(`Found ${membersToAdd.length} members to add for ${chatroomType} chat`);
          
          // Add members to the group if any were found
          if (membersToAdd.length > 0) {
            await addMembersToGroup(agent, group, membersToAdd);
          } else {
            console.log(`No members to add for ${chatroomType} chat`);
          }
        } catch (memberError) {
          // Log error but don't fail the group creation
          console.error('Error adding members to group:', memberError);
        }
        
        // Send welcome message
        const welcomeMessage = `Welcome to the ${chatroomType} coordination group!\n\nThis group is managed by the Powers XMTP Agent with full admin permissions. Members can be added by the agent or by group admins.`;
        
        await sendMessageToGroup(group, welcomeMessage);
        
        console.log(`Successfully created group: ${chatroomId}`);
        
        return res.status(200).json({ 
          success: true,
          groupName: chatroomId,
          message: 'Group created successfully',
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
  };
}