# Powers XMTP Bot

An automated bot that listens to Powers Protocol smart contract events and manages XMTP group chats for governance coordination.

## Overview

This bot performs the following functions:

### MandateAdopted Event Handler
1. Listens for `MandateAdopted` events from Powers contracts
2. Verifies the contract is a valid Powers instance
3. Creates XMTP group chats for:
   - Individual mandates (`Mandate-{chainId}-{powersAddress}-{mandateId}`)
   - Governance flows (`Flow-{chainId}-{powersAddress}-{flowId}`)
4. Sets bot as super admin with exclusive member management permissions
5. Sends initial messages to groups

### RoleSet Event Handler
1. Listens for `RoleSet` events from Powers contracts
2. Attempts to send DM notification to affected account
3. If account has XMTP:
   - Queries Powers contract for mandates with the assigned/revoked role
   - Identifies flows containing those mandates
   - Adds/removes account from relevant mandate and flow groups (batched for efficiency)

## Architecture

```
bot/
├── api/
│   └── webhooks/          # Vercel API routes for Alchemy webhooks
├── lib/
│   ├── xmtp/             # XMTP client and group management
│   ├── powers/           # Powers contract queries and verification
│   ├── utils/            # Utility functions (naming, batch operations)
│   └── types.ts          # TypeScript type definitions
└── config/
    └── env.ts            # Environment configuration
```

## Setup

### 1. Install Dependencies

```bash
cd bot
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:
- `BOT_PRIVATE_KEY`: Private key for the bot's Ethereum wallet (needs XMTP registration)
- `XMTP_ENV`: XMTP environment (`production` or `dev`)
- `ALCHEMY_API_KEY_*`: Alchemy API keys for each supported chain

### 3. Initialize Bot Wallet with XMTP

Before deploying, the bot wallet must be registered with XMTP:

```typescript
// Run once to initialize
import { Client } from '@xmtp/node-sdk';
import { config } from './config/env.js';

const signer = /* create signer from BOT_PRIVATE_KEY */;
const client = await Client.create(signer);
console.log('Bot initialized with inbox:', client.inboxId);
```

### 4. Deploy to Vercel

```bash
# From the bot directory
vercel

# Set environment variables in Vercel dashboard
# Then deploy to production
vercel --prod
```

### 5. Configure Alchemy Webhooks

Create two webhooks in the Alchemy dashboard for each chain:

**Webhook 1: MandateAdopted**
- Event: `MandateAdopted(uint16)`
- Event Signature: `0x284812f41d73696d76ff026c35ebc1a8e8bf24544551c55dd0877334dca88a56` 
- Webhook URL: `https://your-app.vercel.app/api/webhooks/mandate-adopted?chainId={CHAIN_ID}`
- Example: `https://your-app.vercel.app/api/webhooks/mandate-adopted?chainId=11155111` (for Sepolia)

**Webhook 2: RoleSet**
- Event: `RoleSet(uint256,address,bool)`
- Event Signature: `0x294507a8f5830b538faef39fbdd28f1164f27c8338a32fc7b47ddf82e4c8d9e4`
- Webhook URL: `https://your-app.vercel.app/api/webhooks/role-set?chainId={CHAIN_ID}`
- Example: `https://your-app.vercel.app/api/webhooks/role-set?chainId=84532` (for Base Sepolia)

**Note:** Replace `{CHAIN_ID}` with the actual chain ID for each network:
- Sepolia: `11155111`
- Base Sepolia: `84532`
- Optimism Sepolia: `11155420`
- Arbitrum Sepolia: `421614`

## Development

### Run Locally

```bash
pnpm dev
```

### Type Checking

```bash
pnpm type-check
```

### Testing

```bash
pnpm test
```

## Key Features

### Group Permissions

All groups are created with super admin-only permissions:
- `addMemberPolicy`: superAdmin
- `removeMemberPolicy`: superAdmin
- `addAdminPolicy`: superAdmin
- `removeAdminPolicy`: superAdmin
- `updateGroupNamePolicy`: superAdmin
- `updateGroupDescriptionPolicy`: superAdmin

This ensures only the bot can manage membership.

### Flow Detection

The bot replicates the frontend's flow identification logic to detect connected mandates through their `needFulfilled` and `needNotFulfilled` dependencies.

### Batch Operations

When processing `RoleSet` events, the bot batches all add/remove operations for efficiency, grouping by group name to minimize API calls.

### Error Handling

- If a user doesn't have XMTP, they're skipped for membership management
- If a group doesn't exist during role revocation, the operation is skipped
- Failed DM sends don't block membership management
- All errors are logged for debugging

## Naming Conventions

Group names follow the pattern used in the frontend:

- Mandates: `Mandate-{chainId}-{powersAddress}-{mandateId}`
- Flows: `Flow-{chainId}-{powersAddress}-{flowId}`

Where `flowId` is the ID of the first mandate in the flow (sorted numerically).

## Security Considerations

1. **Bot Wallet Security**: The bot's private key has full control over all group memberships. Store securely in Vercel environment variables.

2. **Powers Contract Verification**: The bot verifies contracts are genuine Powers instances by calling `version()` before creating groups.

3. **XMTP Inbox Resolution**: Converting Ethereum addresses to XMTP inbox IDs requires creating a DM first, which the bot does automatically.

## Troubleshooting

### "Cannot find inbox ID"
- Ensure the target address has initialized XMTP
- Check that the bot wallet is properly initialized

### "Group already exists"
- The bot checks if it's already a member before creating groups
- Multiple mandate adoptions won't create duplicate groups

### "Failed to add member"
- Verify the target address has XMTP initialized
- Check bot wallet permissions in the group

## Future Enhancements

Potential improvements:
- Support for custom permission policies per organization
- Integration with on-chain governance events (proposals, votes)
- Analytics dashboard for group activity
- Automatic role assignment based on token holdings
- Multi-chain aggregation and cross-chain coordination

## License

MIT