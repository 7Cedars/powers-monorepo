# **Specification: Physical Sub-DAO Revenue & Distribution**

**Context:** This is a design document that outlines added governance flows to the **Physical Sub-DAO**. These flows are the following:

1. (De-)register Art work as an RWA.    
2. Payment distribution following sale of art work between artist, the Physical Sub-DAO and the Primary DAO.   
3. Mint POAPs \+ register as Attendee.  
4. Distribution of ‘Merit’ NFTs through voting mechanism among attendees.   
5. Distribution of ‘Merit’ NFTs among conveners.   
6. Collection of payments of those with ‘Merit’ POAPs.   
7. On-chain representation of legal representatives sub-DAO \+ assigning this role.   
8. Legal Reps: Pausing & restarting of physical sub-DAO.

### **1\. Definitions**

* **NB: see notion site for**   
* **Split Ratio:** A governance-defined percentage (e.g., 20/20/60) determining the division of funds between the Artist, Local Safe and the Primary DAO Treasury.

### **2\. Assets and Tokens**  

* **Payment Token:** The stablecoin accepted for payment (e.g., USDC).  
* **Art NFTs:** the NFTs that are sold (optionally together with physical artwork). Uses the encodable ERC-1155 protocol.    
* **Proof of Attendance POAP:** ERC-721. Using [POAP.xyz](http://POAP.xyz).    
* **Merit POAP:** For this we can use the de-encodable ERC-1155 protocol. This will allow this token to be used as access to the Primary DAO.    
* **RWAs:** Art work that is on sale. 

### **3\. Roles & Assignments** 

* **Public:** Anyone.    
* **Admin:** Assigned at creation. Most commonly the Ideas DAO that created the physical DAO.    
* **Convener:** Individuals that help organise the event. Applicants are checked for the country of issue of their passport \+ vetted by Legal Reps. They are assigned by the ideas DAO.   
  * The Ideas DAO will get a mandate to vote on applicants.   
* **Attendee:** Assigned through NFT check: they need to own a POAP of the event. The POAP can only be minted at the event.   
* **Legal Rep:** Applicants first checked on nationality \+ that they are not on blacklist.They also need to be older than 18\. Uses ZK\_Passport integration. Assigned by Admin.  
* Note: there is NO specific role for an artist. Not needed for the functionality as is.


### **4\.  Governance Flows** 

#### **A: Minting art work and setting Physical sub-DAO as intermediary (roleIds \= Public \+ Convener)** 

Artists can mint new artworks through the Physical sub-DAO. They provide a url to metadata, this is checked by conveners and if ok-ed the artwork gets minted and linked to an NFT. In doing so, the Physical sub-DAO is also set as an intermediary for the sale of the art work and the token ID encodes the event and time that it was minted. 

All this is done through a Governed721 NFT contract. This ensures that income from sale & resale will be distributed along a collectively decided split between artist, intermediary and owners.

| User Story – Artist (Roles held: Public \+ Convener) *“As an artist I minted NFTs and uploaded additional data for my artifact via the DAO Portal. After it passed the checks I got a message with the QR codes. I printed them out and attached them to the back of the art work. This will allow future owners to claim POAPs and roles in the ecosystem.”* |
| :---- |

**Registration mechanism:**

* Step 1: An Artist proposed to mint an NFT. This NFT links, optionally, to a physical artwork.  
* Step 2: Conveners check the art work: is sub-DAO listed as intermediary, is the art work not offensive, etc. If all is ok: art work is whitelisted \- included in event.   
* Step 3: Conveners ok the art work, and mint it and link the relevant URI. The artist is saved as the original creator of the work. 

**De-registration mechanism:**

* At any time, the artist can decide to delist the Physical sub-DAO as intermediary through the Governed721Wrapper contract. This will remove the art work as listed at the event.


| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

#### **B: Payment distribution following sale of art work between artist, the Physical Sub-DAO and the Primary DAO (roleIds \= Public \+ Convener)** 

This logic is largely handled by an external contract: Governed721Wrapper. This is a NFT contract that handles distribution of sales through collectively decided splits. 

The only thing the sub-DAO needs to facilitate is sale of items by people that do not have a crypto wallet and pay in cash / fiat currency. 


| User Story – Sales Representative (Role held: Convener) *“As a member of the Physical Sub-DAO, I helped run the popup exhibition and acted as the point of contact for visitors interested in purchasing artworks. Each piece in the space had already been registered and priced according to Sub-DAO governance decisions. When a visitor brought an artwork to me, I initiated the sale using the DAO’s point-of-sale flow. Upon payment, the system automatically handled the transaction: the buyer’s payment was collected, the revenue was split between the artist, the Primary DAO and the local Sub-DAO treasury, and the artwork’s ownership was transferred to the buyer.”* |
| :---- |

**Mechanism:**

* **Step 1a:** Member of public buys an item with crypto. Calls ‘safeTransferFrom’ function on Governed721Wrapper contract after approving payment.  
* **Step 1b:** Member of the public buys an item with fiat currency. Convener executes the transfer with …   
* **Step 2:** this function calls the Governed721 Dao. Here basic checks are run, the payment is pulled from the buyer and send to the treasury \- and the NFT is transferred.      
* **Step 3, 4, 5:** The old owner of the NFT, the Artist and Physical Sub-DAO can call specific mandates to retrieve their split of the sale. 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

#### **C: Mint POAPs \+ register as Attendee (roleId \= Public).**

This will use [POAP.xyz](http://POAP.xyz). The most widely adopted protocol for POAPs. Details of architecture are still WIP, but it will build on distribution of ERC-721 NFT first. With the NFT, attendees can claim an Attendee role in the Powers protocol.

IMPORTANT: for now there is a placeholder function where a convener mints a NFT from a ‘POAP’ NFT contract. 

| Onboarding a participant (Public \-\> Attendee): “While walking along Oxford Street in London, I noticed an eye-catching popup space themed entirely around the colour orange. Curious, I stepped inside and explored the exhibition. Informational displays introduced me to The Cultural Stewardship DAO and its local chapter, the ‘Project Orange’ Sub-DAO, which was hosting this temporary art exhibition. The art was amazing and I browsed around.  Someone from the venue came up to me, asked if I wanted to participate in an interactive event. They also told me that I could win prizes.  I agreed to participate.  I own a crypto wallet and they told me I could mint a POAP as a proof of attendance This POAP also gave me the right to vote on contributions at the event: things people said and art work shown. The website for all this was super easy: I scanned the URI, and pressed  one button to mint the POAP and become claim my Attendee role. |
| :---- |

**Mechanism:**

* Step 1:  Have a custom UI for Physical events. Can be accessed through URI. The website should:   
* Step 2: Call the [POAP.xyz](http://POAP.xyz) API \+ checks to mint POAP   
* Step 3: and \- automatically \- also call the Powers instance to assign the role, Using the POAP ID as access token. 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

#### **D: Distribution of ‘Merit’ NFTs through voting mechanism among attendees  (roleId \= Convener \+ Attendees).**

When an attendee makes a good intervention during the event, a convener can start an action \- followed by a vote among attendees \- to mint and send a ‘Merit’ NFT to the attendee. This should be a (non transferable) NFT. 

| Voting on interventions (Roles held: Convener & Attendee) *“We had a round table about what makes Orange such a beautiful colour. An attendee at the table said X and the convener liked it. They scanned the address of the attendee and then we could collectively vote to give a merit NFT to this person.”*  |
| :---- |

 

**Mechanism:**

* Step 1:  Simple mandate to mint and sent an NFT to a given address.   
* A small bespoke UI can be build for this. 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

#### **E: Distribution of ‘Merit’ NFTs among Artists (roleId \= Attendee)**

Each art piece is also an NFT. There is a mandate where Attendees can vote on art pieces. The top five art pieces receive a Merit NFT that is send to their respective artist. 

| User Story: A visitor of event votes on an Art piece (Attendee): \[A user story should be added here.\]  |
| :---- |

**Mechanism:**

* Step 1:    
* Step 2:    
* Step 3:    
* Step 4:    
* … 

#### **E: Distribution of ‘Merit’ NFTs among Conveners (roleId \= Convener)**

Each convener can mint 1 Merit to their own address. This enables a payment as a small token of appreciation for their work during the event. 

| User (role name): \[A user story should be added here.\] |
| :---- |

**Mechanism:**

* Step 1:    
* Step 2:    
* Step 3:    
* Step 4:    
* … 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

#### **F: Collection of payments of those with ‘Merit’ POAPs (roleId \= Public).** 

Those attendees and conveners with Merits can, after the event has concluded, claim a reward. This reward is a (pre-event selected quantity of USDC / quantity minted Merits minted) \* the quantity Merits owned by account.

| User (role name): \[A user story should be added here.\] |
| :---- |

**Mechanism:**

* Step 1:    
* Step 2:    
* Step 3:    
* Step 4:    
* …   
* 

Note: the following is outdated, but will be used as basis for the new governance flow. 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Members** | Veto Redemption | StatementOfIntent.sol | bool PauseRedemption | None | Vote. High Threshold. |
| **Public** (Token Holder) | Redeem Earnings | TreasuryShare\_Redeem.sol | uint256 LATAmount | Burns LAT, Transfers % of USDC from Local Safe to Caller. | Redemption not paused. Caller must own LAT. |

#### **G: On-chain representation of legal representatives sub-DAO \+ assigning this role (roleIds \= Ideas sub-DAO, Legal Reps).** 

Admin of the Physical sub-DAO can (re)assign legal rep roles. In a standard setup, this should be the Ideas sub-DAO that created the physical sub-DAO. In the description of this role it will be made clear that the legal Reps are also the ones that have physical access to the space.

| User (role name): \[A user story should be added here.\] |
| :---- |

**Mechanism:**

* Step 1:    
* Step 2:    
* Step 3:    
* Step 4:    
* … 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

#### **H: Legal Reps: Pausing & restarting of physical sub-DAO (roleId \= Legal Rep)**

There is a governance flow, accessible to the Legal Reps to assign \-\> revoke executive mandates. They can do so repeatedly. Note that this means that without legal representatives, the DAO will not be able to start its activities. 

| User (role name): \[A user story should be added here.\] |
| :---- |

**Mechanism:**

* Step 1:    
* Step 2:    
* Step 3:    
* Step 4:    
* … 

| Role | Name & Description | Base contract | User Input | Executable Output | Conditions |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

###  **5\. Risk Assessment & Governance Checks**

* **Asset Segregation:** This flow deviates from the standard model where all assets are stored in the Primary DAO. It requires the Primary DAO to authorise the Physical Sub-DAO to hold a balance in a Local Safe.

* **Price Manipulation:** To prevent Conveners from selling assets to themselves for 1 USDC, the **Set Price** mandate is subject to a Member Veto (similar to the RWA creation veto logic ).

* **Treasury Drain:** The redemption mechanism is strictly limited to the *Local Safe*. It cannot access the Primary DAO Treasury, ensuring the main ecosystem funds remain secure.

### 

### **6\. User Stories (combining multiple governance flows)**

## **Passer-by who buys an artifact from the DAO (Visitor):** 

*“While walking along Oxford Street in London, I noticed an eye-catching popup space themed entirely around the colour orange. Curious, I stepped inside and explored the exhibition. Informational displays introduced me to The Cultural Stewardship DAO and its local chapter, the ‘Project Orange’ Sub-DAO, which was hosting this temporary art exhibition.*

*As I browsed the space, one artwork stood out to me — a painting of an orange. The piece was clearly labelled as part of the Sub-DAO’s collection and available for purchase. I picked it up and approached the representative to learn more.*

*The representative explained that the artwork was a real-world asset managed by the DAO and that purchases were handled through a blockchain-based point-of-sale system. I agreed to buy the artwork and completed the payment using a supported stablecoin.”* 

---

## **Sales Representative (Physical Sub-DAO Member):** 

*“As a member of the Physical Sub-DAO, I helped run the popup exhibition and acted as the point of contact for visitors interested in purchasing artworks. Each piece in the space had already been registered and priced according to Sub-DAO governance decisions.*

*When a visitor brought an artwork to me, I initiated the sale using the DAO’s point-of-sale flow. Upon payment, the system automatically handled the transaction: the buyer’s payment was collected, the revenue was split between the artist, the local Sub-DAO and Primary DAO treasuries, and the artwork’s ownership was transferred to the buyer.*

*Because I facilitated the sale, I received a Local Activity Token, representing my contribution to the success of the exhibition. This made my role feel meaningfully connected to the long-term health of the local treasury, rather than being limited to a one-off event or wage-based relationship.”* 

---

## **Artist (Physical Sub-DAO Member):** 

*“I am the artist who created the painting of the orange that was exhibited in the popup space. As a member of the Physical Sub-DAO, I contributed my work to the exhibition knowing that it would be managed and sold through the DAO’s shared infrastructure.*

*When my artwork was purchased, the sale strengthened the local Sub-DAO and the wider Cultural Stewardship DAO, and did not just benefit me individually. The revenue generated was automatically distributed according to the agreed rules, ensuring that the ecosystem supporting my work remained sustainable.*

*As part of my participation in the exhibition, I also received a Merit Token. This token represented my contribution as an artist to the success of the physical space and gave me a direct stake in the local treasury that had been built through sales. Rather than my involvement ending at the moment of sale, I remained economically and culturally connected to the ongoing life of the Sub-DAO.*

*By participating as both an artist and a DAO member, I felt aligned with the exhibition beyond a single sale. The system allowed my work to circulate in the real world while remaining embedded in a collective, transparent economic structure that values cultural production as an ongoing practice rather than a one-off transaction.”*

