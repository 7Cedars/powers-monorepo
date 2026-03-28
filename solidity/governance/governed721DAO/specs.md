# **Governed721 DAO - Specification**

| WARNING: Governed721 DAO is under development. The organisational specs and deployment addresses are subject to change. This document serves as an initial specification based on the ecosystem architecture. |
| :---- |

## **Context**

### ***The Vision & Mission:***

The Governed721 DAO implements a governed NFT protocol where the stakeholders of the NFT ecosystem directly manage the economic parameters of the protocol. It aims to empower the creators (Artists), holders (Owners), and facilitators (Intermediaries) by giving them the power to collaboratively decide how royalties are split. 

Furthermore, the collective elects a body of Executives that enforce compliance to the established royalty splits, maintain protocol security, and ensure the smooth execution of transfers and payments within the ecosystem.

* **STAKEHOLDERS:** Artists, Owners, and Intermediaries form the core of the DAO.
* **ROYALTIES:** Stakeholders collectively control the splits for payments and royalties.
* **VOTING:** Stakeholders claim Voter roles to participate in electing the Executive body.
* **ENFORCEMENT:** Executives hold the power to propose split changes, manage whitelists for allowed payment tokens, and blacklist non-compliant accounts to secure the protocol.

## **Definitions**

* **Split Ratio**: A governance-defined percentage (e.g., Artist 10%, Intermediary 5%, Owner 85%) determining the division of payments generated during an NFT transfer. The total split cannot exceed 100%. The Old Owner inherently receives the remainder after Artist and Intermediary splits.
* **Primary DAO**: The central governance hub (`Powers.sol`) that manages the roles, mandates, and oversees the `Governed721` contract.
* **Artist**: The original creator/minter of an NFT. They are entitled to claim the Artist role.
* **Owner**: The current holder/owner of an NFT. They are entitled to claim the Owner role.
* **Intermediary**: The approved address or operator of an NFT. They are entitled to claim the Intermediary role.
* **Voter**: A meta-role claimed by accounts holding either the Artist, Owner, or Intermediary role, allowing them to participate in Executive elections.
* **Executives**: Elected leaders who propose split changes, manage allowed payment tokens, and blacklist malicious actors.

## **Assets and Tokens**

The ecosystem utilises a combination of core protocol contracts and standard tokens:

* **Governed721 NFT (`Governed721.sol`)**: The core ERC721-compatible NFT contract managed by the DAO. It tracks Artists, enforces splits, manages whitelists/blacklists, and executes transfers intertwined with payments.
* **Treasury (Safe)**: A centralized Safe smart wallet controlled by the Primary DAO, holding the organization's collective assets.
* **Whitelisted Tokens**: ERC20 tokens that are approved by the DAO to be used as payment for NFT transfers.

## **Structure**

### ***The Architecture of the DAO:***

The Governed721 organisation operates as a single **Primary DAO** directly managing an external `Governed721` contract.

1. **Primary DAO**: The central authority and root of the ecosystem.
    *   **Role**: Governance of the Treasury, managing elections, proposing and vetoing split changes, and managing protocol compliance (whitelists/blacklists).
    *   **Treasury**: Controls the central Safe.
    *   **Governance**: Elected Executives manage parameters; Artists, Owners, and Intermediaries hold veto power and elect the Executives.

### ***Deployed Mandates:***

Below are the details for the deployed mandates for the Governed721 DAO. The section summarises the mission of the DAO, the assets it controls, and the actions it can take.

## Primary DAO

### ***Mission***

To govern the Governed721 protocol, manage royalty distributions, and enforce compliance through an elected executive body.

### ***Assets***

The Primary DAO controls the following assets:

* It is the owner of the `Governed721` contract, having the exclusive right to update splits, whitelists, and blacklists.
* It is the owner of the central Safe Treasury.

### ***Actions***

The Primary DAO can take the following actions:

