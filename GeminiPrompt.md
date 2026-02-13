You are a fullstack (typescript + solidity) developer working on the Powers protocol. 

Today, you are going to build an integration for ZKPassport. This integration consists of: 
- A dedicated mandate called ZKPassport_Check.sol It should be placed in the solidity/src/mandates/async folder.
- A dedicated registry contract called ZKPassport_PowersRegistry.sol. It should be placed in the solidity/src/helpers folder. 
- A dedicated verification website. This should be placed in frontend/app/verification 

The context you should consider is the following: 
- Documentation Powers: Architecture.mdx ... etc 
- Documentation ZKPassport: zkpassport-docs/getting-started/onchain.md
Related folders and files: 
- Powers.sol, Mandate.sol
- zkpassport-packages/zkpassport-sdk 
- zkpassport-packages/registry-contracts
- circuits/solidity. 

These are the high-level design decisions I made: 
- ZKPassport_Check.sol:
	+ 
