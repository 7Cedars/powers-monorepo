# Powers Protocol — Solidity

The core smart contract implementation of the Powers governance protocol. All governance actions (propose → vote → execute) flow through `Powers.sol`; all governance logic lives in external **mandate** contracts.

- [Documentation](https://powers-docs.vercel.app/welcome) · [Full monorepo](../README.md)

---

## How it works

Every action in a Powers organisation must pass through `Powers.sol`. The protocol is intentionally minimal — it handles proposals, voting, and execution, nothing else. Complexity (timelocks, quorums, role conditions, external integrations) lives entirely in mandate contracts.

**Mandates** are role-restricted contracts that:
1. Transform input calldata into `targets[] / values[] / calldatas[]` for execution
2. Define conditions — vote quorum, pass threshold, voting period, parent mandate dependencies, throttle periods

One account, one vote. No token weighting in the core protocol.

For concrete examples of how mandates compose into full governance structures, read [`test/TestConstitutions.sol`](test/TestConstitutions.sol).

---

## Commands

```bash
# Build
forge build

# Test
forge test
forge test --match-test <name> -vvv       # single test
forge test --match-contract <name> -vvv   # all tests in a contract
forge test --gas-report                   # with gas report
make test-fuzz                            # fuzz tests only
make test-fork                            # fork tests (requires SEPOLIA_RPC_URL)

# Deploy
make initialise-anvil                     # deploy all contracts to local Anvil
make deploy-sepolia                       # deploy to Sepolia (requires .env)
make deploy-sepolia-dry                   # simulate without broadcasting

# Sync ABIs to frontend and xmtp-agent
make update-builds
```

Copy `.env.example` to `.env` and fill in your RPC URLs before running network commands.

---

## Directory structure

```
solidity/
├── src/
│   ├── Powers.sol              # Central hub — all governance flows through here
│   ├── Mandate.sol             # Abstract base for synchronous mandates
│   ├── AsyncMandate.sol        # Base for mandates with async external checks
│   ├── mandates/
│   │   ├── electoral/          # Role assignment (self-select, peer-select, delegation, etc.)
│   │   ├── executive/          # External calls (preset, flexible, bespoke, open actions)
│   │   ├── integrations/       # Protocol integrations (Safe, Chainlink, Governor, ZKPassport, ERC721…)
│   │   └── reform/             # Governance self-modification (adopt/revoke/pause mandates)
│   ├── helpers/                # PowersFactory, PowersPaymaster, MandateRegistry, ElectionRegistry…
│   ├── interfaces/             # IMandate, IPowers, and integration interfaces
│   └── libraries/              # Checks.sol, MandateUtilities.sol, PowersUtilities.sol
│
├── governance/
│   ├── examples/               # Standalone deploy scripts showing governance patterns
│   ├── claude/                 # AI-generated organisations (output of /design-org skill)
│   │   ├── secured-slate/
│   │   ├── yield-endowment/
│   │   └── global-environmental-movement/
│   ├── publius/                # Publius team reference organisations
│   └── publius-registry/       # Registry deployment scripts
│
├── test/
│   ├── TestConstitutions.sol   # Reference governance structures — read this first
│   ├── TestSetup.t.sol         # Base test setup; inherit from this in new tests
│   ├── unit/                   # Per-contract unit tests
│   ├── integration/            # Governance flow tests
│   ├── mocks/                  # Mock contracts
│   └── fuzz/                   # Fuzz and invariant tests
│
├── script/                     # Deployment and initialisation scripts
├── audits/                     # Security audit reports
├── lib/                        # Foundry dependencies (OpenZeppelin, forge-std)
├── foundry.toml                # Solidity 0.8.30, optimizer 600 runs, cancun EVM
└── Makefile                    # All common commands
```

---

## Mandate categories

### Electoral — `src/mandates/electoral/`

Assign and revoke governance roles.

| Contract | What it does |
|---|---|
| `SelfSelect` | Caller self-assigns the configured role |
| `PeerSelect` | Role holders vote to select from a nominees list |
| `Nominate` | Accounts nominate or revoke themselves from a nominees contract |
| `DelegateTokenSelect` | Selects role holders by token delegation rank |
| `RoleByRoles` | Assigns a role based on holding prerequisite roles |
| `RevokeInactiveAccounts` | Revokes role from accounts inactive below a threshold |
| `RenounceRole` | Caller voluntarily gives up one of their roles |

### Executive — `src/mandates/executive/`

Execute external calls with varying degrees of flexibility.

| Contract | What it does |
|---|---|
| `PresetActions` | Executes a fixed set of transactions defined at adoption time |
| `OpenAction` | Unconstrained external call — caller specifies targets, values, calldata |
| `BespokeAction_Simple` | Calls a specific function on a configured target; params supplied at call time |
| `BespokeAction_Advanced` | Like Simple but splices dynamic params between static config params |
| `ExternalAction_Simple` | Forwards calldata to a mandate on another Powers contract |
| `ExternalAction_Flexible` | Like Simple but target contract and mandate ID specified at call time |

### Integrations — `src/mandates/integrations/`

Connect Powers governance to external protocols.

| Contract | What it integrates |
|---|---|
| `Safe_ExecTransaction` | Execute transactions through a Safe multisig treasury |
| `SafeAllowance_Transfer` | Transfer tokens from Safe via the allowance module |
| `Governor_CreateProposal` | Create proposals on an OZ Governor contract |
| `ChainlinkFunctions_Open` | Trigger Chainlink Functions for off-chain data checks |
| `ZKPassport_Check` | Require a valid ZKPassport proof to hold a role |
| `ERC721_GatedAccess` | Require minimum NFT balance to join a role |
| `ElectionRegistry_*` | Full election lifecycle (nominate, vote, tally, cleanup) |
| `SlateRegistry_*` | Competitive slate-based voting |

### Reform — `src/mandates/reform/`

Governance self-modification — adopt, revoke, or pause mandates from within governance itself.

---

## Creating a new mandate

1. Inherit from `Mandate.sol` (or `AsyncMandate.sol` for async external checks).
2. Override `handleRequest()` to encode your governance logic.
3. Add unit tests in `test/unit/mandates/` — use existing tests in the same category as a template.
4. Run `make update-builds` to sync the compiled ABI to the frontend and agent.

---

## Using `/design-org` to generate a governance structure

The [`governance-rag/`](../governance-rag/) package provides a Claude Code slash command that generates a complete organisation deployment package from a plain-language conversation. The output lands in `governance/claude/<name>/`. See [`governance-rag/README.md`](../governance-rag/README.md) for setup and usage.

---

## Acknowledgements

Derived from OpenZeppelin's `Governor.sol` and `AccessManager` contracts. Audited by Invcbull Audit Group (August 2025) and Chain Defenders (March 2026) — reports in [`audits/`](audits/).
