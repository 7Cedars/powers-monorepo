# Powers Protocol - Agents Guide

Welcome, Agent. This document serves as your primary context and guide for working within the Powers monorepo. It outlines the project's purpose, architecture, and common workflows you will be expected to perform.

## 1. Project Overview

**Powers v0.4** is a governance protocol for on-chain organizations. It distinguishes itself by:
-   **Role-Based Governance**: Restricting governance processes along access roles.
-   **Separation of Powers**: Enabling checks and balances (e.g., one role proposes, another vetos, another executes).
-   **Modular Design**: Using small, single-purpose smart contracts called **Mandates**.
-   **Non-Weighted Voting**: Core protocol uses one-account-one-vote, though complexity (staking, etc.) can be added via mandates.

## 2. Architecture & Monorepo Structure

The repository is organized as a monorepo with the following key directories:

### `solidity/` (Foundry)
Contains the core protocol and smart contracts.
-   **Core Contracts**:
    -   `src/Powers.sol`: The central hub. All actions run through here.
    -   `src/Mandate.sol`: The base contract for all mandates.
-   **Mandates** (`src/mandates/`): Modular contracts defining specific powers (e.g., `Electoral`, `Executive`).
-   **Deploy Scripts** (`script/`): Scripts to deploy the protocol and specific organizations.
-   **Tests** (`test/`): Comprehensive tests using Foundry.

### `frontend/` (Next.js)
The user interface for interacting with the protocol.
-   **Tech Stack**: Next.js 14, React 18, Tailwind CSS, Wagmi/Viem.
-   **Key Locations**:
    -   `context/constants.ts`: Stores deployment addresses and ABI references.
    -   `organisations/orgMetadatas/`: JSON metadata for different organization types.

### `documentation/` (Vocs)
Project documentation website.
-   **Content**: Developer guides, mandate specifications, and organization examples.


## 3. Core Concepts

### Mandates
Mandates are the building blocks of governance. They transform input data into executable calls.
-   **Functionality**:
    -   Role restriction.
    -   Conditional execution (e.g., requiring a vote, a parent mandate, or a delay).
-   **Development**: When creating a new mandate, inherit from `Mandate.sol` and implement the specific logic.

### Roles & Powers
-   **Roles**: Defined access identifiers.
-   **Powers**: The ability to execute specific mandates.

## 4. Common Agent Workflows

### A. Institutional Design
When asked to design a governance structure, follow the **5-Step Process** (detailed in `ai/prompts/institutionalDesign.md`):
1.  **Review**: Understand `Powers.sol`, `Mandate.sol`, and existing documentation.
2.  **Inventory**: List assets, actions, roles, and their relationships.
3.  **Design**: Map governance flows to execute actions and assign roles.
4.  **Spec**: Create a `.mdx` specification in `documentation/powers/docs/pages/organisations`.
5.  **Implement**: Create a Solidity deploy script in `solidity/script/organisations`.

### B. Smart Contract Development
-   **Refactoring**: When refactoring contracts (e.g., `Mandate.sol`), ensure you update related tests in `test/`.
-   **New Mandates**: Use existing mandates in `src/mandates/` as templates. Ensure you add unit tests.
-   **Testing**: Always run `forge test` to verify changes.

### C. Frontend Updates
-   **Post-Deployment**: After deploying contracts, you may need to update:
    -   `frontend/context/constants.ts` with new addresses from `broadcast/`.
    -   `frontend/organisations/orgMetadatas/*.json` with specific contract addresses.
-   **UI Components**: Use existing components in `frontend/components/` (like `DynamicActionButton`, `MandateBox`) to maintain consistency.

## 5. Guidelines

-   **Simplicity**: Prefer simple, modular solutions over complex monolithic ones.
-   **Verification**: Always verify your changes. Run tests for Solidity (`forge test`) and ensure the frontend builds (`yarn build` in `frontend/`).
-   **Context**: When working on a task, load relevant files into your context. For design tasks, this includes the specific prompt files in `ai/prompts/`.

---
*This file is intended to be expanded as the project evolves.*
