# Powers XMTP Agent

A persistent XMTP agent that manages governance group chats for the Powers Protocol. Built with the XMTP Agent SDK v2.3.0.

## Features

- **Event-Driven Architecture**: Watches RoleSet events on-chain using viem
- **Automatic Group Management**: Creates and manages XMTP group chats for mandates, flows, and actions
- **Persistent Database**: Uses Railway database to store agent state and avoid hitting 10x initialization limit
- **Super-Admin Control**: Agent has exclusive admin rights for managing group memberships
- **Active Group Checking**: Only updates groups that are still active on-chain
- **RESTful API**: HTTP endpoints for manual group creation

## Architecture

```
agent/
├── src/
│   ├── agent.ts              # XMTP agent initialization
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── env.ts            # Environment configuration
│   ├── watchers/
│   │   └── roleSet.ts  # Viem event watcher
│   ├── handlers/
│   │   └── roleChange.ts     # Event handler logic
│   ├── groups/
│   │   └── management.ts     # Group creation and member management
│   ├── powers/
│   │   ├── abi.ts            # Powers contract ABI
│   │   ├── contract.ts       # Contract interaction utilities
│   │   ├── flows.ts          # Flow identification logic
│   │   └── members.ts        # Member fetching functions
│   ├── utils/
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── naming.ts         # Group naming utilities
│   └── api/
│       ├── server.ts         # Express server setup
│       └── routes/
│           └── createGroup.ts # Group creation API endpoint
└── package.json
```

## Environment Variables

Required:
- `XMTP_WALLET_KEY`: Private key for the agent's Ethereum wallet
- `XMTP_DB_ENCRYPTION_KEY`: Encryption key for the XMTP database
- `ALCHEMY_API_KEY_SEPOLIA`: Alchemy API key for Sepolia network

Optional:
- `XMTP_DB_DIRECTORY`: Database directory path (default: `./data`)
- `XMTP_ENV`: XMTP environment (`production` or `dev`, default: `production`)
- `PORT`: API server port (default: `3001`)
- `CORS_ORIGIN`: CORS origin for API (default: `*`)
- `NODE_ENV`: Node environment (default: `development`)

## Development

### Installation

```bash
pnpm install
```

### Running Locally

```bash
# Development mode (with auto-reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

### Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your environment variables in `.env`

3. Update `CONTRACTS_TO_WATCH` in `src/index.ts` with the Powers contracts you want to monitor

## API Endpoints

### Health Check
```http
GET /health
```

Returns agent status and address.

### Create Group
```http
POST /api/create-group
Content-Type: application/json

{
  "chatroomType": "Mandate" | "Flow" | "Action" | "Vote" | "General",
  "chainId": "11155111",
  "powersAddress": "0x...",
  "contextId": "123",
  "requesterAddress": "0x...",
  "signature": "0x...",
  "timestamp": 1234567890000
}
```

Creates a new XMTP group chat with appropriate members based on the chatroom type.

## Group Naming Convention

Groups are named using the format: `{Type}-{chainId}-{powersAddress}-{contextId}[-{timestamp}]`

Examples:
- `Mandate-11155111-0x1234...-5`
- `Flow-11155111-0x1234...-2`
- `Action-11155111-0x1234...-8`

## Active Group Checking

Before updating group memberships, the agent checks if the associated mandate/flow/action is still active:

- **Flow Groups**: Checks if the first mandate ID in the flow name is active
- **Mandate Groups**: Checks if that specific mandate is active
- **Action Groups**: Checks if that specific action is active

This prevents the agent from managing groups for inactive governance processes.

## Railway Deployment

The agent is designed to run on Railway with a persistent database volume:

1. Create a new Railway project
2. Add environment variables from `.env.example`
3. Deploy the project
4. Railway will automatically provision a persistent volume for the XMTP database

## Security

- All API requests require signature verification
- Rate limiting prevents abuse
- CORS configured to allow only specified origins
- Database encryption enabled by default

## License

See main repository LICENSE file.