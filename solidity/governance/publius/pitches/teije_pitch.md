# Powers Protocol — Governance Beyond Trust

*A pitch by Teije Hidde Donker*

> Slide-by-slide deck (~12 slides, ~5 min). Each slide has talking-point bullets and a
> speaker note. Fill in `[EVENT / DATE]` on slide 1. Built for an Arbitrum open-house /
> hackathon audience: win the prize, and find partners.

---

## Slide 1 — Title

**Powers Protocol**
*Governance beyond trust.*

- Teije Hidde Donker · Seven Cedars
- `[EVENT NAME — DATE]`
- Live demo · Open source (MIT) · Built on Arbitrum

> *Speaker note:* Open calm and slow. "I want to tell you why a Middle East governance
> scholar ended up writing smart contracts — and why it matters." One sentence, then next.

---

## Slide 2 — Who I am

- I'm a scholar of what I call **governance on the edge**.
- PhD, European University Institute (Florence); Lecturer in Sociology, University of
  Cambridge; postdoc, University of Bergen.
- Four years of fieldwork in the Arab world — **Syria, Tunisia, Turkey, Jordan** —
  around 180 interviews. Fluent Arabic.
- I study how people actually govern themselves when the state is weak, contested, or
  hostile.

> *Speaker note:* Establish founder-fit fast. I'm not a crypto tourist; I've spent my
> career on the exact problem this protocol solves. Don't linger — the credibility is in
> the specifics, not the CV.

---

## Slide 3 — The question I've always asked

- How do people run their day-to-day collective life in **volatile, low-trust, sometimes
  repressive** contexts?
- Where you can't assume the courts are fair, the ministry is neutral, or your neighbour
  won't inform on you.
- Governance there isn't a spreadsheet problem. It's a **trust** problem.

> *Speaker note:* This is the emotional core of the pitch. Slow down. The people I worked
> with didn't lack organisation — they lacked institutions they could trust to execute
> the rules fairly.

---

## Slide 4 — Why crypto governance caught my attention

- Blockchains offer something genuinely new: a substrate where **rules execute exactly as
  written**, regardless of who holds power.
- For the first time, "the rules will be followed" isn't a promise — it's a property of
  the system.
- That's not a financial idea. It's a **governance** idea. And it's the one the space
  keeps under-using.

> *Speaker note:* Bridge from theory to tech. I came to crypto for governance, not for
> tokens or price. That framing sets up my critique.

---

## Slide 5 — My critique of token voting

- **Practically:** token voting is slow, low-participation, and plutocratic — one dollar,
  one vote.
- **Fundamentally:** token voting doesn't put governance *on* the blockchain. It uses
  **economic incentives to simulate** governance.
- It answers "how do we coordinate money?" — not "how do we govern ourselves?"

> *Speaker note:* Keep this crisp and technical, not preachy — some judges are invested in
> token voting. The killer line is: token voting is finance wearing a governance costume.

---

## Slide 6 — The insight

- Use the chain for the one thing it's uniquely good at: **encoding rules and guaranteeing
  their execution.**
- Then governance needs neither **informal personal trust** ("I trust you") nor **formal
  institutional trust** ("I trust the ministry").
- You don't trust people or institutions to follow the rules. The chain follows them.

> *Speaker note:* This is the thesis of the whole pitch. If they remember one slide, make
> it this one. Pause after "The chain follows them."

---

## Slide 7 — What we built: Powers Protocol

- Every action flows through a single hub — **`Powers.sol`**.
- All governance logic lives in swappable external **mandate** contracts: who can propose,
  who vetoes, thresholds, time locks, external conditions.
- **Separation of powers:** one role proposes, another vetoes, a third executes — all
  auditable on-chain.
- **One account, one vote.** No token-weighted voting in the core, ever.

> *Speaker note:* This is the "what is it" slide. Analogy: mandates are LEGO bricks for a
> constitution. Compose them to build any governance structure — without writing new core
> code.

---

## Slide 8 — What's live today (the demo)

- **Live deployed org** — clickable, on Arbitrum Sepolia. *(open the demo link)*
- **`/design-org`** — an AI tool that turns one conversation into a full deployable
  organisation (spec + deploy script + tests).
- **AI governance agent** — an autonomous, guard-railed agent that lives in your
  governance chat, reads proposals, votes, and executes passed actions.
- **XMTP agent** — govern from a group chat. Plus full docs.