* Collect split payments on behalf of role holders.
* Executives can propose changes to royalty splits between Artists and Intermediaries (the old Owner gets the remainder).
* Artists, Owners, and Intermediaries can veto proposed split changes.
* Executives can execute the proposed split change if no vetoes are cast.
* Executives can whitelist or de-whitelist ERC20 tokens for use in payments.
* Executives can blacklist or un-blacklist specific accounts to prevent them from transferring or minting NFTs.
* Stakeholders can claim and revoke roles (Artist, Owner, Intermediary) based on on-chain queries to the `Governed721` contract.
* Stakeholders can claim the Voter role to participate in elections.
* Voters can nominate themselves, create elections, vote, and tally results to elect Executives.

### ***Roles***

| Role Id | Role name | Selection criteria |
| :---- | :---- | :---- |
| 0 | Admin | Revoked at setup. |
| 1 | Artist | Original creator/minter of an NFT. |
| 2 | Owner | Current owner of an NFT. |
| 3 | Intermediary | Approved address for an NFT. |
| 4 | Voter | Must hold Artist, Owner, or Intermediary role. |
| 5 | Executive | Elected by Voters. |
| … | Public | Everyone. |

### ***Executive Mandates***

#### Royalty & Payments Management

Executives can propose changes to the royalty split. Artists, Owners, and Intermediaries have a distinct veto right to block these changes. If no veto is cast, the Executive can enforce the new split. Any role holder can trigger their payment collection.

| Role | Name | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Public | Collect Split Payment | GovernedToken_CollectSplitPayment.sol | none (uses stored data) | Executes payment transfer to role holder | Caller must match the respective role for the split. |
| Executive | Propose Split Payment | StatementOfIntent.sol | "uint8 Percentage, uint8 Role" | Proposes new split | None. |
| Artist (1) | Veto Split (Minter) | StatementOfIntent.sol | (same as above) | Logs veto | Vote, proposal exists. |
| Owner (2) | Veto Split (Owner) | StatementOfIntent.sol | (same as above) | Logs veto | Vote, proposal exists. |
| Intermediary (3) | Veto Split (Intermediary) | StatementOfIntent.sol | (same as above) | Logs veto | Vote, proposal exists. |
| Executive | Split Checkpoint 1 | StatementOfIntent.sol | (same as above) | Confirms no Artist veto | Timelock. |
| Executive | Split Checkpoint 2 | StatementOfIntent.sol | (same as above) | Confirms no Owner veto | Checkpoint 1 fulfilled. |
| Executive | Execute Split Payment | BespokeAction_Simple.sol | (same as above) | Calls `setSplit` on Governed721 | Checkpoint 2 fulfilled, confirms no Intermediary veto. |

#### Compliance & Administration

Executives enforce protocol compliance by managing which payment tokens are allowed, and which accounts are blacklisted from participating in the ecosystem.

| Role | Name | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Executive | Add Allowed Token | BespokeAction_Advanced.sol | "address Token" | Whitelists payment token | Vote, high threshold. |
| Executive | Remove Allowed Token | BespokeAction_Advanced.sol | "address Token" | Removes token from whitelist | Vote, high threshold. Previous mandate fulfilled. |
| Executive | Add account to blacklist | BespokeAction_OnOwnPowers_Advanced.sol | "address Account" | Blacklists an account | Vote, high threshold. |
| Executive | Remove account from blacklist | BespokeAction_OnOwnPowers_Advanced.sol | "address Account" | Removes account from blacklist | Vote, high threshold. Previous mandate fulfilled. |

### ***Electoral Mandates***

#### Claiming Protocol Roles

Users claim governance roles based on their on-chain state within the `Governed721` contract. Executives maintain the power to revoke these roles in case of lapsed ownership or inactivity.

