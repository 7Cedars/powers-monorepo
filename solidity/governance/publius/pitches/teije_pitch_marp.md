---
marp: true
theme: gaia
class: lead
paginate: true
backgroundColor: #0b0e14
color: #e6e6e6
style: |
  section {
    font-size: 30px;
    line-height: 1.35;
  }
  h1 { color: #7cc7ff; }
  h2 { color: #7cc7ff; }
  strong { color: #ffd479; }
  a { color: #7cc7ff; }
  section.lead h1 { font-size: 60px; }
  em { color: #b8b8b8; }
---

<!--
Marp deck. Render to PDF/HTML/PPTX:
  npx @marp-team/marp-cli teije_pitch_marp.md -o teije_pitch.pdf
  npx @marp-team/marp-cli teije_pitch_marp.md -o teije_pitch.html
  npx @marp-team/marp-cli teije_pitch_marp.md --pptx -o teije_pitch.pptx
Or use the "Marp for VS Code" extension for live preview.
Speaker notes are HTML comments — they show in Marp's presenter view and export to PPTX notes.
Fill in [EVENT NAME — DATE] on slide 1. Confirm the 4th funding tier wording (slide 11).
-->

# Powers Protocol

## *Governance beyond trust.*

Teije Hidde Donker · **Publius Projects**
*with co-founder Hannah-Katharina Chabbani*
**[EVENT NAME — DATE]**

Live demo · Open source (MIT) · Built on Arbitrum

<!--
Open calm and slow. "I want to tell you why a Middle East governance scholar ended up
writing smart contracts — and why it matters." One sentence, then move on.
I'm presenting today, but Powers is built by Publius Projects — me and my co-founder
Hannah-Katharina Chabbani. Say "we" honestly throughout.
-->

---

## Who I am


- A scholar of **governance on the edge**
- PhD **European University Institute**; Lecturer in Sociology, **Cambridge**; postdoc, **Bergen**
- Four years of fieldwork — **Syria, Tunisia, Turkey, Jordan** · ~180 interviews · fluent Arabic
- I study how people govern themselves when the state is **weak, contested, or hostile**
- I build Powers at **Publius Projects** with my co-founder, **Hannah-Katharina Chabbani**

<!--
Establish founder-fit fast. Not a crypto tourist — I've spent my career on the exact
problem this protocol solves. The credibility is in the specifics; don't linger.
The last bullet is where "I" becomes "we" — be honest that this is a two-person effort;
from here on the "we" in the deck is Publius Projects.
-->

---

## The question I've always asked

How do people run their day-to-day collective life in
**volatile, low-trust, sometimes repressive** contexts?

Where you can't assume the courts are fair,
the ministry is neutral, or your neighbour won't inform on you.

Governance there isn't a spreadsheet problem.
It's a **trust** problem.

<!--
Emotional core of the pitch. Slow down. The people I worked with didn't lack
organisation — they lacked institutions they could trust to execute the rules fairly.
-->

---

## Why crypto governance caught my attention

- Blockchains offer something new: **rules that execute exactly as written** — regardless of who holds power
- "The rules will be followed" stops being a promise and becomes a **property of the system**
- That's not a financial idea. It's a **governance** idea — and the one the space keeps under-using

<!--
Bridge from theory to tech. I came to crypto for governance, not tokens or price.
This sets up the critique.
-->

---

## My critique of token voting

- **Practically:** slow, low-participation, plutocratic — *one dollar, one vote*
- **Fundamentally:** it doesn't put governance *on* the blockchain — it uses **economic incentives to simulate** it
- It answers *"how do we coordinate money?"* — not *"how do we govern ourselves?"*

<!--
Keep crisp and technical, not preachy — some judges are invested in token voting.
Killer line: token voting is finance wearing a governance costume.
-->

---

## The insight

Use the chain for the one thing it's uniquely good at:
**encoding rules and guaranteeing their execution.**

Then governance needs neither
**informal personal trust** nor **formal institutional trust.**

*You don't trust people or institutions to follow the rules.*
*The chain follows them.*

<!--
The thesis of the whole pitch. If they remember one slide, make it this one.
Pause after "The chain follows them."
-->

---

## What we built: Powers Protocol

- Every action flows through one hub — **`Powers.sol`**
- All logic lives in swappable external **mandate** contracts: proposers, vetoes, thresholds, time locks, conditions
- **Separation of powers** — one role proposes, another vetoes, a third executes; all auditable on-chain
- **One account, one vote** — no token-weighted voting in the core, ever

<!--
The "what is it" slide. Analogy: mandates are LEGO bricks for a constitution.
Compose them to build any governance structure — without touching core code.
-->

---

## What's live today

- **Live deployed org** — clickable, on Arbitrum Sepolia *(open the demo)*
- **`/design-org`** — one conversation → a full deployable organisation (spec + deploy script + tests)
- **AI governance agent** — guard-railed; reads proposals, votes, executes passed actions
- **XMTP agent** — govern from a group chat · plus full docs

<!--
This is where I win the prize — show, don't tell. Have the demo already open in a tab.
One real click beats three slides.
-->

---

## Who this is for

- Community organising in **weak or repressive states**
- **Disenfranchised groups** with no reliable formal institutions
- **Transnational movements** that cross every jurisdiction
- **Crypto-native DAOs** wanting real separation of powers, not plutocracy
- **AI agents** — guard-railed *into* human governance, not around it

<!--
Unifying thread: organising BEYOND trust, not AGAINST it. Not anti-institution — a way
to coordinate when institutions aren't available or aren't trustworthy.
-->

---

## Honest scope: a public good

- This is **not a huge economic opportunity**
- It is a huge **social and political** one
- Powers is **public-goods infrastructure** — open-source, MIT
- We shift *where* trust is needed — we don't pretend to abolish it. Rules still have to be written well, and roles held responsibly

<!--
Owning the "not a big money-maker" line builds credibility. The trust caveat pre-empts
the sharpest question in the room.
-->

---

## Sustainability: the Powers CIC

A company that **governs itself using Powers** — we run on our own protocol.

- **Grants** — ecosystem & public-goods funding
- **Endowment** — invested reserve with governed payouts
- **Consulting / deployment** — the commercial leg
- **Bounties & hackathon prizes** — like this one

Three governed sub-orgs from day one: **Core · Mandates · Endowment**

<!--
Dogfooding is the proof: if our model runs our own treasury, audits, and mandate
registry, it can run yours. Confirm the 4th tier wording (proposed: bounties & prizes).
-->

---

## The ask + why Arbitrum

- **Today:** win this prize — and prove the demo works
- **A grant** — to fund core-protocol and mandate audits
- **Pilot partners** — a real organisation to deploy with
- **Ecosystem intros** — governance and public-goods teams

*Arbitrum: low-cost execution, a serious governance culture, a public-goods ethos that matches ours.*

<!--
Close on the mission line: "Governance shouldn't require you to trust the people in
power. Let's build the systems that don't." Then stop talking.
-->

---

<!-- _class: lead -->

## Governance shouldn't require you to
## trust the people in power.

### Let's build the systems that don't.

**Teije Hidde Donker** & **Hannah-Katharina Chabbani** · Publius Projects · github.com/publius-projects

<!--
Closing slide. Leave it up during Q&A. Repressive-state safety one-liner if asked:
pseudonymous participation, no token barrier, censorship-resistant execution — but users
still face on-ramp, key-custody, and connectivity realities a chain can't solve alone.
-->
