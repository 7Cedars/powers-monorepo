import path from 'node:path';
import fs from 'node:fs';
import { Agent, createUser, createSigner } from '@xmtp/agent-sdk';
import { config } from '../config/env.js';
import type { AgentSession } from '../agent/AgentSession.js';

export async function createXmtpClient(session: AgentSession): Promise<Agent> {
  // Each session gets its own DB path so XMTP identities don't collide
  const dbPath = path.join(config.xmtp.dbDirectory, session.sessionId);

  fs.mkdirSync(config.xmtp.dbDirectory, { recursive: true });

  const user = createUser(session.walletKey);
  const signer = createSigner(user);

  const encryptionKey = Buffer.from(
    config.xmtp.dbEncryptionKey.startsWith('0x')
      ? config.xmtp.dbEncryptionKey.slice(2)
      : config.xmtp.dbEncryptionKey,
    'hex'
  );

  const agent = await Agent.create(signer, {
    dbPath,
    dbEncryptionKey: encryptionKey,
    env: config.xmtp.env as 'production' | 'dev' | 'local',
  });

  console.log(
    `[xmtp] client created for session ${session.sessionId} addr=${agent.address}`
  );
  return agent;
}
