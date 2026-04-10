// Express server for webhook handlers
import express, { Request, Response } from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import webhook handlers
import mandateAdoptedHandler from './api/webhooks/mandate-adopted.js';
import roleSetHandler from './api/webhooks/role-set.js';
import createGroupHandler from './api/create-group.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow requests from frontend
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://powers-protocol.vercel.app',
    'powers-git-develop-7cedars-projects.vercel.app', 
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware - preserve raw body for webhook signature verification
app.use(express.json({
  verify: (req: any, res, buf) => {
    // Store raw body for signature verification
    req.rawBody = buf.toString('utf8');
  }
}));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Convert Express req/res to Vercel req/res format
function createVercelRequest(req: any): any {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
    cookies: req.cookies || {},
    rawBody: req.rawBody, // Pass raw body for signature verification
  };
}

function createVercelResponse(res: Response): VercelResponse {
  const vercelRes: any = {
    status: (code: number) => {
      res.status(code);
      return vercelRes;
    },
    json: (data: any) => {
      res.json(data);
      return vercelRes;
    },
    send: (data: any) => {
      res.send(data);
      return vercelRes;
    },
    setHeader: (key: string, value: string) => {
      res.setHeader(key, value);
      return vercelRes;
    },
  };
  return vercelRes as VercelResponse;
}

// API routes
app.post('/api/create-group', async (req: Request, res: Response) => {
  try {
    const vercelReq = createVercelRequest(req);
    const vercelRes = createVercelResponse(res);
    await createGroupHandler(vercelReq, vercelRes);
  } catch (error) {
    console.error('Error in create-group handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Webhook routes
app.post('/api/webhooks/mandate-adopted', async (req: Request, res: Response) => {
  try {
    const vercelReq = createVercelRequest(req);
    const vercelRes = createVercelResponse(res);
    await mandateAdoptedHandler(vercelReq, vercelRes);
  } catch (error) {
    console.error('Error in mandate-adopted handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/webhooks/role-set', async (req: Request, res: Response) => {
  try {
    const vercelReq = createVercelRequest(req);
    const vercelRes = createVercelResponse(res);
    await roleSetHandler(vercelReq, vercelRes);
  } catch (error) {
    console.error('Error in role-set handler:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Powers XMTP Bot server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints:`);
  console.log(`  - POST /api/create-group`);
  console.log(`Webhook endpoints:`);
  console.log(`  - POST /api/webhooks/mandate-adopted`);
  console.log(`  - POST /api/webhooks/role-set`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});