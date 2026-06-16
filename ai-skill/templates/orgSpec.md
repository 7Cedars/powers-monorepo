---
title: "[Organisation Name] — Governance Specification"
description: "Governance design specification for [Organisation Name]"
---

# [Organisation Name] — Governance Specification

> **Status:** Draft / Approved  
> **Network:** [Sepolia / Arb Sepolia / Opt Sepolia / Mainnet]  
> **Design date:** [YYYY-MM-DD]

---

## Purpose

[Two to three sentences describing what this organisation does and why it needs on-chain governance. What resources or decisions does it manage? What is the intended outcome of this governance structure?]

---

## Roles

| Role ID | Name | Description | How to join | Max members |
|---------|------|-------------|-------------|-------------|
| 0 | Admin | [Description — founding administrator, highest trust] | Assigned at deployment | 1 |
| max | Public | [Everyone; no application needed] | Automatic | Unlimited |
| 1 | [Name] | [Description] | [SelfSelect / Election / Nomination] | [Number or Unlimited] |
| 2 | [Name] | [Description] | [SelfSelect / Election / Nomination] | [Number or Unlimited] |

> Add or remove rows as needed. Role IDs must be unique positive integers (0 and type(uint256).max are reserved).

---

## Governance Flows

### Flow 1: [Flow Name]

**Purpose:** [What decision or process does this flow govern?]

**Steps:**

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | StatementOfIntent | Role [X] | Yes — [quorum]% quorum, [succeedAt]% threshold, [period] days | — |
| 2 | StatementOfIntent (veto) | Role [Y] (e.g., Admin) | No | Must come after step 1 |
| 3 | BespokeAction_Simple | Role [Z] | No | Must have step 1; must NOT have step 2; [timelock] day wait |

**Rationale:** [Why is this the right structure for this decision? Who should have voice? Why this quorum? Why this timelock?]

---

### Flow 2: [Flow Name]

**Purpose:** [What decision or process does this flow govern?]

**Steps:**

| Step | Mandate type | Who can call | Voting? | Conditions |
|------|-------------|--------------|---------|------------|
| 1 | [Mandate] | [Role] | [Yes/No] | — |
| 2 | [Mandate] | [Role] | [Yes/No] | [Dependencies] |

**Rationale:** [...]

---

> Add a section for each governance flow. Common flows to consider:
> - Membership (joining and leaving roles)
> - Resource allocation or treasury spending
> - Parameter changes (fees, limits, settings)
> - Governance reform (adding or removing mandates)
> - Emergency actions

---

## Checks and Balances

| Mechanism | How it works | Who holds it |
|-----------|-------------|--------------|
| Veto on [X] | Admin can block within [N] days of proposal | Admin (role 0) |
| Timelock on treasury | [N]-day wait before execution | Automatic |
| Quorum requirement | At least [N]% of [role] must vote | [Role] |
| Role cap | Maximum [N] holders of [role] | Automatic |

**Security considerations:**
- [Any known risks or limitations in this design]
- [What the design cannot protect against]

---

## External Dependencies

| System | Purpose | Required? |
|--------|---------|----------|
| [Gnosis Safe] | [Treasury management] | [Yes/No] |
| [ERC-20 token] | [Delegate selection] | [Yes/No] |
| [Nominees contract] | [Candidate registry for elections] | [Yes/No] |
| [ElectionRegistry] | [Formal election management] | [Yes/No] |

---

## Design Rationale

[Explain the overall philosophy behind this governance structure. Why were these specific patterns chosen? Reference governance theory where relevant. Note any significant trade-offs made (e.g., speed vs. legitimacy, simplicity vs. expressiveness).]

---

## Limitations

[List anything this governance structure cannot currently do, and why. If a requirement could not be met with existing mandates, explain what alternative approach was taken.]

---

## Implementation Notes

> This section is for the developer implementing the deploy script.

- **Deploy script:** `solidity/governance/examples/[OrgName].s.sol`
- **Actions script:** `solidity/governance/examples/actions/[OrgName]Actions.s.sol`
- **Runners script:** `solidity/governance/examples/actions/[OrgName]Runners.s.sol`
- **Test file:** `solidity/test/governance/[OrgName].t.sol`
- **Mandate version:** MAJOR=0, MINOR=1, PATCH=8
- **Mandate nameDescription strings must match exactly across all four files.**
