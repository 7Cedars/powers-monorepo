# Agent Tools

This document is the reference for the tools available to the AI governance agent during reasoning. For an overview of the agent itself, see [`ai-agent/README.md`](../../README.md). For the `/design-org` skill that generates organisations, see [`governance-rag/README.md`](../../../../governance-rag/README.md).

The agent has two categories of tools it can call during reasoning:

- **Governance tools** (`governanceTools.ts`) — built-in, always available. Read on-chain state, propose actions, cast votes, execute passed proposals, send XMTP messages.
- **Skills** (`skillTools.ts`) — user-defined, added per session. Fetch external data the agent needs to make informed decisions.

---

## Governance tools

| Tool | What it does |
|---|---|
| `get_governance_state` | Fetches live on-chain state for the active organisation |
| `send_message` | Sends a message to the XMTP governance group chat |
| `fund_check` | Checks the agent's ETH balance across all organisations |
| `propose_action` | Submits a new governance proposal on a mandate |
| `cast_vote` | Casts a vote (For / Against / Abstain) with on-chain reasoning |
| `execute_action` | Executes a passed proposal once the timelock has cleared |

These are fixed and require no configuration.

---

## Skills

Skills extend the agent with external data sources. Each skill is a named tool Claude can call, backed by a sandboxed handler that only contacts pre-approved domains.

### Architecture

```
SessionStartInput.skills[]          ← SkillDefinition objects supplied at session start
       │
       ▼
AgentSession.skills[]               ← Resolved into ResolvedSkill[] (definition + tool shape)
       │
       ▼
reason.ts                           ← Injected into Claude's tool list alongside governance tools
       │
       ▼
governanceTools.ts handleToolCall() ← Unknown tool name falls through to dispatchSkill()
       │
       ▼
skillTools.ts dispatchSkill()       ← Routes to the correct handler by skill.definition.handler
       │
       ▼
handlers/*.ts                       ← Executes the fetch; returns a string to Claude
```

The key fields of a `SkillDefinition`:

```typescript
{
  name: string;                          // snake_case, used as the tool name Claude calls
  description: string;                   // Tells Claude when and how to use this tool
  inputSchema: Record<string, unknown>;  // JSON Schema — Claude uses this to structure its call
  handler: string;                       // Which handler to dispatch to (see below)
  handlerConfig: Record<string, unknown>;// Static config passed to the handler (API keys, criteria, etc.)
}
```

`allowedDomains` is always read from `handlerConfig.allowedDomains` and enforced before any network request.

---

## Available handlers

### `fetch_url`

Generic HTTP GET. Returns the response body (truncated to 50 KB).

| Config key | Required | Description |
|---|---|---|
| `allowedDomains` | yes | Array of hostnames the skill may contact |

| Input key | Required | Description |
|---|---|---|
| `url` | yes | Full URL to fetch |

```json
{
  "name": "fetch_governance_doc",
  "description": "Fetch a document from the governance forum.",
  "handler": "fetch_url",
  "handlerConfig": { "allowedDomains": ["forum.example.org"] },
  "inputSchema": {
    "type": "object",
    "properties": { "url": { "type": "string" } },
    "required": ["url"]
  }
}
```

---

### `coingecko_price`

Fetches token prices from the CoinGecko public API.

| Input key | Required | Description |
|---|---|---|
| `coinIds` | yes | Array of CoinGecko coin IDs, e.g. `["ethereum", "bitcoin"]` |
| `vsCurrencies` | no | Array of quote currencies, default `["usd"]` |

```json
{
  "name": "get_token_price",
  "description": "Fetch the current ETH price in USD from CoinGecko.",
  "handler": "coingecko_price",
  "handlerConfig": { "allowedDomains": [] },
  "inputSchema": {
    "type": "object",
    "properties": {
      "coinIds": { "type": "array", "items": { "type": "string" } },
      "vsCurrencies": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["coinIds"]
  }
}
```

---

### `snapshot_proposal`

Fetches a Snapshot governance proposal by ID.

| Input key | Required | Description |
|---|---|---|
| `proposalId` | yes | Snapshot proposal ID (hex string) |

```json
{
  "name": "get_snapshot_proposal",
  "description": "Fetch details of a Snapshot governance proposal.",
  "handler": "snapshot_proposal",
  "handlerConfig": { "allowedDomains": [] },
  "inputSchema": {
    "type": "object",
    "properties": { "proposalId": { "type": "string" } },
    "required": ["proposalId"]
  }
}
```

---

### `github_file`

Fetches the raw content of a file from a GitHub repository.

| Config key | Description |
|---|---|
| `owner` | Default repo owner (overridable per call) |
| `repo` | Default repo name (overridable per call) |
| `ref` | Default branch/tag, defaults to `main` |

| Input key | Required | Description |
|---|---|---|
| `filePath` | yes | Path within the repo, e.g. `docs/spec.md` |
| `owner` | no | Overrides config owner |
| `repo` | no | Overrides config repo |
| `ref` | no | Overrides config ref |

```json
{
  "name": "read_constitution",
  "description": "Read the DAO constitution from GitHub.",
  "handler": "github_file",
  "handlerConfig": {
    "owner": "my-dao",
    "repo": "governance",
    "ref": "main",
    "allowedDomains": []
  },
  "inputSchema": {
    "type": "object",
    "properties": { "filePath": { "type": "string" } },
    "required": ["filePath"]
  }
}
```

---

### `chainlink_price`

