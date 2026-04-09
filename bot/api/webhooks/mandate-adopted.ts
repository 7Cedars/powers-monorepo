// Webhook handler for MandateAdopted events

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Address } from 'viem';
import { isPowersContract, getAllMandates } from '../../lib/powers/contract.js';
import { identifyFlows } from '../../lib/powers/flows.js';
import { getMandateGroupName, getFlowGroupName } from '../../lib/utils/naming.js';
import {
  createGroupWithSuperAdminPermissions,
  isBotMemberOfGroup,
  sendMessageToGroup,
} from '../../lib/xmtp/groups.js';

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

interface AlchemyWebhookPayload {
  webhookId: string;
  id: string;
  createdAt: string;
  type: string;
  event: {
    network: string;
    activity: Array<{
      blockNum: string;
      hash: string;
      fromAddress: string;
      toAddress: string;
      value: number;
      asset: string;
      category: string;
      rawContract: {
        rawValue: string;
        address: string;
        decimals: number | null;
      };
      log?: {
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        transactionHash: string;
        transactionIndex: string;
        blockHash: string;
        logIndex: string;
        removed: boolean;
      };
    }>;
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

// Map network names to chain IDs
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  'ETH_SEPOLIA': 11155111,
  'BASE_SEPOLIA': 84532,
  'OPT_SEPOLIA': 11155420,
  'ARB_SEPOLIA': 421614,
};

/**
 * Webhook handler for MandateAdopted events
 * Creates XMTP groups for the mandate and its associated flows
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
    const payload = req.body as AlchemyGraphQLWebhook;
    
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
        
        console.log(`MandateAdopted event received for ${powersAddress} on chain ${chainId}`);
        
        // Verify it's a Powers contract
        const isValid = await isPowersContract(chainId, powersAddress);
        
        if (!isValid) {
          console.log(`Contract ${powersAddress} is not a valid Powers instance`);
          continue; // Skip this log but continue processing others
        }
        
        // Decode the mandateId from topics (first topic is event signature, second is mandateId)
        const mandateId = BigInt(log.topics[1]);
        
        console.log(`Processing mandate adoption: mandate ${mandateId}`);
        
        // Create mandate group name
        const mandateGroupName = getMandateGroupName(chainId, powersAddress, mandateId);
        
        // Check if bot is already a member (group exists)
        const alreadyMember = await isBotMemberOfGroup(mandateGroupName);
        
        if (!alreadyMember) {
          // Create the mandate group
          const mandateGroup = await createGroupWithSuperAdminPermissions(mandateGroupName);
          
          // Send welcome message
          await sendMessageToGroup(
            mandateGroup,
            `Welcome to the coordination group for Mandate ${mandateId}!\n\nThis group is managed by the Powers XMTP Bot. Members with the mandate's role will be automatically added/removed.`
          );
          
          console.log(`Created mandate group: ${mandateGroupName}`);
        } else {
          console.log(`Mandate group already exists: ${mandateGroupName}`);
        }
        
        // Get all mandates to identify flows
        const allMandates = await getAllMandates(chainId, powersAddress);
        
        if (allMandates.length > 0) {
          // Identify flows that contain this mandate
          const flows = identifyFlows(allMandates, mandateId);
          
          // Create groups for each flow
          for (const flow of flows) {
            const flowId = flow[0]; // First mandate in flow (sorted)
            const flowGroupName = getFlowGroupName(chainId, powersAddress, flowId);
            
            const flowExists = await isBotMemberOfGroup(flowGroupName);
            
            if (!flowExists) {
              const flowGroup = await createGroupWithSuperAdminPermissions(flowGroupName);
              
              await sendMessageToGroup(
                flowGroup,
                `Welcome to the coordination group for Flow ${flowId}!\n\nThis flow contains ${flow.length} connected mandates: ${flow.join(', ')}\n\nThis group is managed by the Powers XMTP Bot.`
              );
              
              console.log(`Created flow group: ${flowGroupName}`);
            } else {
              console.log(`Flow group already exists: ${flowGroupName}`);
            }
          }
        }
        
        results.push({
          powersAddress,
          mandateId: mandateId.toString(),
          groupsCreated: !alreadyMember,
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
    console.error('Error processing MandateAdopted webhook:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}