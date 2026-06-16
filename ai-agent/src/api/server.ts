import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from '../config/env.js';
import { sessionManager } from '../agent/SessionManager.js';
import { isPowersContract } from '../powers/contract.js';
import type { SessionStartInput, OrganisationConfig, SkillDefinition } from '../agent/AgentSession.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_UI_DIR = path.join(__dirname, '..', '..', 'config-ui');

type StartSessionCallback = (sessionId: string) => Promise<void>;
type DestroySessionCallback = (sessionId: string) => void;
type OrgAddedCallback = (sessionId: string, org: OrganisationConfig) => void;

export function createServer(
  onSessionStart: StartSessionCallback,
  onSessionDestroy: DestroySessionCallback,
  onOrgAdded: OrgAddedCallback
): express.Express {
  const app = express();

  const isProd = config.server.nodeEnv === 'production';
  app.use(cors({ origin: isProd ? config.server.corsOrigin : '*' }));
  app.use(express.json());

  // Serve config-ui static files at /
  app.use(express.static(CONFIG_UI_DIR));

  // API auth middleware
  const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!config.apiSecret) return next();
    const header = req.headers.authorization;
    if (header !== `Bearer ${config.apiSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  app.use('/api', authMiddleware);

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      sessions: sessionManager.listSessions().length,
      uptime: process.uptime(),
    });
  });

  // ── POST /api/session/start ─────────────────────────────────────────────────
  app.post('/api/session/start', async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Partial<SessionStartInput>;

      if (!body.walletKey || !/^0x[0-9a-fA-F]{64}$/.test(body.walletKey)) {
        res.status(400).json({ error: 'walletKey must be a 32-byte hex private key' });
        return;
      }
      if (!body.claudeApiKey || !body.claudeApiKey.startsWith('sk-ant-')) {
        res.status(400).json({ error: 'claudeApiKey must start with sk-ant-' });
        return;
      }
      if (!body.organisations || body.organisations.length === 0) {
        res.status(400).json({ error: 'At least one organisation is required' });
        return;
      }

      const ttlMs = body.ttlMs ?? config.session.ttlDefaultMs;
      if (ttlMs < config.session.ttlMinMs || ttlMs > config.session.ttlMaxMs) {
        res.status(400).json({
          error: `ttlMs must be between ${config.session.ttlMinMs} and ${config.session.ttlMaxMs}`,
        });
        return;
      }

      for (const org of body.organisations) {
        if (!org.powersAddress || !org.chainId) {
          res.status(400).json({ error: 'Each organisation requires powersAddress and chainId' });
          return;
        }
        const valid = await isPowersContract(org.chainId, org.powersAddress);
        if (!valid) {
          res.status(400).json({
            error: `${org.powersAddress} on chain ${org.chainId} is not a valid Powers contract`,
          });
          return;
        }
      }

      if (!body.persona) {
        res.status(400).json({ error: 'persona is required' });
        return;
      }

      const input: SessionStartInput = {
        walletKey: body.walletKey,
        claudeApiKey: body.claudeApiKey,
        organisations: body.organisations,
        persona: body.persona,
        skills: body.skills ?? [],
        ttlMs,
      };

      const sessionId = await sessionManager.createSession(input, (session) =>
        onSessionDestroy(session.sessionId)
      );

      onSessionStart(sessionId).catch((err) =>
        console.error(`[api] session start error for ${sessionId}:`, err)
      );

      const session = sessionManager.getSession(sessionId)!;
      const expiresAt = new Date(session.createdAt + session.ttlMs).toISOString();

      res.status(201).json({
        sessionId,
        agentAddress: session.userAddress,
        organisations: session.organisations,
        expiresAt,
      });
    } catch (err) {
      console.error('[api] POST /api/session/start error:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ── DELETE /api/session/:sessionId ─────────────────────────────────────────
  app.delete('/api/session/:sessionId', (req: Request, res: Response): void => {
    const { sessionId } = req.params;
    if (!sessionManager.getSession(sessionId)) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    sessionManager.destroySession(sessionId, (s) => onSessionDestroy(s.sessionId));
    res.status(204).send();
  });

  // ── GET /api/sessions ───────────────────────────────────────────────────────
  app.get('/api/sessions', (_req, res) => {
    res.json(sessionManager.listSessions());
  });

  // ── PATCH /api/session/:sessionId/persona ───────────────────────────────────
  app.patch('/api/session/:sessionId/persona', (req: Request, res: Response): void => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    Object.assign(session.persona, req.body);
    res.json({ ok: true, persona: session.persona });
  });

  // ── POST /api/session/:sessionId/organisations ──────────────────────────────
  app.post(
    '/api/session/:sessionId/organisations',
    async (req: Request, res: Response): Promise<void> => {
      const session = sessionManager.getSession(req.params.sessionId);
      if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

      const org = req.body as OrganisationConfig;
      if (!org.powersAddress || !org.chainId) {
        res.status(400).json({ error: 'powersAddress and chainId required' });
        return;
      }

      const valid = await isPowersContract(org.chainId, org.powersAddress);
      if (!valid) { res.status(400).json({ error: 'Not a valid Powers contract' }); return; }

      const added = sessionManager.addOrganisation(req.params.sessionId, org);
      if (added) onOrgAdded(req.params.sessionId, org);

      res.json({ ok: true, organisations: session.organisations });
    }
  );

  // ── POST /api/session/:sessionId/skills ─────────────────────────────────────
  app.post('/api/session/:sessionId/skills', (req: Request, res: Response): void => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const def = req.body as SkillDefinition;
    if (!def.name || !def.handler) {
      res.status(400).json({ error: 'name and handler are required' });
      return;
    }

    const ALLOWED_HANDLERS = [
      'fetch_url', 'coingecko_price', 'snapshot_proposal', 'github_file', 'chainlink_price',
      'assess_proposal',
    ];
    if (!ALLOWED_HANDLERS.includes(def.handler)) {
      res.status(400).json({ error: `Unknown handler: ${def.handler}. Allowed: ${ALLOWED_HANDLERS.join(', ')}` });
      return;
    }

    // Validate domain allowlist for HTTP handlers
    const httpHandlers = ['fetch_url', 'coingecko_price', 'snapshot_proposal', 'github_file'];
    if (httpHandlers.includes(def.handler)) {
      const domains = def.handlerConfig?.allowedDomains;
      if (!Array.isArray(domains) || domains.length === 0) {
        res.status(400).json({ error: 'allowedDomains array required in handlerConfig for this handler' });
        return;
      }
    }

    session.skills.push({
      definition: def,
      tool: {
        name: def.name,
        description: def.description,
        input_schema: def.inputSchema ?? { type: 'object', properties: {}, required: [] },
      },
    });

    res.json({ skillsCount: session.skills.length });
  });

  // ── GET /api/session/:sessionId/skills ─────────────────────────────────────
  app.get('/api/session/:sessionId/skills', (req: Request, res: Response): void => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json(session.skills.map(s => s.definition));
  });

  // ── DELETE /api/session/:sessionId/skills/:skillName ────────────────────────
  app.delete('/api/session/:sessionId/skills/:skillName', (req: Request, res: Response): void => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const idx = session.skills.findIndex(s => s.definition.name === req.params.skillName);
    if (idx === -1) { res.status(404).json({ error: 'Skill not found' }); return; }

    session.skills.splice(idx, 1);
    res.json({ skillsCount: session.skills.length });
  });

  // ── GET /api/session/:sessionId/fund ────────────────────────────────────────
  app.get('/api/session/:sessionId/fund', async (req: Request, res: Response): Promise<void> => {
    const session = sessionManager.getSession(req.params.sessionId);
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const { getEthBalance } = await import('../powers/contract.js');
    const uniqueChainIds = [...new Set(session.organisations.map(o => o.chainId))];

    const balances = await Promise.all(uniqueChainIds.map(async (chainId) => {
      let balance = '0 ETH';
      try {
        const wei = await getEthBalance(chainId, session.userAddress);
        balance = `${(Number(wei) / 1e18).toFixed(6)} ETH`;
      } catch {}
      return { chainId, balance };
    }));

    res.json({ agentAddress: session.userAddress, balances });
  });

  return app;
}
