import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  // Bot wallet private key (store in Vercel env vars)
  BOT_PRIVATE_KEY: process.env.BOT_PRIVATE_KEY!,
  
  // XMTP environment (production or dev)
  XMTP_ENV: process.env.XMTP_ENV || 'production',
  
  // Webhook security
  webhookSecrets: {
    mandateAdopted: process.env.WEBHOOK_SECRET_MANDATE_ADOPTED!,
    roleSet: process.env.WEBHOOK_SECRET_ROLE_SET!,
  },
  
  // Alchemy API keys per chain
  alchemyApiKeys: {
    arbitrumSepolia: process.env.ALCHEMY_API_KEY_ARBITRUM_SEPOLIA!,
    baseSepolia: process.env.ALCHEMY_API_KEY_BASE_SEPOLIA!,
    optimismSepolia: process.env.ALCHEMY_API_KEY_OPTIMISM_SEPOLIA!,
    sepolia: process.env.ALCHEMY_API_KEY_SEPOLIA!, 
  },
  
  // Optional RPC URLs (fallback to Alchemy)
  rpcUrls: {
    arbitrumSepolia: process.env.RPC_URL_ARBITRUM_SEPOLIA,
    baseSepolia: process.env.RPC_URL_BASE_SEPOLIA,
    optimismSepolia: process.env.RPC_URL_OPTIMISM_SEPOLIA,
    sepolia: process.env.RPC_URL_SEPOLIA, 
  },
};

// Validate required environment variables
const requiredVars = [
  'BOT_PRIVATE_KEY',
  'WEBHOOK_SECRET_MANDATE_ADOPTED',
  'WEBHOOK_SECRET_ROLE_SET',
  'ALCHEMY_API_KEY_ARBITRUM_SEPOLIA',
  'ALCHEMY_API_KEY_BASE_SEPOLIA',
  'ALCHEMY_API_KEY_OPTIMISM_SEPOLIA',
  'ALCHEMY_API_KEY_SEPOLIA', 
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}