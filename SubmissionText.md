# Submission text

## Notes 

* Product specific.    
* No longer than 5 minutes  
* Use example demo reels as inspiration (not sure about this..)   
* Highlight:   
  * Functionality (problem \-\> solution) \- market fit  
  * Innovation   
  * Design choices   
  * Techstack  
  * Security considerations    
* Any prompts to claude between \[ & \]

## Sources 

* .. 

## Project Form

### *Description*

Powers is a modular, role-based governance protocol for on-chain organisations. Rather than routing all power through a single mechanism, Powers lets organisations define discrete roles and assign specific decision-making mandates to each — keeping governance composable, transparent, and safe by design.

The protocol's first proof of concept was built at the Arbitrum hackathon in October–November 2024, then under the name “Separated Powers.” Since then it has grown into a full governance framework with a mandate library, a frontend dApp, and live deployments on Arbitrum Sepolia.

During the Arbitrum Openhouse Buildathon, we integrated AI into Powers in two distinct ways:

- An AI skill that guides users through designing a governance system and outputs a deployment-ready configuration — dramatically lowering the barrier to launching a new governed organisation.
- AI agents that can be assigned governance roles within a Powers organisation, actively participating in deliberation and on-chain action via XMTP messaging.

Both are detailed in the sections below.

Important — to try out the AI agents you need:

- An API secret key. This key, for now, is 84794687436986743963876549867549
- Your own Claude API key.
- A Powers address & chain to interact with. A nice, simple, one: 0xa552ae24A44E0f1F633251905a04f047E9065082 on Arbitrum Sepolia. You can visit the organisation here:  
https://powers-protocol.vercel.app/forum/421614/0xa552ae24A44E0f1F633251905a04f047E9065082

### *Progress During Buildathon*

AI Skill — /design-org

Problem & market fit

Powers scales well as a governance solution because it frontloads decision complexity: once governance is deployed, users only need to consider each individual choice in front of them — not the entire structure of their organisation. The trade-off is that you have to think carefully about roles and decision-making powers before deploying. This raises the cost of getting started and creates a significant hurdle to adoption.

Innovation

AI can meaningfully reduce this barrier — automating the process of designing a governance system and dramatically lowering the cost of deployment. As far as we know, this is the first time an AI has been used to design a governance system for a crypto organisation.

Design choices

We wanted the skill to draw on a rich body of knowledge — academic literature, practitioner frameworks, institutional design theory — without bloating a locally installed tool. The result is a three-part system:

- A single /design-org Claude skill, simple to install locally.
- A Retrieval-Augmented Generation (RAG) pipeline built from a curated corpus of institutional design sources (Elinor Ostrom, Robert Dahl, and others).
- A dedicated governance-rag MCP server that exposes this knowledge base and is accessed by the local skill.

Tech stack

- Claude Code skill — a single markdown file (/design-org), locally installed by the user.
- governance-rag MCP server — a TypeScript/Node.js service exposing one tool: search_governance_sources. Built with the MCP SDK and served over HTTP via Express.
- Embeddings — the corpus (PDFs and markdown summaries) is chunked and embedded locally using nomic-ai/nomic-embed-text-v1.5 via the HuggingFace Transformers ONNX runtime. No external vector database: the index is stored as a JSON file and queried with cosine similarity at runtime.
- Deployed on Railway via Docker.

Security considerations

The MCP needed to be readily accessible without requiring users to retrieve an authorisation code. To keep it safe: access is rate-limited and the MCP's functionality is strictly limited to data retrieval — no write operations. We considered this an acceptable security/usability trade-off.


AI Agents

Problem & market fit

The day-to-day work of governing an organisation is significant. Much of it is repetitive: assessing proposals, reviewing security implications, checking on-chain state. AI can help here — but this is not the first project to try. The real innovation lies in the combination with Powers: these agents are natively guardrailed within their governance roles, and can be conversed with through XMTP group chats. This enables secure, organic integration of AI into live governance systems.

Innovation

