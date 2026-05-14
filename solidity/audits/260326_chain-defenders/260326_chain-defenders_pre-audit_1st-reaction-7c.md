# First reaction 7Cedars to Chain-defenders pre-audit suggestions 

- Point 1 is a real major issue and the solution is fantastic. Super cool. Will implement. 
- Point 2 I have to dig into this. A replay should not be possible due to access control of request & fulfill. Will double check.  
- Point 3: option 2. Will clarify. 
- Point 4-8 + 10-11: I think I agree with observations & suggestions. 
- Point 9: MandatIds should only increment. It should not be possible to assign a new mandate to an old revoked mandateId. Will double check if this invariant is breached somewhere.  

Re questions: 
1. **What is the recovery path** if a critical bug is found post-constitution and no upgrade mandate was adopted? Is this intentional (immutability as a feature)?
- Yep, totally intentional. It's up to organisations themselves to decide if they want an immutable governance structure - with all the associated risks.   

2. **Async pathways** (GitHub, Snapshot integrations) — how is off-chain data authenticated before it influences on-chain `fulfill()`? This is a significant attack surface.
- Very good point. I am actually thinking of taking out `_externalCall()` from `Mandate.sol` for this reason. Together with your suggestion for vulnerability #1 (which btw, would make the async setup of mandates impossible anyway) this would improve mandate.sol a lot. 

Question then becomes, of course, how to deal with async calls? It might mean dealing with callback functions in Powers.sol itself. I tried to avoid this, but it might be the only option. TBC. 

3. **Mandate audit expectations** — will the team publish a set of "blessed" or audited mandates that deployers can use safely, vs. mandates that require their own independent audit?
- Yes. The idea is to have a registry of "blessed" audited mandates. The inclusion of mandates would be governed through - what else - a Powers Protocol implementation. Note that this means that anyone can create their own repository with their own blessed mandates & their own governance. This is intentional. 

4. **Is `executeMandate()` expected to be called only by Powers, or can it be called directly?** If directly callable, role/condition checks could be bypassed.
- executeMandate() should NEVER be callable by anything else than the Powers instance that adopted the mandate, for exactly the reasons you state: it's a huge security risk. 

Again thank you so much! I'll come back to you with a more in-depth reply after EthCC. 
