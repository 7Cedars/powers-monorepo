# ZKPassport Integration Specsheet

## Overview
This document outlines the integration of ZKPassport into the Powers protocol. The integration enables role-based governance and identity verification using ZKPassport's privacy-preserving technology.

## Components

### 1. ZKPassport_Check (Mandate)
**Location:** `solidity/src/mandates/async/ZKPassport_Check.sol`

A mandate contract that verifies if a caller's address satisfies specific ZKPassport checks registered in the `ZKPassport_PowersRegistry`.

**Configuration Parameters:**
- `string[] inputParams`: Unused input parameters, required for governance flow integration.
- `address registry`: The address of the `ZKPassport_PowersRegistry` contract.
- `string Name`: If not empty, enforces a name check.
- `bytes[] Checks`: An array of encoded function calls (selector + arguments) defining the specific checks to be performed (e.g., `isAgeBetween`). This ensures passport uniqueness for addresses.
- `uint256 InvalidAfterSeconds`: Time window in seconds after which a proof is considered invalid.

**Functionality:**
- `handleRequest`:
    - Calls the `registry` to verify if the caller has passed the configured `Checks`.
    - Iterates through ALL configured checks.
    - Accumulates failures and reverts with a detailed error message if any check fails, specifying exactly which data was missing or invalid.
    - Ensures that the passport proof was generated within the `InvalidAfterSeconds` window relative to the current timestamp.

### 2. ZKPassport_PowersRegistry (Helper Contract)
**Location:** `solidity/src/helpers/ZKPassport_PowersRegistry.sol`

A registry contract that handles the verification of ZKPassport proofs and stores the validation status of specific data points for addresses.

**State Variables:**
- `mapping(address => bytes32) public accountIdentifiers`: Maps an account address to a unique passport identifier (e.g., hash of nullifier or unique ID).
- `mapping(bytes32 => address) public identifierAccounts`: Maps a unique passport identifier to an account address. Used to prevent sybil attacks (one passport per account). Overwrites previous address if the same passport is used again by a *different* (or same) caller, effectively moving the identity.
- `mapping(bytes32 => Checks) public accountChecks`: Maps a unique identifier to a struct of timestamped checks.

**Structs:**
- `struct Checks`: A dynamic structure (implemented via mapping or specific fields) where keys correspond to check types (e.g., "age > 18") and values are `uint256` timestamps indicating when the proof for that check was generated.
    - *Refinement*: Since Solidity structs are static, and the requirement is "dynamic checks" based on `getDisclosedData`, we might need a more flexible storage pattern, e.g., `mapping(bytes32 => mapping(bytes4 => uint256)) public checkTimestamps` where `bytes4` is the selector of the check function.

**Functionality:**
- **Verification & Registration:**
    - Accepts ZKPassport proofs.
    - Verifies the proof using the ZKPassport core/verifier contracts.
    - Extracts disclosed data using `getDisclosedData`.
    - Performs the requested checks on the disclosed data.
    - If valid:
        - Updates `accountIdentifiers` and `identifierAccounts`.
        - Records the timestamp of verification for each passed check.
    - If invalid:
        - Does not update state (reverts) or sets checks to 0 if explicitly invalidating.
- **Getters:**
    - `getCheck(address account, bytes4 checkSelector, bytes memory args)`: Returns the timestamp if the check passed, or 0.

### 3. Verification Website (Frontend)
**Location:** `frontend/app/verification`

A dedicated page for users to generate ZKPassport proofs and submit them to the registry.

**Features:**
- **Dynamic Data Disclosure:**
    - Users can select which data fields they want to disclose from a list.
    - The `queryBuilder` for the ZKPassport request is constructed dynamically based on user selection.
    - Users only disclose what is necessary for the specific Mandate they intend to interact with.
- **UI/UX:**
    - Consistent with Powers protocol design (simple, professional).
    - "Connect Wallet" functionality.
    - "Generate Proof" button.
    - "Submit to Registry" button (executes transaction to `ZKPassport_PowersRegistry`).
- **Constraints:**
    - `documentNumber` is explicitly excluded from disclosure options.

## Implementation Details

### ZKPassport_Check.sol Logic
```solidity
function handleRequest(...) {
    // ...
    for (uint i = 0; i < config.Checks.length; i++) {
        // decode selector and args
        // call registry.getCheck(...)
        // verify timestamp > block.timestamp - config.InvalidAfterSeconds
    }
    // ...
}
```

### ZKPassport_PowersRegistry.sol Logic
- Needs to import ZKPassport verifier interfaces.
- `verifyAndRegister(ZKPassportProof memory proof)`:
    - Verify proof.
    - Extract fields.
    - Store mapping of `hash(selector + args) => timestamp`.

## Dependencies
- Powers Protocol Core (`Powers.sol`, `Mandate.sol`)
- ZKPassport SDK (`@zkpassport/registry-sdk`, `@zkpassport/registry-contracts`)
- ZKPassport Circuits/Verifier (`@zkpassport/circuits`)