Reads a price from a Chainlink AggregatorV3 feed on-chain.

| Config key | Description |
|---|---|
| `feedAddress` | Default feed contract address (overridable per call) |
| `chainId` | Default chain ID, defaults to Sepolia (11155111) |

| Input key | Required | Description |
|---|---|---|
| `feedAddress` | no | Overrides config feed address |
| `chainId` | no | Overrides config chain ID |

```json
{
  "name": "eth_usd_chainlink",
  "description": "Read the ETH/USD price from Chainlink on Sepolia.",
  "handler": "chainlink_price",
  "handlerConfig": {
    "feedAddress": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    "chainId": 11155111,
    "allowedDomains": []
  },
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

---

### `assess_proposal`

Fetches a governance proposal document (Markdown) from a URL and returns it together with a pre-configured assessment rubric. Claude then scores the proposal against the criteria and produces a recommendation.

The criteria are stored in `handlerConfig.criteria` — this keeps them out of the `description` field (which has a character limit) and bakes them permanently into the skill at session creation time.

| Config key | Required | Description |
|---|---|---|
| `criteria` | yes | The assessment rubric Claude will apply |
| `allowedDomains` | yes | Hostnames the proposal URL may belong to |

| Input key | Required | Description |
|---|---|---|
| `proposal_url` | yes | Publicly accessible URL of the `.md` proposal file |

#### Example skill 1 — Impact assessment

Evaluate whether a proposal will have meaningful real-world impact.

```json
{
  "name": "assess_proposal_impact",
  "description": "Fetch a governance proposal document (Markdown) from the given URL and assess it against impact criteria. Call this tool whenever you need to evaluate whether a proposal is worth supporting based on its real-world impact. Produce a structured assessment with a score (1–5) per criterion and an overall recommendation.",
  "handler": "assess_proposal",
  "handlerConfig": {
    "allowedDomains": ["raw.githubusercontent.com", "hackmd.io", "gist.github.com"],
    "criteria": "Score each criterion 1 (Poor) → 5 (Excellent) with a one-sentence justification.\n\n1. Problem Clarity\n   Is the problem well-defined, specific, and supported by evidence?\n\n2. Theory of Change\n   Is the causal logic from action to outcome sound and realistic?\n\n3. Measurability\n   Are success metrics concrete, trackable, and time-bound?\n\n4. Scale & Reach\n   How many people, systems, or resources are positively affected?\n\n5. Risk & Failure Modes\n   Are key risks identified, and is there a credible mitigation plan?\n\nAfter scoring, give an overall recommendation: Approve / Approve with conditions / Reject, with a one-paragraph rationale."
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "proposal_url": { "type": "string", "description": "Publicly accessible URL of the proposal Markdown file." }
    },
    "required": ["proposal_url"]
  } 
}
```

#### Example skill 2 — Financial viability assessment

Evaluate whether a proposal represents a sound use of DAO treasury funds.

```json
{
  "name": "assess_proposal_financial",
  "description": "Fetch a governance proposal document (Markdown) from the given URL and assess it against financial viability criteria. Call this tool whenever you need to evaluate whether a proposal represents a sound use of DAO treasury funds. Produce a structured assessment with a score (1–5) per criterion and an overall recommendation.",
  "handler": "assess_proposal",
  "handlerConfig": {
    "allowedDomains": ["raw.githubusercontent.com", "hackmd.io", "gist.github.com"],
    "criteria": "Score each criterion 1 (Poor) → 5 (Excellent) with a one-sentence justification.\n\n1. Budget Clarity\n   Are all costs itemised, justified, and proportionate to the stated scope?\n\n2. Sustainability\n   Is there a credible path to financial self-sufficiency, recurring value, or a clean exit?\n\n3. Value for Money\n   Is the expected outcome proportional to the funding requested?\n\n4. Treasury Risk\n   Does the ask represent a manageable share of available DAO reserves?\n\n5. Accountability\n   Are milestones, deliverables, and reporting commitments clearly defined and enforceable?\n\nAfter scoring, give an overall recommendation: Approve / Approve with conditions / Reject, with a one-paragraph rationale."
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "proposal_url": { "type": "string", "description": "Publicly accessible URL of the proposal Markdown file." }
    },
    "required": ["proposal_url"]
  }
}
```

---

## Adding a skill

### Via the config UI

Open the agent's config UI, navigate to a running session, and use the **Add Skill** card:

| Field | Value |
|---|---|
| Name | `snake_case` identifier |
| Description | What Claude should understand about when and how to use this tool |
| Handler | Select from the dropdown |
| Allowed Domains | Comma-separated list of hostnames |
| Handler Config (JSON) | Any additional static config for the handler (e.g. `criteria`, `owner`, `feedAddress`) |

Note: the config UI sends an empty `inputSchema`. Claude will still infer the correct input fields from the description, but for full type safety use the API directly.

### Via the API

```bash
curl -X POST https://<agent-host>/api/session/<sessionId>/skills \
  -H 'Content-Type: application/json' \
  -d '<skill definition JSON>'
```

The typed example definitions in `exampleSkills.ts` can also be imported directly when creating a session programmatically via `SessionStartInput.skills`.

---

## Adding a new handler

1. Create `src/ai/tools/handlers/<yourHandler>.ts` and export an async function that returns a `string`.
2. Import it in `skillTools.ts` and add a `case` to `dispatchSkill()`.
3. Add the handler name as an `<option>` in the config UI dropdown (`config-ui/app.js`).
