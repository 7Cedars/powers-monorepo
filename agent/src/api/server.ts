// Express server for the XMTP agent API

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import type { Agent } from '@xmtp/agent-sdk';
import { createGroupHandler } from './routes/createGroup.js';
import { config } from '../config/env.js';

/**
 * Creates and configures the Express server
 */
export function createServer(agent: Agent): express.Application {
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
  
  // Create group endpoint
  app.post('/api/create-group', createGroupHandler(agent));
  
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
    console.log(`Create group: http://localhost:${port}/api/create-group`);
  });
}