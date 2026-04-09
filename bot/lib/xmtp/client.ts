// XMTP Client initialization and management

import { Client, type Signer, IdentifierKind } from '@xmtp/node-sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../../config/env.js';

let cachedClient: Client | null = null;

/**
 * Creates an XMTP signer from the bot's private key
 */
function createXMTPSigner(): Signer {
  const account = privateKeyToAccount(config.BOT_PRIVATE_KEY as `0x${string}`);
  
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: account.address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      // Create a wallet client for signing
      const walletClient = createWalletClient({
        account,
        transport: http(),
      });
      
      const signature = await walletClient.signMessage({
        message,
        account,
      });
      
      // Convert hex signature to Uint8Array
      return new Uint8Array(
        signature.slice(2).match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
    },
  };
}

/**
 * Gets or creates the XMTP client for the bot
 * @returns The XMTP client instance
 */
export async function getXMTPClient(): Promise<Client> {
  if (cachedClient) {
    return cachedClient;
  }

  console.log('Initializing XMTP client for bot...');
  
  const signer = createXMTPSigner();
  
  const client = await Client.create(signer);

  cachedClient = client;
  
  console.log('XMTP client initialized. Bot inbox ID:', client.inboxId);
  
  return client;
}

/**
 * Resets the cached client (useful for testing)
 */
export function resetXMTPClient(): void {
  cachedClient = null;
}