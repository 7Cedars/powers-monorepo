# Forge Build Warnings

Generated from `forge build` output. Warnings are grouped by type. Severity levels: `Warning` (Solidity compiler), `warning` (forge-lint, higher severity), `note` (forge-lint suggestions).

---

## Warning (2072): Unused local variable

A variable is declared and assigned but never subsequently read. Fix: remove the declaration or use the variable.

| File | Line | Variable |
|------|------|----------|
| `test/unit/Mandate.t.sol` | 594 | `uint256 actionId` |
| `test/unit/mandates/Integrations.t.sol` | 313 | `address functionTarget` |
| `test/unit/mandates/Integrations.t.sol` | 314 | `bytes4 functionSelector` |
| `test/unit/mandates/Integrations.t.sol` | 485 | `uint256 actionId` |

---

## Warning (2018): Function state mutability can be restricted to `view`

The function does not modify state; it can be declared `view`. This saves a small amount of gas and clarifies intent.

| File | Line | Function |
|------|------|----------|
| `test/integration/flows/Electoral.t.sol` | 425 | `testExternalRole_InitialState()` |
| `test/unit/mandates/Electoral.t.sol` | 35 | `testPeerSelectInitialization()` |
| `test/unit/mandates/Electoral.t.sol` | 165 | `testRoleByRolesInitialization()` |
| `test/unit/mandates/Electoral.t.sol` | 214 | `testSelfSelectInitialization()` |
| `test/unit/mandates/Electoral.t.sol` | 302 | `testRevokeInactiveAccountsInitialization()` |

---

## Warning: AST source not found

Forge could not locate the source AST for these files. They are referenced in the build graph but their source is missing or not compiled. This usually means the files do not exist on disk yet (stubs / planned files) or are excluded from the build.

| File |
|------|
| `test/integration/organisations/Powers101.t.sol` |
| `test/integration/organisations/PowerBase.t.sol` |
| `test/integration/organisations/OpenElectionsDAO.t.sol` |
| `src/mandates/integrations/Snapshot/Snapshot_CheckSnapExists.sol` |
| `src/mandates/integrations/Snapshot/Snapshot_CheckSnapPassed.sol` |
| `src/mandates/integrations/SlateRegistry/SlateRegistry_ExecuteResult.sol` |
| `src/mandates/integrations/SlateRegistry/SlateRegistry_RemoveSlate.sol` |
| `script/DeployAllowanceModule.s.sol` |
| `test/fuzz/laws/ElectoralFuzz.t.sol` |
| `test/fuzz/laws/ExecutiveFuzz.t.sol` |
| `test/fuzz/laws/MultiFuzz.t.sol` |
| `test/fuzz/LawFuzz.t.sol` |
| `test/fuzz/PowersFuzz.t.sol` |
| `test/unit/Helpers.t.sol` |
| `test/unit/mandates/Async.t.sol` |
| `test/integration/flows/Executive.t.sol` |
| `test/integration/flows/Async.t.sol` |

---

## warning[unsafe-typecast]

A typecast that may silently truncate a value (e.g. casting a `uint256` to `uint16`). Fix: add a bounds check before the cast, or add an inline `// forge-lint: disable-next-line(unsafe-typecast)` comment with an explanation if the cast is provably safe.

| File | Line | Cast |
|------|------|------|
| `src/helpers/MandateRegistry.sol` | 299 | `uint16(latestPacked >> 32)` |
| `src/helpers/MandateRegistry.sol` | 301 | `uint16(latestPacked & 0xFFFF)` |
| `test/TestSetup.t.sol` | 388 | `uint32(quantityDays * 24 * blocksPerHour)` |
| `test/TestSetup.t.sol` | 392 | `uint32(quantityHours * blocksPerHour)` |
| `test/unit/Powers.t.sol` | 378 | `uint32(againstVote)` |
| `test/unit/Powers.t.sol` | 379 | `uint32(forVote)` |
| `test/unit/Powers.t.sol` | 380 | `uint32(abstainVote)` |
| `test/unit/Powers.t.sol` | 637 | `uint16(i)` |

---

## warning[divide-before-multiply]

A division is performed before a multiplication, which can lose precision due to integer truncation. Fix: reorder so the multiplication happens first.

| File | Line | Expression |
|------|------|------------|
| `src/mandates/integrations/ChainlinkFunctions/ChainlinkFunctions_Open.sol` | 267 | `32 + ((len + 31) / 32) * 32` |
| `src/mandates/integrations/ChainlinkFunctions/ChainlinkFunctions_Open.sol` | 293 | `32 + ((len + 31) / 32) * 32` |

---

## warning[erc20-unchecked-transfer]

