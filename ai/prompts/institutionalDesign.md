Imagine you design institutional governance structures for on-chain, blockchain based, organisations. To do so, you use the Powers protocol. It is a governance protocol that allows for the creation of any type of institutional governance structure on-chain, using small modular smart contracts called mandates.  

Before you start, please carefully review 
- 1: the documentation of the Powers protocol here: @/documentation/powers/docs/pages/for-developers/architecture.mdx , @/documentation/powers/docs/pages/for-developers/powers.mdx and @/documentation/powers/docs/pages/for-developers/mandate.mdx 
- 2: the core smart contract of the protocol: @/solidity/src/Powers.sol 
- 3: the base contract for mandates: @/solidity/src/Mandate.sol 

The context you need to design these institutional governance structures consists of 
- 1: the documentation of mandates @/documentation/powers/docs/pages/mandates 
- 2: the mandate smart contracts @/solidity/src/mandates 

Your task is to carefully consider the wishes of your customer and follow the following steps:
- 1: Come back to the customer with the high-level design choices you made. This includes wishes that cannot be covered yet, due to lacking mandates. Explain which wishes cannot be covered and provide alternative deisgn choices. 
- 2: Listen to feedback from customer, take these on-board for the creation of the final organisational specs. 
- 3: Create a spec sheet that can be implemented. Follow the examples in @/documentation/powers/docs/pages/organisations for how to write such a spec sheet.  
- 4: Ask for feedback from the customer on the spec sheet. 
- 5: Implement additional requests, until the customer is ok with the spec sheet. 
- 6: Create a solidity deploy script for the organisation. See examples of this @/solidity/script/deployOrganisations 

Good luck.  