These agents go beyond assisting with a single proposal or decision. They can be granted any governance role within a Powers organisation and equipped with any skill that organisation needs. This level of freedom was only possible because Powers natively constrains the power of accounts — and therefore of AI agents too.

Design choices

Each agent is a standalone Claude instance running on a Railway server. At deploy time, it is configured with a whitelist of Powers organisations to watch. It then actively monitors on-chain events and XMTP group messages within those organisations, and decides autonomously whether to engage in deliberation or act on-chain.

Tech stack

- Anthropic Claude API — the reasoning core; uses prompt caching to keep system prompt and governance tools stable across turns.
- XMTP Agent SDK — for receiving and sending messages in governance group chats.
- Viem — for reading on-chain state and watching contract events on Arbitrum Sepolia.
- Express — HTTP API server for session and organisation management.
- Deployed on Railway via Docker; supports multiple concurrent agent sessions.

Security considerations

Agents are fully autonomous — no human approval is required for any action. Two layers of whitelisting keep this safe:

- The agent only watches organisations whitelisted at deploy time.
- Agents must be explicitly admitted to a Powers organisation on-chain — a second whitelist enforced by the protocol itself.

To control token costs, users must deploy agents using their own API keys. External web access within agent skills is strictly controlled via a URL whitelist. An API secret is required to access the agent service.


In addition

ZeroDev account abstraction

As part of the buildathon requirements, we integrated ZeroDev into our Account Abstraction stack. This allows users to interact with Powers organisations without needing to manage gas directly, lowering the barrier to participation.

Return to Arbitrum

We returned to Arbitrum Sepolia for all example organisation deployments, having previously shifted to Ethereum Sepolia. It has been a smooth experience and a good fit for the protocol.

Frontend overhaul

Shortly before the buildathon we ran a user simulation, which surfaced the frontend as a high-priority issue. We took the opportunity to completely refactor the UI, improving clarity and usability across the board.


Final note

Everything built during the buildathon is included in the publius-projects/powers-monorepo. After the buildathon, /ai-agent, /governance-rag, and /xmtp-agent will be moved to a dedicated publius-projects/powers-utils repository.

### *Fundraising Status*

No funds have been raised to date. Development has been focused on building Powers against real-world governance use cases.

We are in the process of incorporating Publius Projects as a Community Interest Company (CIC) under UK law, and will be looking for parties interested in supporting the project. A CIC can have shareholders, but the Powers protocol is not designed to maximise revenue — it is built for long-term social and political impact, and that shapes every decision we make.

## Submission Form

### *Link to frontend/UI/website of your project*

Protocol: [https://powers-protocol.vercel.app](https://powers-protocol.vercel.app)  
Documentation: [https://powers-docs.vercel.app](https://powers-docs.vercel.app)    
Agents: [https://profound-illumination-production-d535.up.railway.app](https://profound-illumination-production-d535.up.railway.app/)  
Governance-rag MCP:  [https://selfless-optimism-production-b92b.up.railway.app/mcp](https://selfless-optimism-production-b92b.up.railway.app/mcp)           

### *List your Core Protocol/ Smart Contract Addresses*

All contracts are deployed on Arbitrum Sepolia.   
Powers mandate registry: 0x67fE8057b7d9c3F8222dD25bC22F5ABFF2906cB7 (Arbitrum Sepolia)
Some example implementations can be found at:  
- Powers 101: 0x8cF9eA1E6ba7B90EF84c3E8B6BEBd5fD98Bc9acC (Arbitrum Sepolia) 
- Project Orange: 0xa552ae24A44E0f1F633251905a04f047E9065082 (Arbitrum Sepolia)
- Cultural Stewardship, Primary Layer: 0xaA11CC720F9a86393E45D338Ff57422827f9E9B4 (Mainnet Sepolia)

### *List your Factory/Pool Contracts (if applicable)*

N/A 

### *List your Token Contract Address (if applicable)*

N/A 

### *Which parts of your code have been produced during the Buildathon?*

/ai-agent  
/governance-rag  
Also:   
Integration zeroDev into Account Abstraction stack   
As an extra we completely overhauled the UI.  