The return value of `ERC20.transfer()` / `ERC20.transferFrom()` is not checked. Non-compliant tokens may return `false` on failure instead of reverting. Fix: use `SafeERC20` or check the return value explicitly.

| File | Line | Call |
|------|------|------|
| `test/unit/mandates/Integrations.t.sol` | 61 | `simpleErc20Votes.transfer(alice, 10e18)` |
| `test/integration/flows/Electoral.t.sol` | 134 | `simpleErc20Votes.transfer(alice, 90 ether)` |

---
 
## note[screaming-snake-case-immutable]

`immutable` state variables should be named in `SCREAMING_SNAKE_CASE` per the Solidity style guide. Fix: rename the variable (and all references) to use uppercase with underscores.

| File | Line | Current name | Suggested name |
|------|------|--------------|----------------|
| `src/helpers/ElectionRegistry.sol` | 24 | `voteDuration` | `VOTE_DURATION` |
| `src/helpers/ElectionRegistry.sol` | 25 | `nominationDuration` | `NOMINATION_DURATION` |
| `src/helpers/PowersFactory.sol` | 25 | `maxCallDataLength` | `MAX_CALL_DATA_LENGTH` |
| `src/helpers/PowersFactory.sol` | 26 | `maxReturnDataLength` | `MAX_RETURN_DATA_LENGTH` |
| `src/helpers/PowersFactory.sol` | 27 | `maxExecutionsLength` | `MAX_EXECUTIONS_LENGTH` |
| `src/helpers/PowersFactory.sol` | 29 | `deployer` | `DEPLOYER` |
| `src/helpers/SlateRegistry.sol` | 31 | `voteDuration` | `VOTE_DURATION` |
| `src/helpers/SlateRegistry.sol` | 32 | `submitSlateDuration` | `SUBMIT_SLATE_DURATION` |
| `src/helpers/SlateRegistry.sol` | 33 | `roleId` | `ROLE_ID` |
| `src/helpers/SlateRegistry.sol` | 34 | `submissionMandateId` | `SUBMISSION_MANDATE_ID` |
| `src/helpers/SlateRegistry.sol` | 35 | `revokeMandateId` | `REVOKE_MANDATE_ID` |
| `src/helpers/ZKPassport_PowersRegistry.sol` | 41 | `zkPassportVerifier` | `ZK_PASSPORT_VERIFIER` |
| `src/helpers/ZKPassport_PowersRegistry.sol` | 42 | `zkPassportHelper` | `ZK_PASSPORT_HELPER` |

---

## note[mixed-case-variable]

Mutable (non-constant, non-immutable) variables should use `mixedCase` (camelCase). Fix: rename to the suggested form.

| File | Line | Current name | Suggested name |
|------|------|--------------|----------------|
| `src/interfaces/IZKPassport.sol` | 56 | `isIDCard` | `isIdCard` |
| `src/helpers/ZKPassport_PowersRegistry.sol` | 110 | `isIDCard` | `isIdCard` |
| `src/mandates/integrations/ElectionRegistry/ElectionRegistry_CleanUpVoteMandate.sol` | 27 | `createVoteMandate_Id` | `createVoteMandateId` |
| `src/mandates/integrations/ElectionRegistry/ElectionRegistry_CleanUpVoteMandate.sol` | 29 | `voteMandate_Id` | `voteMandateId` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 218 | `bYYYYMMDD` | `bYyyymmdd` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 253 | `eYYYYMMDD` | `eYyyymmdd` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 307 | `bYYYYMMDD` | `bYyyymmdd` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 308 | `cYYYYMMDD` | `cYyyymmdd` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 321 | `currentYYYYMMDD` | `currentYyyymmdd` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 322 | `currentYY` | `currentYy` |
| `test/governance/Governed721.t.sol` | 54 | `IDEAS_NAMES` | `ideasNames` |
| `test/TestSetup.t.sol` | 234 | `MAX_FUZZ_TARGETS` | `maxFuzzTargets` |
| `test/TestSetup.t.sol` | 235 | `MAX_FUZZ_CALLDATA_LENGTH` | `maxFuzzCalldataLength` |
| `test/TestSetup.t.sol` | 236 | `CREATE2_FACTORY_BYTECODE` | `create2FactoryBytecode` |
| `test/unit/mandates/Integrations.t.sol` | 205 | `safeAllowanceMandateId_ExecuteActionFromSafe` | `safeAllowanceMandateIdExecuteActionFromSafe` |
| `test/unit/mandates/Integrations.t.sol` | 206 | `safeAllowanceMandateId_SetAllowance` | `safeAllowanceMandateIdSetAllowance` |

---

## note[mixed-case-function]