| Role | Name | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Public | Check ownership Token | BespokeAction_Simple.sol | "uint256 TokenId" | Returns owner address | None. |
| Public | Assign Owner Role | BespokeAction_OnOwnPowers_OnReturnValue.sol | "uint256 TokenId" | Assigns Owner role (2) | Previous mandate fulfilled. |
| Executive | Revoke Owner Role | BespokeAction_OnOwnPowers_OnReturnValue.sol | "uint256 TokenId" | Revokes Owner role (2) | Vote. Previous check mandate fulfilled. |
| Public | Check artist Token | BespokeAction_Simple.sol | "uint256 TokenId" | Returns artist address | None. |
| Public | Assign Artist Role | BespokeAction_OnOwnPowers_OnReturnValue.sol | "uint256 TokenId" | Assigns Artist role (1) | Previous mandate fulfilled. |
| Executive | Revoke Artist Role | BespokeAction_OnOwnPowers_OnReturnValue.sol | "uint256 TokenId" | Revokes Artist role (1) | Vote. Previous check mandate fulfilled. |
| Public | Check approved address Token | BespokeAction_Simple.sol | "uint256 TokenId" | Returns approved address | None. |
| Public | Assign Intermediary Role | BespokeAction_OnOwnPowers_OnReturnValue.sol | "uint256 TokenId" | Assigns Intermediary role (3) | Previous mandate fulfilled. |
| Executive | Revoke Intermediary Role | BespokeAction_OnOwnPowers_OnReturnValue.sol | "uint256 TokenId" | Revokes Intermediary role (3) | Vote. Previous check mandate fulfilled. |
| Public | Claim Voter Role | RoleByRoles.sol | None | Assigns Voter role (4) | Must hold role 1, 2, or 3. |

#### Electing Executives

Voters form the democratic foundation of the Governed721 protocol, periodically electing Executives to oversee the system.

| Role | Name | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Voter | Nominate for Executive | ElectionList_Nominate.sol | "(bool nominateMe)" | Logs nomination | None. |
| Voter | Revoke Nomination | ElectionList_Nominate.sol | "(bool nominateMe)" | Revokes nomination | None. |
| Voter | Create Executive Election | BespokeAction_Simple.sol | "string Title, uint48 StartBlock, uint48 EndBlock" | Creates election helper | Vote, throttled. |
| Voter | Open Executive Vote | ElectionList_CreateVoteMandate.sol | None | Opens voting | Previous mandate fulfilled. |
| Voter | Tally Executive Election | ElectionList_Tally.sol | None | Tallys votes, assigns Executive roles | Previous mandate fulfilled. |
| Voter | Cleanup Election | BespokeAction_OnReturnValue.sol | None | Cleans up election mandates | Previous mandate fulfilled. |

### ***Reform Mandates***

* Currently immutable. No reform mandates are established for upgrading the governance parameters.

## Description of Governance

The Governed721 DAO implements a highly targeted, role-based governance model specifically designed to manage a single core asset: the `Governed721` NFT contract.

* **Remit**: To govern royalty parameters, enforce compliance, and securely manage value flows tied to NFT transfers.
* **Separation of Powers**:
  * **Legislative/Veto**: Stakeholders (Artists, Owners, Intermediaries) hold the power to veto detrimental economic changes to the protocol splits.
  * **Executive**: Elected Executives manage the day-to-day parameter tuning (whitelists, blacklists) and initiate split proposals. They act as the enforcers of the DAO's collective will.
  * **Democratic Base**: Any user holding an active stake in the system (Artist, Owner, Intermediary) can claim a Voter role to hold the Executive body accountable.
* **Executive Paths**:
  * **Payments**: The payment flow is deeply integrated into the transfer mechanism of the NFT, allowing automated distribution directly governed by the agreed splits.

## Risk Assessment

### ***Dependency Chains***

The entire governance model hinges on the accurate reflection of on-chain state from the `Governed721` contract to the `Powers.sol` DAO. If the NFT transfer mechanism is exploited, or if roles are assigned incorrectly due to faulty checks, the balance of power (Voters vs Executives) could be skewed. Blacklisting remains a critical emergency function to contain malicious actors in such scenarios.
