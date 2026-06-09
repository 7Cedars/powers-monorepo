import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  xmtp: {
    walletKey: process.env.XMTP_WALLET_KEY!,
    dbEncryptionKey: process.env.XMTP_DB_ENCRYPTION_KEY!,
    dbDirectory: process.env.XMTP_DB_DIRECTORY || './data',
    env: process.env.XMTP_ENV || 'production',
  },

  rpcUrls: {
    sepolia: process.env.RPC_SEPOLIA!,
    baseSepolia: process.env.RPC_BASE_SEPOLIA,
    optimismSepolia: process.env.RPC_OPTIMISM_SEPOLIA,
    arbitrumSepolia: process.env.RPC_ARBITRUM_SEPOLIA,
  },

  server: {
    port: parseInt(process.env.PORT || '3002', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CONFIG_UI_ORIGIN || 'http://localhost:4000',
  },

  apiSecret: process.env.AGENT_API_SECRET,

  session: {
    ttlDefaultMs: parseInt(process.env.SESSION_TTL_DEFAULT_MS || '28800000', 10),
    ttlMinMs: parseInt(process.env.SESSION_TTL_MIN_MS || '1800000', 10),
    ttlMaxMs: parseInt(process.env.SESSION_TTL_MAX_MS || '604800000', 10),
  },

  ai: {
    maxToolRounds: parseInt(process.env.MAX_TOOL_ROUNDS || '8', 10),
    maxHistoryTurns: parseInt(process.env.MAX_HISTORY_TURNS || '20', 10),
    chatRateLimitMs: parseInt(process.env.CHAT_RATE_LIMIT_MS || '3000', 10),
    thinkingBudget: parseInt(process.env.THINKING_BUDGET_TOKENS || '5000', 10),
  },
};

const required = ['XMTP_WALLET_KEY', 'XMTP_DB_ENCRYPTION_KEY', 'RPC_SEPOLIA'];
for (const v of required) {
  if (!process.env[v]) {
    throw new Error(`Missing required environment variable: ${v}`);
  }
}

console.log('Configuration loaded:');
console.log('- XMTP environment:', config.xmtp.env);
console.log('- XMTP DB directory:', config.xmtp.dbDirectory);
console.log('- Server port:', config.server.port);
console.log('- Node environment:', config.server.nodeEnv);