Function names should use `mixedCase` (camelCase). Underscores are allowed only for the leading `_` prefix on internal functions. Fix: rename to the suggested form.

| File | Line | Current name | Suggested name |
|------|------|--------------|----------------|
| `src/helpers/Governed721.sol` | 48 | `safeTransferFromWithETH` | `safeTransferFromWithEth` |
| `src/helpers/Governed721.sol` | 171 | `safeTransferFromWithETH` | `safeTransferFromWithEth` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 314 | `_mrzToYYYYMMDD` | `_mrzToYyyymmdd` |
| `src/mandates/integrations/ZKPassport/ZKPassport_Check.sol` | 345 | `_timestampToYYYYMMDD` | `_timestampToYyyymmdd` |
| `test/TestConstitutions.sol` | 1066 | `delegateToken_IntegrationTestConstitution` | `delegateTokenIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1106 | `openElection_IntegrationTestConstitution` | `openElectionIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1162 | `assignExternalRole_parent_IntegrationTestConstitution` | `assignExternalRoleParentIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1187 | `assignExternalRole_child_IntegrationTestConstitution` | `assignExternalRoleChildIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1218 | `openAction_IntegrationTestConstitution` | `openActionIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1276 | `checkExternalActionState_Parent_IntegrationTestConstitution` | `checkExternalActionStateParentIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1299 | `checkExternalActionState_Child_IntegrationTestConstitution` | `checkExternalActionStateChildIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1326 | `governorProtocol_IntegrationTestConstitution` | `governorProtocolIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1360 | `safeProtocol_Parent_IntegrationTestConstitution` | `safeProtocolParentIntegrationTestConstitution` |
| `test/TestConstitutions.sol` | 1410 | `safeProtocol_Child_IntegrationTestConstitution` | `safeProtocolChildIntegrationTestConstitution` |
| `test/TestSetup.t.sol` | 273 | `check_inputParamsDependencies` | `checkInputParamsDependencies` |

---

## note[asm-keccak256]

A `keccak256` call on a `bytes`-coerced string can be replaced with an inline assembly version for lower gas cost. Fix: use inline assembly, or suppress with `// forge-lint: disable-next-line(asm-keccak256)` if the readability trade-off is not worth it.

| File | Line | Expression |
|------|------|------------|
| `src/helpers/MandateRegistry.sol` | 134 | `keccak256(bytes(mandateName))` |
| `src/helpers/MandateRegistry.sol` | 160 | `keccak256(bytes(mandateName))` |
| `src/helpers/MandateRegistry.sol` | 180 | `keccak256(bytes(mandateName))` |
| `src/helpers/MandateRegistry.sol` | 243 | `keccak256(bytes(mandateName))` |
| `src/helpers/MandateRegistry.sol` | 287 | `keccak256(bytes(mandateName))` |
| `src/helpers/MandateRegistry.sol` | 294 | `keccak256(bytes(mandateName))` |
| `src/helpers/ZKPassport_PowersRegistry.sol` | 79 | `keccak256(abi.encodePacked(account, block.timestamp))` |

---

## note[unaliased-plain-import]

A plain `import "path"` brings every exported symbol into scope unqualified and makes it harder to trace where names come from. Fix: use named imports (`import { A, B } from "path"`) or an alias (`import "path" as X`).

| File | Line | Import |
|------|------|--------|
| `test/TestSetup.t.sol` | 5 | `import "forge-std/Test.sol"` |
| `test/mocks/SimpleErc721.sol` | 4 | `import "@lib/openzeppelin-contracts/.../ERC721.sol"` |
| `test/unit/mandates/AccountAbstraction.t.sol` | 4 | `import "forge-std/Test.sol"` |

---

## note[unwrapped-modifier-logic]

A modifier contains substantial logic directly inside its body, which inflates bytecode size because the body is inlined at every call site. Fix: extract the logic into a private/internal function and call it from the modifier.

| File | Lines | Modifier | Suggested fix |
|------|-------|----------|---------------|
| `src/helpers/ElectionRegistry.sol` | 35–38 | `onlyOwner(uint256 electionId)` | Extract body into `_onlyOwner(electionId)` |

---

## note[named-struct-fields]

A struct is initialised using positional arguments. Fix: use named fields (`Struct({ field: value, ... })`) to make the intent explicit and reduce the risk of argument-order mistakes.

| File | Line | Struct |
|------|------|--------|
| `src/helpers/Governed721.sol` | 147 | `TransferData(oldOwner, newOwner, ...)` |
| `src/helpers/Governed721.sol` | 201 | `TransferData(oldOwner, newOwner, ...)` |
| `src/helpers/ZKPassport_PowersRegistry.sol` | 82 | `DisclosedData("Mock Entry", "GBR", ...)` |
