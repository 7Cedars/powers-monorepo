import { config as dotenvConfig } from 'dotenv';
import { isAddress } from 'viem';

// Load environment variables
dotenvConfig();

export const config = {
  // XMTP Agent SDK Configuration
  xmtp: {
    walletKey: process.env.XMTP_WALLET_KEY!,
    dbEncryptionKey: process.env.XMTP_DB_ENCRYPTION_KEY!,
    dbDirectory: process.env.XMTP_DB_DIRECTORY || './data',
    env: process.env.XMTP_ENV || 'production',
  },
  
  // Alchemy RPC URLs for contract watching
  rpcUrls: {
    sepolia: process.env.ALCHEMY_API_KEY_SEPOLIA!,
    // Future expansion
    baseSepolia: process.env.ALCHEMY_API_KEY_BASE_SEPOLIA,
    optimismSepolia: process.env.ALCHEMY_API_KEY_OPTIMISM_SEPOLIA,
    arbitrumSepolia: process.env.ALCHEMY_API_KEY_ARBITRUM_SEPOLIA,
  },
  
  // API Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  
  // API Security
  apiSecretKey: process.env.API_SECRET_KEY,
  
  // Powers Contract Addresses
  powersAddresses: process.env.POWERS_ADDRESSES
    ? process.env.POWERS_ADDRESSES.split(',')
        .map(addr => addr.trim())
        .filter(addr => {
          if (!isAddress(addr)) {
            console.warn(`Invalid Ethereum address in POWERS_ADDRESSES: ${addr}`);
            return false;
          }
          return true;
        })
    : [],
};

// Validate required environment variables
const requiredVars = [
  'XMTP_WALLET_KEY',
  'XMTP_DB_ENCRYPTION_KEY',
  'ALCHEMY_API_KEY_SEPOLIA',
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

// Log configuration (excluding sensitive data)
console.log('Configuration loaded:');
console.log('- XMTP Environment:', config.xmtp.env);
console.log('- XMTP DB Directory:', config.xmtp.dbDirectory);
console.log('- Server Port:', config.server.port);
console.log('- Node Environment:', config.server.nodeEnv);
console.log('- Powers Addresses:', config.powersAddresses.length > 0 ? `${config.powersAddresses.length} address(es) loaded` : 'None configured');
