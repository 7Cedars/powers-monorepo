// Webhook handler for RoleSet events

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Address } from 'viem';
import type { GroupOperation } from '../../lib/types.js';
import { isPowersContract, getAllMandates, getMandatesByRole } from '../../lib/powers/contract.js';
import { getFlowsContainingMandates } from '../../lib/powers/flows.js';
import { getMandateGroupName, getFlowGroupName } from '../../lib/utils/naming.js';
import { tryToSendDM, executeBatchGroupOperations } from '../../lib/xmtp/groups.js';
import { config } from '../../config/env.js';
import {
  verifyAlchemySignature,
  webhookRateLimiter,
  isValidAlchemyPayload,
} from '../../lib/security/webhook-auth.js';

interface AlchemyLog {
  data: string;
  topics: string[];
  index: number;
  account: {
    address: string;
  };
  transaction: {
    hash: string;
    nonce: number;
    index: number;
    from: {
      address: string;
    };
    to: {
      address: string;
    } | null;
    value: string;
    gasPrice: string | null;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
    gas: string;
    status: number;
    gasUsed: string;
    cumulativeGasUsed: string;
    effectiveGasPrice: string;
    createdContract: {
      address: string;
    } | null;
  };
}

interface AlchemyGraphQLWebhook {
  block: {
    hash: string;
    number: string;
    timestamp: string;
    logs: AlchemyLog[];
  };
}

/**
 * Webhook handler for RoleSet events
 * Sends DM notification and adds/removes user from relevant mandate and flow groups
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. VERIFY WEBHOOK SIGNATURE
    const isValidSignature = verifyAlchemySignature(
      req,
      config.webhookSecrets.roleSet
    );
    
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Unauthorized - Invalid signature' });
    }
    
    // 2. VALIDATE PAYLOAD STRUCTURE
    if (!isValidAlchemyPayload(req.body)) {
      console.error('Invalid payload structure');
      return res.status(400).json({ error: 'Bad Request - Invalid payload structure' });
    }
    
    const payload = req.body as AlchemyGraphQLWebhook;
    
    // 3. RATE LIMITING
    // Use block hash as identifier (unique per webhook event)
    const rateLimitKey = `role-set:${payload.block.hash}`;
    if (!webhookRateLimiter.check(rateLimitKey)) {
      console.error('Rate limit exceeded');
      return res.status(429).json({ error: 'Too Many Requests - Rate limit exceeded' });
    }
    
    // Extract chain ID from query parameter or headers
    const chainIdParam = req.query.chainId as string | undefined;
    const chainId = chainIdParam ? parseInt(chainIdParam, 10) : undefined;
    
    if (!chainId) {
      console.error('No chainId provided in webhook');
      return res.status(400).json({ error: 'Missing chainId parameter' });
    }
    
    // Process each log in the block
    const results = [];
    
    for (const log of payload.block.logs) {
      try {
        const powersAddress = log.account.address as Address;
        
        console.log(`RoleSet event received for ${powersAddress} on chain ${chainId}`);
        
        // Verify it's a Powers contract
        const isValid = await isPowersContract(chainId, powersAddress);
        
        if (!isValid) {
          console.log(`Contract ${powersAddress} is not a valid Powers instance`);
          continue; // Skip this log but continue processing others
        }
        
        // Decode event data
        // topics[0] = event signature
        // topics[1] = roleId (indexed)
        // topics[2] = account (indexed)
        // topics[3] = access (indexed)
        const roleId = BigInt(log.topics[1]);
        const account = ('0x' + log.topics[2].slice(26)) as Address; // Remove padding
        const access = log.topics[3] === '0x0000000000000000000000000000000000000000000000000000000000000001';
        
        console.log(`Role ${access ? 'assigned' : 'revoked'} - roleId: ${roleId}, account: ${account}`);
        
        // Try to send DM notification
        const dmMessage = access
          ? `You have been granted role ${roleId} in the Powers contract at ${powersAddress} on chain ${chainId}.`
          : `Your role ${roleId} has been revoked in the Powers contract at ${powersAddress} on chain ${chainId}.`;
        
        const dmSent = await tryToSendDM(account, dmMessage);
        
        if (!dmSent) {
          console.log(`Account ${account} does not have XMTP - skipping group membership updates`);
          results.push({
            powersAddress,
            roleId: roleId.toString(),
            account,
            access,
            dmSent: false,
            groupsUpdated: 0,
          });
          continue;
        }
        
        console.log(`DM sent to ${account}`);
        
        // Get all mandates for this role
        const roleMandates = await getMandatesByRole(chainId, powersAddress, roleId);
        
        if (roleMandates.length === 0) {
          console.log(`No mandates found for role ${roleId}`);
          results.push({
            powersAddress,
            roleId: roleId.toString(),
            account,
            access,
            dmSent: true,
            groupsUpdated: 0,
          });
          continue;
        }
        
        console.log(`Found ${roleMandates.length} mandates for role ${roleId}`);
        
        // Get all mandates for flow identification
        const allMandates = await getAllMandates(chainId, powersAddress);
        
        // Identify flows containing these mandates
        const flows = getFlowsContainingMandates(allMandates, roleMandates);
        
        console.log(`Found ${flows.length} flows containing role mandates`);
        
        // Build list of group operations
        const operations: GroupOperation[] = [];
        
        // Add operations for each mandate group
        for (const mandate of roleMandates) {
          operations.push({
            groupName: getMandateGroupName(chainId, powersAddress, mandate.index),
            account,
            action: access ? 'add' : 'remove',
          });
        }
        
        // Add operations for each flow group
        for (const flow of flows) {
          const flowId = flow[0]; // First mandate in flow
          operations.push({
            groupName: getFlowGroupName(chainId, powersAddress, flowId),
            account,
            action: access ? 'add' : 'remove',
          });
        }
        
        console.log(`Executing ${operations.length} group operations`);
        
        // Execute all operations in batch
        await executeBatchGroupOperations(operations);
        
        results.push({
          powersAddress,
          roleId: roleId.toString(),
          account,
          access,
          dmSent: true,
          groupsUpdated: operations.length,
        });
        
      } catch (error) {
        console.error('Error processing log:', error);
        // Continue with other logs
      }
    }
    
    return res.status(200).json({ 
      success: true,
      processed: results.length,
      results,
    });
    
  } catch (error) {
    console.error('Error processing RoleSet webhook:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}