> *Speaker note:* This is where I win the prize — show, don't tell. Have the demo already
> open in a tab. One real click beats three slides.

---

## Slide 9 — Who this is for

- Community organising in **weak or repressive states**.
- **Disenfranchised groups** with no access to reliable formal institutions.
- **Transnational social and cultural movements** that cross every jurisdiction.
- **Crypto-native DAOs** that want real separation of powers, not token plutocracy.
- **AI agents** — safely guard-railed *into* human governance, not around it.

> *Speaker note:* The unifying thread: organising **beyond** trust, not **against** it.
> We're not anti-institution — we give people a way to coordinate when institutions aren't
> available or aren't trustworthy.

---

## Slide 10 — Honest scope: a public good

- Let me be straight: this is **not a huge economic opportunity**.
- It is a huge **social and political** one.
- Powers is **public-goods infrastructure** — the plumbing for trustworthy self-governance,
  released open-source under MIT.
- One caveat I hold myself to: we shift *where* trust is needed — we don't pretend to
  abolish it. The rules still have to be written well, and the roles held responsibly.

> *Speaker note:* Owning the "not a big money-maker" line builds credibility — it signals I
> know the difference. The trust caveat pre-empts the sharpest question in the room.

---

## Slide 11 — Sustainability: the Powers CIC

- Powers is sustained by a Community Interest Company that **governs itself using Powers** —
  we run on our own protocol.
- Four funding tiers:
  1. **Grants** — ecosystem and public-goods funding.
  2. **Endowment** — an invested reserve with governed payouts to core work.
  3. **Consulting / deployment services** — the commercial leg: helping organisations
     design and deploy their governance.
  4. **Bounties & hackathon prizes** — like this one.
- Three governed sub-orgs from day one: **Core**, **Mandates**, **Endowment** — each with
  its own proposers, assessors, and emergency stops.

> *Speaker note:* Dogfooding is the proof point: if our governance model can run our own
> treasury, audits, and mandate registry, it can run yours. *(Confirm 4th tier wording with
> Teije — proposed as bounties & prizes.)*

---

## Slide 12 — The ask + why Arbitrum

- **Today:** we're here to win this prize — and to prove the demo works.
- **What we're looking for on Arbitrum:**
  - A **grant** to fund core-protocol and mandate audits.
  - **Pilot partners** — a real organisation to deploy with.
  - **Ecosystem intros** — governance and public-goods teams.
- Arbitrum is the natural home: low-cost execution, a serious governance culture, and a
  public-goods ethos that matches ours.

> *Speaker note:* Close on the mission line: *"Governance shouldn't require you to trust the
> people in power. Let's build the systems that don't."* Then stop talking.

---

## Appendix — facts to have ready

- **Core:** hub-and-mandate architecture; one-account-one-vote; separation of powers;
  Solidity 0.8.30 / Foundry / OpenZeppelin 5; MIT-licensed.
- **Networks:** Ethereum Sepolia, Arbitrum Sepolia, Optimism Sepolia, local Anvil.
- **Repressive-state safety, one-liner:** pseudonymous participation, no token barrier to
  entry, censorship-resistant execution — but users still face on-ramp, key-custody, and
  connectivity realities a chain can't solve alone.
- **Acknowledgements:** Invcbull Audit Group, Arbitrum DAO, RnDAO, and named contributors.

---

## One-minute elevator pitch

*Read aloud, unhurried, ~150 words / ~60 seconds. Learn it, don't recite it.*

> I'm Teije — I spent my career as a scholar studying how people govern themselves in
> places where you can't trust the state: Syria, Tunisia, the Arab Spring. Governance
> there isn't a spreadsheet problem, it's a **trust** problem.
>
> That's why I build on blockchains — not for tokens, but because a chain can encode
> rules and guarantee they execute, no matter who holds power. Most crypto governance
> misses this: token voting just uses money to *simulate* governance. One dollar, one
> vote.
>
> So we built **Powers Protocol**: every action flows through one hub, all the rules
> live in swappable modules, real separation of powers, one account one vote. It's live,
> it's open-source, and there's an AI tool that spins up a whole organisation from a
> single conversation.
>
> Governance shouldn't require you to trust the people in power. We build the systems
> that don't. Can I show you the demo?

> *Speaker note:* The last line — "Can I show you the demo?" — is the whole point of the
> minute: it earns you the next five. For a 30-second cut, drop the token-voting sentence
> and the AI-tool sentence.
