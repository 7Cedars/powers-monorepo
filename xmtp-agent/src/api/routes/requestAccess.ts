// API endpoint for requesting access to XMTP groups
// This allows users to request access to groups they have the correct role for

import type { Request, Response } from 'express';
import { verifyMessage, isAddress, type Address } from 'viem';
import type { Agent } from '@xmtp/agent-sdk';
import { parseGroupName } from '../../utils/naming.js';
import { findGroupByName, addMembersToGroup } from '../../groups/management.js';
import { getMandateMembers, getFlowMembers, getActionMembers } from '../../powers/members.js';

interface RequestAccessRequest {
  inboxId: string;
  groupName: string;
  requesterAddress: string;
  signature: string;
  timestamp: number;
}

/**
 * Validates the request body structure
 */
function isValidRequest(body: any): body is RequestAccessRequest {
  return (
    body &&
    typeof body.inboxId === 'string' &&
    typeof body.groupName === 'string' &&
    typeof body.requesterAddress === 'string' &&
    typeof body.signature === 'string' &&
    typeof body.timestamp === 'number'
  );
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
 * Express handler for requesting access to XMTP groups
 */
export function requestAccessHandler(agent: Agent) {
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
        inboxId,
        groupName,
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

      // 3. VALIDATE ETHEREUM ADDRESS
      if (!isAddress(requesterAddress)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid requester address' 
        });
      }

      // 4. VERIFY SIGNATURE
      const message = `Request access to group: ${groupName} at ${timestamp}`;
      
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

      // 5. RATE LIMITING
      const rateLimitKey = `request-access:${requesterAddress}:${groupName}`;
      if (!checkRateLimit(rateLimitKey)) {
        console.error('Rate limit exceeded for:', requesterAddress);
        return res.status(429).json({ 
          success: false, 
          error: 'Rate limit exceeded - please try again later' 
        });
      }

      console.log(`Processing access request from ${requesterAddress} for group: ${groupName}`);

      // 6. FETCH INBOX STATE TO VERIFY ADDRESS OWNERSHIP
      try {
        const inboxStates = await agent.client.preferences.fetchInboxStates([inboxId]);
        
        if (inboxStates.length === 0) {
          console.error('No inbox state found for:', inboxId);
          return res.status(400).json({
            success: false,
            error: 'Invalid inbox ID'
          });
        }

        // Get the Ethereum address associated with this inbox
        const inboxState = inboxStates[0];
        // Handle potential mismatch between TS types and runtime
        const identifiers = inboxState.identifiers || (inboxState as any).identities || [];
        
        // Find Ethereum address in identifiers
        const ethIdentifier = identifiers.find((id: any) => 
          id.kind === 'ETHEREUM' || id.identifierKind === 'EthereumIdentifier'
        );

        if (!ethIdentifier) {
          console.error('No Ethereum address found in inbox state for:', inboxId);
          return res.status(400).json({
            success: false,
            error: 'No Ethereum address associated with inbox'
          });
        }

        const inboxAddress = ethIdentifier.identifier as Address;

        // Verify that the requester address matches the inbox address
        if (inboxAddress.toLowerCase() !== requesterAddress.toLowerCase()) {
          console.error('Address mismatch:', { inboxAddress, requesterAddress });
          return res.status(401).json({
            success: false,
            error: 'Requester address does not match inbox'
          });
        }

        console.log(`Verified inbox ${inboxId} belongs to address ${requesterAddress}`);

      } catch (err) {
        console.error('Failed to fetch inbox state:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to verify inbox'
        });
      }

      // 7. PARSE GROUP NAME TO DETERMINE TYPE AND CONTEXT
      const parsed = parseGroupName(groupName);
      
      if (!parsed) {
        console.error('Could not parse group name:', groupName);
        return res.status(400).json({
          success: false,
          error: 'Invalid group name format'
        });
      }

      const { type, chainId, powersAddress, contextId } = parsed;

      // 8. GET AUTHORIZED MEMBERS FOR THIS GROUP TYPE
      let authorizedMembers: Address[] = [];
      
      try {
        if (type === 'Mandate') {
          authorizedMembers = await getMandateMembers(chainId, powersAddress, contextId);
        } else if (type === 'Flow') {
          authorizedMembers = await getFlowMembers(chainId, powersAddress, contextId);
        } else if (type === 'Action') {
          authorizedMembers = await getActionMembers(chainId, powersAddress, contextId);
        }
      } catch (err) {
        console.error('Failed to get authorized members:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to check authorization'
        });
      }

      // 9. CHECK IF REQUESTER HAS THE CORRECT ROLE
      const isAuthorized = authorizedMembers.some(
        (member) => member.toLowerCase() === requesterAddress.toLowerCase()
      );

      if (!isAuthorized) {
        console.log(`Address ${requesterAddress} is not authorized for group ${groupName}`);
        return res.status(403).json({
          success: false,
          error: 'You do not have the required role for this group'
        });
      }

      console.log(`Address ${requesterAddress} is authorized for group ${groupName}`);

      // 10. FIND THE GROUP
      const group = await findGroupByName(agent, groupName);
      
      if (!group) {
        console.error('Group not found:', groupName);
        return res.status(404).json({
          success: false,
          error: 'Group not found'
        });
      }

      // 11. ADD THE INBOX TO THE GROUP
      try {
        // Note: We're using the inbox ID directly here, not the address
        // The addMembersToGroup function needs to be updated to handle inbox IDs
        await (group as any).addMembers([inboxId]);
        
        console.log(`Successfully added inbox ${inboxId} to group ${groupName}`);
        
        return res.status(200).json({
          success: true,
          message: 'Successfully added to group'
        });
      } catch (err) {
        console.error('Failed to add member to group:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to add you to the group'
        });
      }

    } catch (error) {
      console.error('Error processing request-access request:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Internal server error',
      });
    }
  };
}