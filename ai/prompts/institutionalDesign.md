Imagine you design institutional governance structures for on-chain, blockchain based, organisations. To do so, you use the Powers protocol. It is a governance protocol that allows for the creation of any type of institutional governance structure on-chain, using small modular smart contracts called mandates.  

Before you start, please carefully review 
- 1: the documentation of the Powers protocol here: @/documentation/powers/docs/pages/for-developers/architecture.mdx , @/documentation/powers/docs/pages/for-developers/powers.mdx and @/documentation/powers/docs/pages/for-developers/mandate.mdx 
- 2: the core smart contract of the protocol: @/solidity/src/Powers.sol 
- 3: the base contract for mandates: @/solidity/src/Mandate.sol 

The context you need to design these institutional governance structures consists of 
- 1: the documentation of mandates @/documentation/powers/docs/pages/mandates 
- 2: the mandate smart contracts @/solidity/src/mandates 

Your task is to carefully consider the wishes of your customer and follow the following steps.
1 - propose and confirm high level design choices
2 - create a .mdx spec sheet in @/documentation/powers/docs/pages/organisations 
3 - implement this organisation through a solidity deploy script in @/solidity/script/deployOrganisations

IN DETAIL: 
*At step 1*: create a temporary file, where you create comprehensive lists of the following: 
- 1A: The assets that are controlled by the organisation. 
- 1B: The actions that the organisation will need to be able to take in relation to these assets. 
- 1C: The roles that the organisation needs to have. 
- 1D: How these roles should relate to the actions you listed at B. 

Following this inventory, decide what kind of governance flows you will need to have to:
- Execute these actions. 
- Assign accounts to these roles. 

Come back to the customer with the high-level design choices you made. 
- This includes wishes that cannot be covered yet, due to lacking mandates. Explain which wishes cannot be covered and provide alternative deisgn choices.
- It also includes creating clones (or mocks) of existing protocols, if you think this is necessary.  

In case the customer comes back with feedback: 
- 1E: Listen to feedback from customer, and adapt your inventory accordingly. 
- 1f: Repeat 1A, 1B, 1C, 1D, above and adapt your design choices. 
 
*At step 2*: 
- 2A: Create a spec sheet that can be implemented using the .mdx format. Follow the examples in @/documentation/powers/docs/pages/organisations for how to write such a spec sheet.  
- 2B: Save the spec sheet in the @/documentation/powers/docs/pages/organisations folder. 
- 2C: Ask for feedback from the customer on the spec sheet. 

In case the customer comes back with feedback: 
- 2D: Listen to feedback from customer, and adapt your spec sheet accordingly.  
- 2E: Repeat steps 2A, 2B, 2C until the customer is ok with the spec sheet

When the spec-sheet is ok-ed 
- 2F: create a solidity deploy script for the organisation. See examples of this @/solidity/script/deployOrganisations 
- 2G: save the your dpeloy script there. Use the same name as the .mdx file, but now as a .s.sol script. 

IMPORTANT: DO NOT DO THE FOLLOWING: 
- skip steps 
- create deployment files in the frontend as .ts file 

Thank you and good luck.  