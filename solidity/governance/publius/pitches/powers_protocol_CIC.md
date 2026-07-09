# Notes on structure Powers Protocol CIC

## What does this organisation do
1. In two or three sentences: what does this organisation do, and what resources or decisions does it manage?

The organisation manages the development and maintenance of the Powers Protocol and associated mandates. This includes, but might not be limited to, the following tasks: 
- Fund development of the core protocol. 
- Fund development of mandates. 
- Fund audits of core protocol. 
- Fund audits of mandates. 
- Govern the assessment of inclusion of mandates in the MandateRegistry.sol

It also involves management of income flows: 
- Manage income from grants
- Have an endowment; governance of investment strategies. Rules for transferring income form endowment to main organisation. 
- Support form commercial enterprises and a framework for encoding agreements of support from third parties.  

## Who are the people involved? 
2. Who are the people involved? Describe each group by role — e.g. "artists who create work", "patrons who fund it", "stewards who maintain the commons" — and roughly how many people you expect in each group.

The following is a (possibly non-comprehensive) list of actors involved:
- Developers. 
- Mandate Assessors. 
- Grant Funders 
- Endownment investors 
- Security council 
- Third party commercial entereprises. 

## What decisions need collective governance?
3. What decisions need collective governance? Give concrete examples: "who gets a grant", "whether to change a fee", "who joins the council", and so on.

There need to be several sub organisations around specific assets and decisions to be taken. 
- Core Governance
    - Assessing invoices / proposals for work done on core protocol -> transferring assets accordingly. 
    - (de)whitelisting auditing organisations. 
    - Proposing audit at specific audit org -> payments after job completed.   
    - Setting up funding stream to Mandates organisations.  
    - Emergency stop on organisation and asset transfers.  
    - Function to transfer funds to Treasury (in case of mistaken transfer).   
- Mandates Governance
    - Assessing invoices / proposals for work done on specific mandate -> transferring assets accordingly.
    - Proposing to audit specific mandate at specific audit org -> payments after job completed.
    - Assessing proposal to add / remove mandate from mandate registry
    - Function to transfer funds to Treasury (in case of mistaken transfer). 
    - ... other function to govern at MandateRegistry.sol 
- Endowment Governance
    - Deciding where and how to invest assets. 
    - A function where the core Governance org can retrieve income from invested endowment assets to core organisation. 
    - ... other functions? 

4. Trust and founding authority. Who do you trust most to act in the organisation's interest? Is
there a founding group or administrator (e.g. you, or a small core team) who should hold extra
authority at the start — with the intention of handing it off later — or should power be
distributed from day one?
- answer: Ideally it should have a distributed power structure from the start.  

5. Veto / blocking power. You mentioned an emergency stop and a Security Council. Which decisions
should be easy to block rather than approve, and who holds that brake? For instance: should the
Security Council be able to unilaterally freeze asset transfers? Should anyone be able to veto a
mandate being added to the registry?
- answer: I think the security council should have the power to pause & restart core governance flows. I should also have the power to veto the adoption of new mandates. 
- I think at various places in the governance structure roles that are impacted by decisions should at least have a veto vote.  

6. Urgency. How fast do decisions typically need to happen, per area? My sense is these differ
sharply — audits and grants can take weeks; an emergency stop must be near-instant; endowment
investment shifts might be deliberately slow. Tell me if that's right, and roughly the timescales
you'd want (days / weeks / months) for: paying invoices, adding/removing a mandate from the
registry, endowment investment decisions, and the emergency stop.
- answer: I think your general sense is spot on. Because this deployment is a test deployment, I would like all the durations to be in minutes. As a rule of thumb: take 1 minute for what usually would take a day - with the minimum of 1 minute. 

7. External systems. What does this connect to? Specifically: a shared treasury (a Gnosis Safe
multisig, or should the Powers contract itself hold funds?), the live MandateRegistry.sol
contract (I assume yes — Mandates Governance needs to call it), any token, and the endowment's 
investment venues (are these on-chain protocols, or off-chain arrangements recorded on-chain?).
- answer: Please use a gnosis safe for assets as you propose. Same with the MandateRegistry.sol contract.
- answer re endowment: search the web for popular ways of investing tokens, and see if they have a deployment on Arbitrum sepolia. If there are one or two that would work: use those. Good luck.  

---
And one architectural question that sits underneath all of this, which is genuinely yours to
decide:

8. How literally "separate" should the sub-organisations be? You said "several
sub-organisations." Powers can do this two ways:

- (A) One organisation, several governance flows — Core, Mandates, and Endowment are distinct
role-sets and flow-sets inside a single Powers contract. Simpler to deploy and reason about; all
assets sit in one treasury with rules separating them. Good if the sub-orgs are really
"departments."
- (B) A true federation — a parent Core organisation that spawns Mandates and Endowment as fully
independent child Powers contracts, each with its own treasury and members, each holding a formal
vote at the parent. This is the genuine "nested enterprises" model: maximum autonomy and asset
separation, at the cost of significant deploy-time complexity. Good if each sub-org should be
able to evolve its own rules and truly control its own assets.

Which matches your intent? (My read is you're leaning toward B given the language of
"sub-organisations around specific assets" — but A is a legitimate, much simpler starting point
you could later grow into B.)
- Answer: Definitely B. I would like to setup several interlocking organisations. We do not need to have the ability to spawn new organisations - but from construction, Core Governance, Mandates Governance and Endowment Governance should be build into three separate Powers implementations.  

---
Finally, two quick options:

9. Metadata URI — do you have a link to a JSON file (name, description, logo) for the
organisation? If not, I'll use a placeholder you can fill in before deploying.
- answer: Not yet, I would like to add this later. 

10. Gasless transactions (account abstraction) — do you want members to be able to interact
without paying gas from their own wallets? If yes, a PowersPaymaster gets deployed and pre-funded
(typical seed: 0.05 ETH), and I'll add fund/withdraw flows for it. Yes or no — and if yes, the
seed amount.
- answer: Yes please. 

