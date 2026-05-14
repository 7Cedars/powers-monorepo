// Express server for the XMTP agent API
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import type { Agent } from '@xmtp/agent-sdk';
import { config } from '../config/env.js';
import { registerPowers, deregisterPowers } from '../db/registry.js';
import { verifyMessage, isAddress, type Address } from 'viem';
import { getPublicClient } from '../powers/contract.js';
import { powersAbi } from '../powers/abi.js';

export interface WatcherManager {
  addWatcher: (chainId: number, address: Address) => void;
  removeWatcher: (chainId: number, address: Address) => void;
}

/**
 * Creates and configures the Express server
 */
export function createServer(agent: Agent, watcherManager?: WatcherManager): express.Application {
  const app = express();
  
  // Middleware
  app.use(cors({
    origin: config.server.corsOrigin || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  }));
  
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      agent: {
        address: agent.address,
        initialized: true,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Register Powers contract endpoint
  app.post('/api/powers/register', async (req: Request, res: Response): Promise<void> => {
    try {
      const { address, chainId, signerAddress, signature, message } = req.body;

      if (!address || !chainId || !signerAddress || !signature || !message) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }

      if (!isAddress(address) || !isAddress(signerAddress)) {
        res.status(400).json({ error: 'Invalid address format' });
        return;
      }

      // Verify message format to prevent replay attacks
      const expectedMessage = `Register Powers ${address} on chain ${chainId}`;
      if (message !== expectedMessage) {
        res.status(400).json({ error: 'Invalid message format. Expected: ' + expectedMessage });
        return;
      }

      // Verify signature
      const valid = await verifyMessage({
        address: signerAddress as Address,
        message,
        signature
      });

      if (!valid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Verify signer is an admin
      const client = getPublicClient(chainId);
      let since: bigint;
      try {
        since = await client.readContract({
          address: address as Address,
          abi: powersAbi,
          functionName: 'hasRoleSince',
          args: [signerAddress as Address, 0n] // 0n is ADMIN_ROLE
        }) as bigint;
      } catch (err: any) {
        console.error('Error verifying admin role:', err);
        res.status(400).json({ error: 'Failed to query Powers contract. Ensure it is deployed on the correct chain.' });
        return;
      }

      if (since === 0n) {
        res.status(403).json({ error: 'Signer is not an admin of this Powers contract' });
        return;
      }

      // Register the contract
      const added = registerPowers(address as Address, chainId);
      
      if (added && watcherManager) {
        watcherManager.addWatcher(chainId, address as Address);
      }

      res.json({ success: true, message: added ? 'Registered successfully' : 'Already registered' });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Deregister Powers contract endpoint
  app.post('/api/powers/deregister', async (req: Request, res: Response): Promise<void> => {
    try {
      const { address, chainId, signerAddress, signature, message } = req.body;

      if (!address || !chainId || !signerAddress || !signature || !message) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }

      if (!isAddress(address) || !isAddress(signerAddress)) {
        res.status(400).json({ error: 'Invalid address format' });
        return;
      }

      // Verify message format
      const expectedMessage = `Deregister Powers ${address} on chain ${chainId}`;
      if (message !== expectedMessage) {
        res.status(400).json({ error: 'Invalid message format. Expected: ' + expectedMessage });
        return;
      }

      // Verify signature
      const valid = await verifyMessage({
        address: signerAddress as Address,
        message,
        signature
      });

      if (!valid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Verify signer is an admin
      const client = getPublicClient(chainId);
      let since: bigint;
      try {
        since = await client.readContract({
          address: address as Address,
          abi: powersAbi,
          functionName: 'hasRoleSince',
          args: [signerAddress as Address, 0n]
        }) as bigint;
      } catch (err: any) {
        console.error('Error verifying admin role:', err);
        res.status(400).json({ error: 'Failed to query Powers contract.' });
        return;
      }

      if (since === 0n) {
        res.status(403).json({ error: 'Signer is not an admin of this Powers contract' });
        return;
      }

      // Deregister the contract
      const removed = deregisterPowers(address as Address, chainId);
      
      if (removed && watcherManager) {
        watcherManager.removeWatcher(chainId, address as Address);
      }

      res.json({ success: true, message: removed ? 'Deregistered successfully' : 'Not found in registry' });
    } catch (error: any) {
      console.error('Deregistration error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });
  
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });
  
  // Error handler
  app.use((err: Error, req: Request, res: Response, next: any) => {
    console.error('Server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });
  
  return app;
}

/**
 * Starts the Express server
 */
export function startServer(app: express.Application): void {
  const port = config.server.port;
  
  app.listen(port, () => {
    console.log(`Agent API server listening on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}
