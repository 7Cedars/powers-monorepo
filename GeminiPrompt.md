# ZKPassport integration
You are a fullstack (typescript + solidity) developer working on the Powers protocol. 
Today, you are going to build an integration for ZKPassport for the Powers protocol. 

## Tasks: 
*TASK 1*: Create a specsheet. Save as `ZKPassportIntegration.md` in the top level folder. 
*TASK 2*: implement the integration. This integration consists of: 
- A dedicated mandate called `ZKPassport_Check.sol` It should be placed in the `solidity/src/mandates/async` folder.
- A dedicated registry contract called `ZKPassport_PowersRegistry.sol`. It should be placed in the `solidity/src/helpers` folder. 
- A dedicated verification website. This should be placed in `frontend/app/verification`

# Details 

## context
The context you should consider is the following: 
- Documentation Powers: `/home/teijehidde/Documents/7CedarsGit/projects/powers/documentation/powers/docs/pages/for-developers/architecture.mdx`
- Documentation ZKPassport: Please see `/home/teijehidde/Documents/7CedarsGit/cloning/zkpassport-docs/docs/getting-started/onchain.md`
Related folders and files: 
- `Powers.sol`, `Mandate.sol` in the `solidity/src` folder
- `/home/teijehidde/Documents/7CedarsGit/cloning/zkpassport-packages/packages/registry-sdk/`
- `/home/teijehidde/Documents/7CedarsGit/cloning/zkpassport-packages/packages/registry-contracts/`
- `/home/teijehidde/Documents/7CedarsGit/cloning/circuits/src/solidity/src`

## Architecture 
These are the high-level design decisions I made: 
- ZKPassport_Check.sol should check a caller account address to the registry and pass if the account address passes selected tests.  
	+ The mandate has the following configParams: 
        - `string[] inputParams` (to set input params that will not be used, they are important for integrating the mandate into governance flows).
        - `address registry` . The address of the ZKPassport_PowersRegistry that will be read. 
        - `string Name` - if not "" , then will check if the name is provided. 
        - `bytes[] Checks` an array of abi.encodeWithSelector results of the function checks (such as isAgeBetween) and the arguments. This should also allow to check on uniqueness of the passport. Our setup should disallow the use of the same passport for two different addresses. 
        - `uint256 InvalidAfterSeconds` The amount of seconds after the timestamp at which the proof is considered invalid. 
    +  InputParams are the ones set in the config. 
    + handleRequest: makes a call to the registry, to check if the caller passed the selected tests at the Registry set in the config. The  
    + It should always check ALL checks (even if one fails) and create a bespoke error message if one or more fails that states precisely what data was missing or did not pass which check. 

- ZKPassport_PowersRegistry.sol is a dedicated helper contract that verifies and registers identities. 
    + please work from the basis of the examples from zkpassport-docs/getting-started/onchain.md (and other provided docs).
    + But: use getDisclosedData to check which data has been disclosed, and do checks on those items. In other words, the checks should be dynamic.
    + There should be a struct Checks that has entries for all the possible checks. Each check is implemented as a uint256 timestamp of the timestamp the proof of this check was generated at.   
    + It should have the following state vars 
        - `mapping(address => bytes32) public accountIdentifiers`;
        - `mapping(bytes32 => address) public identifierAccounts`; // used to check if identifier has not already been used before. NOTE: if the caller is the same as the already logged account, the data should be overwritten with the new data. 
        - `mapping(bytes32 => Checks) public accountChecks`;
    + When the proof is found to be valid, the checks that are included are set at the timestamp at which they were created. 
    + When the proof is found to be invalid, all checks are set at 0.
    + It should have a getCheck (or some similar name) getter function to retrieve the timestamp from the proofs. 

- Verification website. 
    + please work from the basis of the examples from zkpassport-docs/getting-started/onchain.md (and other provided docs).
    + But: This needs to be a DYNAMIC website. In other words: users should be allowed to check from a list what types of data they want to disclose.
    + The way `queryBuilder` is called needs to be adapted from the examples accordingly: these items need to be conditional on the selected data types.  
    + The idea is that users should only disclose the data that they need to disclose for the specific Mandate that they will be calling. 
    + Leave out documentNumber. 
    + As a UI: use the same style as other parts of the Powers UI. Keep it simple but still professional and stylish. For the rest, you can decide how to do this. 

Please let me know if anything is unclear. 