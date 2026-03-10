import { ChatMessageData } from '@/components/ChatMessage';

const KAREN_ADDRESS = '0xKaren0000000000000000000000000000000001';

const t = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const CHAT_SET_1: ChatMessageData[] = [
  { id: 's1-1', sender: 'treasury-mgr.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'The Q2 budget allocation is ready for review. We\'re proposing a 60/40 split between development and community initiatives.', timestamp: t(8, 10), upvotes: 7, downvotes: 0, role: 'Role 1', replies: [
    { id: 's1-1r1', sender: '0x9C4d...bE77', address: '0x9C4d1234567890123456789012345678901bE77', message: 'What was the split last quarter? Want to compare before forming an opinion.', timestamp: t(8, 16), upvotes: 2, downvotes: 0 },
    { id: 's1-1r2', sender: 'treasury-mgr.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'Last quarter was 70/30 favoring development. We shifted more toward community based on feedback from the retrospective.', timestamp: t(8, 20), upvotes: 4, downvotes: 0, role: 'Role 1' },
  ]},
  { id: 's1-2', sender: '0x5fE8...a12B', address: '0x5fE81234567890123456789012345678901a12B', message: 'Can we see a breakdown of the development costs? Last quarter we overspent on infrastructure by about 15%.', timestamp: t(8, 25), upvotes: 4, downvotes: 0 },
  { id: 's1-3', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Good discussion. Please tag all budget-related items with #Budget so we can track them. Keeping this thread clean.', timestamp: t(8, 33), upvotes: 3, downvotes: 0, role: 'Moderator' },
  { id: 's1-4', sender: 'delegate-x.eth', address: '0xBBBB2222CCCC3333DDDD4444EEEE5555FFFF6666', message: 'The infra costs were high because we migrated nodes mid-quarter. That shouldn\'t repeat. #Budget', timestamp: t(8, 45), upvotes: 9, downvotes: 1, role: 'Role 4' },
  { id: 's1-5', sender: '0x9C4d...bE77', address: '0x9C4d1234567890123456789012345678901bE77', message: 'Makes sense. I\'d support the 60/40 split if we add a 10% contingency buffer for unexpected expenses.', timestamp: t(9, 2), upvotes: 6, downvotes: 0 },
  { id: 's1-6', sender: 'community.eth', address: '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333', message: 'The community side could really use more funding for translations and regional meetups. 40% would help a lot. #Budget', timestamp: t(9, 15), upvotes: 8, downvotes: 0, role: 'Role 1' },
  { id: 's1-7', sender: '0xDe82...b1F5', address: '0xDe821234567890123456789012345678901b1F5', message: 'Regional meetups have been our best growth channel. Each one averages 15 new members — worth the investment.', timestamp: t(9, 28), upvotes: 5, downvotes: 0 },
  { id: 's1-8', sender: 'delegate-x.eth', address: '0xBBBB2222CCCC3333DDDD4444EEEE5555FFFF6666', message: 'Can we earmark part of the community budget specifically for translation bounties? That\'s been a bottleneck.', timestamp: t(9, 40), upvotes: 7, downvotes: 0, role: 'Role 4', replies: [
    { id: 's1-8r1', sender: 'treasury-mgr.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'Good idea. I\'ll add a 1.5 ETH line item for translation bounties in the updated proposal.', timestamp: t(9, 45), upvotes: 6, downvotes: 0, role: 'Role 1' },
  ]},
  { id: 's1-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Let\'s wrap up feedback by Friday. Treasury-mgr.eth — please post an updated allocation breakdown by then. #Budget', timestamp: t(9, 55), upvotes: 4, downvotes: 0, role: 'Moderator' },
  { id: 's1-10', sender: 'treasury-mgr.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'Will do. Expect the updated draft with contingency buffer, translation bounties, and regional meetup line items by Thursday EOD.', timestamp: t(10, 8), upvotes: 11, downvotes: 0, role: 'Role 1' },
];

const CHAT_SET_2: ChatMessageData[] = [
  { id: 's2-1', sender: 'ops-lead.eth', address: '0x1122334455667788990011223344556677889900', message: 'We need to vote on the new contributor onboarding process. The current flow has a 40% drop-off rate.', timestamp: t(7, 45), upvotes: 8, downvotes: 0, role: 'Role 2' },
  { id: 's2-2', sender: '0xCc77...d9A1', address: '0xCc771234567890123456789012345678901d9A1', message: 'That drop-off is brutal. Is it the KYC step or the wallet setup that\'s causing friction?', timestamp: t(8, 3), upvotes: 5, downvotes: 0, replies: [
    { id: 's2-2r1', sender: 'ops-lead.eth', address: '0x1122334455667788990011223344556677889900', message: 'Mostly wallet setup. Analytics show 60% of drop-offs happen at the "connect wallet" screen.', timestamp: t(8, 8), upvotes: 6, downvotes: 0, role: 'Role 2' },
  ]},
  { id: 's2-3', sender: 'ops-lead.eth', address: '0x1122334455667788990011223344556677889900', message: 'We\'re exploring a custodial option for the first 30 days so new members can participate immediately.', timestamp: t(8, 18), upvotes: 11, downvotes: 2, role: 'Role 2' },
  { id: 's2-4', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Heads up — the custodial wallet discussion needs its own proposal thread. Please don\'t mix implementation details here. #Ops', timestamp: t(8, 30), upvotes: 3, downvotes: 0, role: 'Moderator' },
  { id: 's2-5', sender: '0xE5f1...b8C3', address: '0xE5f11234567890123456789012345678901b8C3', message: 'Fair point. I\'ll draft a separate proposal for the custodial approach and link it back here.', timestamp: t(9, 0), upvotes: 7, downvotes: 0 },
  { id: 's2-6', sender: '0x9Af4...c2B8', address: '0x9Af41234567890123456789012345678901c2B8', message: 'Has anyone looked at social login options? Some DAOs let people join with just an email and create a wallet behind the scenes.', timestamp: t(9, 15), upvotes: 6, downvotes: 0 },
  { id: 's2-7', sender: 'builder.eth', address: '0xBBBB1111CCCC2222DDDD3333EEEE4444FFFF5555', message: 'We tested social login in a previous project. Conversion was 3x better but it introduced custody concerns. Trade-offs. #Ops', timestamp: t(9, 28), upvotes: 9, downvotes: 1, role: 'Role 1' },
  { id: 's2-8', sender: '0xCc77...d9A1', address: '0xCc771234567890123456789012345678901d9A1', message: 'What if we offer both paths? Self-custody for experienced users, managed wallet for newcomers with a migration path later.', timestamp: t(9, 42), upvotes: 12, downvotes: 0, replies: [
    { id: 's2-8r1', sender: 'ops-lead.eth', address: '0x1122334455667788990011223344556677889900', message: 'Dual-path is more work to maintain but could be the best UX compromise. I\'ll scope it out.', timestamp: t(9, 48), upvotes: 5, downvotes: 0, role: 'Role 2' },
  ]},
  { id: 's2-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Good ideas flowing. Ops-lead.eth — can you compile these options into a comparison doc for the next governance call? #Ops', timestamp: t(10, 0), upvotes: 4, downvotes: 0, role: 'Moderator' },
  { id: 's2-10', sender: 'ops-lead.eth', address: '0x1122334455667788990011223344556677889900', message: 'On it. I\'ll have a comparison table with pros, cons, and estimated implementation effort by Monday.', timestamp: t(10, 12), upvotes: 8, downvotes: 0, role: 'Role 2' },
];

const CHAT_SET_3: ChatMessageData[] = [
  { id: 's3-1', sender: '0x2Af9...c1E5', address: '0x2Af91234567890123456789012345678901c1E5', message: 'Has anyone reviewed the latest security audit results? There were two medium-severity findings.', timestamp: t(6, 50), upvotes: 4, downvotes: 0 },
  { id: 's3-2', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'The audit report is pinned in the documents section. Please review before commenting — we need informed discussion, not speculation. #Security', timestamp: t(7, 10), upvotes: 12, downvotes: 0, role: 'Moderator' },
  { id: 's3-3', sender: 'auditor.eth', address: '0xDDDD1111EEEE2222FFFF3333AAAA4444BBBB5555', message: 'Both findings relate to the token transfer logic. Patches are ready and tested — just need governance approval to deploy.', timestamp: t(7, 25), upvotes: 19, downvotes: 0, role: 'Role 3', replies: [
    { id: 's3-3r1', sender: '0x81De...f4A7', address: '0x81De1234567890123456789012345678901f4A7', message: 'Were the patches reviewed by an external team or just internally?', timestamp: t(7, 32), upvotes: 5, downvotes: 0 },
    { id: 's3-3r2', sender: 'auditor.eth', address: '0xDDDD1111EEEE2222FFFF3333AAAA4444BBBB5555', message: 'External review by Trail of Bits. They signed off on both fixes last Friday.', timestamp: t(7, 36), upvotes: 10, downvotes: 0, role: 'Role 3' },
  ]},
  { id: 's3-4', sender: '0x81De...f4A7', address: '0x81De1234567890123456789012345678901f4A7', message: 'Can we fast-track this through an emergency vote? Leaving known vulnerabilities open seems risky.', timestamp: t(7, 40), upvotes: 8, downvotes: 1 },
  { id: 's3-5', sender: 'validator-node.eth', address: '0x5555666677778888999900001111222233334444', message: 'Emergency vote makes sense here. I\'ll second the motion if someone creates the proposal. #Security', timestamp: t(8, 0), upvotes: 14, downvotes: 0, role: 'Role 2' },
  { id: 's3-6', sender: '0xBb58...a3F1', address: '0xBb581234567890123456789012345678901a3F1', message: 'What\'s the process for an emergency vote? Do we need a quorum or can the security council approve directly?', timestamp: t(8, 12), upvotes: 3, downvotes: 0 },
  { id: 's3-7', sender: 'auditor.eth', address: '0xDDDD1111EEEE2222FFFF3333AAAA4444BBBB5555', message: 'Security council can fast-track with 3/5 multisig approval. Regular quorum takes too long for active vulnerabilities. #Security', timestamp: t(8, 25), upvotes: 11, downvotes: 0, role: 'Role 3' },
  { id: 's3-8', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'I\'ve notified the security council members. Expect a multisig vote within the next 6 hours. Will post updates here.', timestamp: t(8, 38), upvotes: 8, downvotes: 0, role: 'Moderator' },
  { id: 's3-9', sender: '0x2Af9...c1E5', address: '0x2Af91234567890123456789012345678901c1E5', message: 'Should we pause the affected contracts in the meantime as a precaution? The risk seems low but not zero.', timestamp: t(8, 50), upvotes: 6, downvotes: 2 },
  { id: 's3-10', sender: 'validator-node.eth', address: '0x5555666677778888999900001111222233334444', message: 'Pausing isn\'t necessary — the vulnerability requires a very specific attack vector that\'s hard to exploit. Patching is sufficient. #Security', timestamp: t(9, 5), upvotes: 13, downvotes: 0, role: 'Role 2' },
];

const CHAT_SET_4: ChatMessageData[] = [
  { id: 's4-1', sender: 'community.eth', address: '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333', message: 'The new member orientation sessions have been getting great turnout — 30+ attendees each week for the last month.', timestamp: t(10, 0), upvotes: 14, downvotes: 0, role: 'Role 1' },
  { id: 's4-2', sender: '0x7Dc4...e2B1', address: '0x7Dc41234567890123456789012345678901e2B1', message: 'That\'s awesome. Are the sessions recorded? I missed last week and heard there was a great walkthrough of the voting system.', timestamp: t(10, 15), upvotes: 6, downvotes: 0 },
  { id: 's4-3', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Recordings are posted within 48 hours in the resources channel. Please check there before asking — saves everyone time. #Community', timestamp: t(10, 28), upvotes: 5, downvotes: 0, role: 'Moderator' },
  { id: 's4-4', sender: 'delegate-y.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'We should create a permanent knowledge base instead of relying on recordings. Something searchable and structured.', timestamp: t(10, 42), upvotes: 18, downvotes: 1, role: 'Role 4', replies: [
    { id: 's4-4r1', sender: '0x3Ee6...c5A9', address: '0x3Ee61234567890123456789012345678901c5A9', message: 'Notion or GitBook? I\'ve used both — GitBook integrates better with our existing docs workflow.', timestamp: t(10, 48), upvotes: 7, downvotes: 0 },
    { id: 's4-4r2', sender: 'delegate-y.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'GitBook works. Let\'s propose a small budget for it in the next cycle.', timestamp: t(10, 53), upvotes: 5, downvotes: 0, role: 'Role 4' },
  ]},
  { id: 's4-5', sender: '0x3Ee6...c5A9', address: '0x3Ee61234567890123456789012345678901c5A9', message: 'I can help build that out. Already have a template from another DAO that worked well. Will share a draft by Friday.', timestamp: t(11, 0), upvotes: 9, downvotes: 0 },
  { id: 's4-6', sender: 'steward.eth', address: '0x3333444455556666777788889999AAAABBBBCCCC', message: 'A FAQ section would be huge. Half the questions in orientation are the same every week — delegation, voting power, proposal process.', timestamp: t(11, 12), upvotes: 7, downvotes: 0, role: 'Role 2' },
  { id: 's4-7', sender: '0x7Dc4...e2B1', address: '0x7Dc41234567890123456789012345678901e2B1', message: 'Could we also add a glossary? Newcomers always get confused by terms like "epoch", "quorum", and "timelock".', timestamp: t(11, 25), upvotes: 5, downvotes: 0 },
  { id: 's4-8', sender: 'community.eth', address: '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333', message: 'Love the glossary idea. I\'ll start compiling a list of the 30 most commonly asked-about terms. #Community', timestamp: t(11, 38), upvotes: 10, downvotes: 0, role: 'Role 1' },
  { id: 's4-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Great initiative. Let\'s create a working group — community.eth, 0x3Ee6, and delegate-y.eth. Report back in two weeks. #Community', timestamp: t(11, 50), upvotes: 6, downvotes: 0, role: 'Moderator' },
  { id: 's4-10', sender: 'delegate-y.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'Works for me. I\'ll set up a shared doc and schedule our first working session for next Tuesday.', timestamp: t(12, 5), upvotes: 8, downvotes: 0, role: 'Role 4' },
];

const CHAT_SET_5: ChatMessageData[] = [
  { id: 's5-1', sender: '0x6Ab3...d8E2', address: '0x6Ab31234567890123456789012345678901d8E2', message: 'The token distribution from last epoch seems off. My allocation was about 30% lower than expected based on my participation.', timestamp: t(13, 0), upvotes: 3, downvotes: 0 },
  { id: 's5-2', sender: 'risk-council.eth', address: '0xCCCCDDDDEEEEFFFF00001111222233334444AAAA', message: 'There was an adjustment factor applied this epoch to account for the new weighting formula. Check the epoch summary for details. #Rewards', timestamp: t(13, 15), upvotes: 10, downvotes: 0, role: 'Role 2', replies: [
    { id: 's5-2r1', sender: '0x6Ab3...d8E2', address: '0x6Ab31234567890123456789012345678901d8E2', message: 'Where can I find the epoch summary? Is it in the docs or on-chain?', timestamp: t(13, 19), upvotes: 2, downvotes: 0 },
    { id: 's5-2r2', sender: 'risk-council.eth', address: '0xCCCCDDDDEEEEFFFF00001111222233334444AAAA', message: 'Both — there\'s a human-readable version in the docs channel and the raw data is in the epoch contract.', timestamp: t(13, 22), upvotes: 4, downvotes: 0, role: 'Role 2' },
  ]},
  { id: 's5-3', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'The formula change was approved in proposal 34. If you have concerns about your specific allocation, open a support ticket rather than debating numbers here.', timestamp: t(13, 25), upvotes: 7, downvotes: 1, role: 'Moderator' },
  { id: 's5-4', sender: '0x1Fd7...a4C9', address: '0x1Fd71234567890123456789012345678901a4C9', message: 'I checked and it adds up on my end. The new formula weights governance participation more heavily than just showing up.', timestamp: t(13, 38), upvotes: 5, downvotes: 0 },
  { id: 's5-5', sender: '0x6Ab3...d8E2', address: '0x6Ab31234567890123456789012345678901d8E2', message: 'Ah, that explains it — I missed two votes this epoch. Fair enough, will be more active next round.', timestamp: t(13, 50), upvotes: 4, downvotes: 0 },
  { id: 's5-6', sender: 'steward.eth', address: '0x3333444455556666777788889999AAAABBBBCCCC', message: 'The new weighting actually incentivizes the right behavior. People who vote consistently should earn more. #Rewards', timestamp: t(14, 5), upvotes: 12, downvotes: 1, role: 'Role 2' },
  { id: 's5-7', sender: '0xA7c3...b2E4', address: '0xA7c31234567890123456789012345678901b2E4', message: 'Is there a dashboard where we can see our participation score before the epoch ends? Would help people course-correct.', timestamp: t(14, 18), upvotes: 8, downvotes: 0 },
  { id: 's5-8', sender: 'risk-council.eth', address: '0xCCCCDDDDEEEEFFFF00001111222233334444AAAA', message: 'Not yet, but it\'s on the roadmap. The data team is building a real-time participation tracker — ETA is about 3 weeks. #Rewards', timestamp: t(14, 30), upvotes: 9, downvotes: 0, role: 'Role 2' },
  { id: 's5-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'The participation tracker proposal passed last month. If anyone wants to help test the beta, DM the data team lead.', timestamp: t(14, 42), upvotes: 5, downvotes: 0, role: 'Moderator' },
  { id: 's5-10', sender: '0x1Fd7...a4C9', address: '0x1Fd71234567890123456789012345678901a4C9', message: 'I\'d love to beta test. Having visibility into your score mid-epoch would make the whole system feel more transparent.', timestamp: t(14, 55), upvotes: 6, downvotes: 0 },
];

const CHAT_SET_6: ChatMessageData[] = [
  { id: 's6-1', sender: 'infra-lead.eth', address: '0x2222333344445555666677778888999900001111', message: 'RPC node migration is complete. Response times dropped from 800ms to under 200ms. Monitoring for the next 24 hours.', timestamp: t(14, 0), upvotes: 16, downvotes: 0, role: 'Role 1' },
  { id: 's6-2', sender: '0xDe82...b1F5', address: '0xDe821234567890123456789012345678901b1F5', message: 'Nice improvement. Are we running redundant nodes now or still single-region?', timestamp: t(14, 12), upvotes: 6, downvotes: 0 },
  { id: 's6-3', sender: 'infra-lead.eth', address: '0x2222333344445555666677778888999900001111', message: 'Multi-region as of this migration — US East, EU West, and Asia Pacific. Automatic failover is configured. #Infra', timestamp: t(14, 25), upvotes: 12, downvotes: 0, role: 'Role 1', replies: [
    { id: 's6-3r1', sender: '0x9Af4...c2B8', address: '0x9Af41234567890123456789012345678901c2B8', message: 'What\'s the failover time? If a region goes down, how long until traffic reroutes?', timestamp: t(14, 30), upvotes: 3, downvotes: 0 },
    { id: 's6-3r2', sender: 'infra-lead.eth', address: '0x2222333344445555666677778888999900001111', message: 'Under 10 seconds with health checks every 5s. We tested it during the migration — seamless switchover.', timestamp: t(14, 34), upvotes: 8, downvotes: 0, role: 'Role 1' },
  ]},
  { id: 's6-4', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Great work on the migration. Please post the full incident report and performance metrics in the docs channel for the record.', timestamp: t(14, 38), upvotes: 4, downvotes: 0, role: 'Moderator' },
  { id: 's6-5', sender: '0x9Af4...c2B8', address: '0x9Af41234567890123456789012345678901c2B8', message: 'Can confirm — transaction submissions feel noticeably snappier from my end in Europe. Good stuff. #Infra', timestamp: t(15, 0), upvotes: 8, downvotes: 0 },
  { id: 's6-6', sender: 'builder.eth', address: '0xBBBB1111CCCC2222DDDD3333EEEE4444FFFF5555', message: 'The API endpoints are way more responsive too. Our frontend load times dropped by 40% just from the node upgrade.', timestamp: t(15, 12), upvotes: 7, downvotes: 0, role: 'Role 1' },
  { id: 's6-7', sender: '0x8Bc1...e9D7', address: '0x8Bc11234567890123456789012345678901e9D7', message: 'Are we paying more for the multi-region setup? Curious about the cost impact on the infra budget.', timestamp: t(15, 25), upvotes: 4, downvotes: 0 },
  { id: 's6-8', sender: 'infra-lead.eth', address: '0x2222333344445555666677778888999900001111', message: 'About 30% more monthly, but the reliability improvement justifies it. Downtime was costing us more in lost participation. #Infra', timestamp: t(15, 38), upvotes: 10, downvotes: 0, role: 'Role 1' },
  { id: 's6-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Please include the cost comparison in the incident report. The treasury team will want those numbers for next quarter\'s planning.', timestamp: t(15, 50), upvotes: 3, downvotes: 0, role: 'Moderator' },
  { id: 's6-10', sender: '0xDe82...b1F5', address: '0xDe821234567890123456789012345678901b1F5', message: 'Solid work all around. This is the kind of infrastructure investment that compounds over time. #Infra', timestamp: t(16, 5), upvotes: 9, downvotes: 0 },
];

const CHAT_SET_7: ChatMessageData[] = [
  { id: 's7-1', sender: 'culture-dao.eth', address: '0x1111AAAA2222BBBB3333CCCC4444DDDD5555EEEE', message: 'Proposing we sponsor a booth at ETHDenver next year. Budget estimate is around 8 ETH for space, travel, and materials.', timestamp: t(9, 0), upvotes: 13, downvotes: 2, role: 'Role 4' },
  { id: 's7-2', sender: '0xBb58...a3F1', address: '0xBb581234567890123456789012345678901a3F1', message: '8 ETH feels steep. What\'s the expected ROI? Last conference we attended brought in 12 new members total.', timestamp: t(9, 20), upvotes: 7, downvotes: 1, replies: [
    { id: 's7-2r1', sender: 'culture-dao.eth', address: '0x1111AAAA2222BBBB3333CCCC4444DDDD5555EEEE', message: 'Fair question. We\'re targeting 50+ leads this time with a workshop slot, not just a booth. That alone could 3x our conversion.', timestamp: t(9, 26), upvotes: 6, downvotes: 0, role: 'Role 4' },
  ]},
  { id: 's7-3', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Let\'s keep this constructive. If you\'re opposing the budget, please suggest an alternative rather than just criticizing. #Events', timestamp: t(9, 35), upvotes: 5, downvotes: 0, role: 'Moderator' },
  { id: 's7-4', sender: 'council.eth', address: '0xAAAA1111BBBB2222CCCC3333DDDD4444EEEE5555', message: 'We could co-sponsor with two other DAOs to split costs. I have contacts at both — could set up a call this week.', timestamp: t(9, 50), upvotes: 11, downvotes: 0, role: 'Role 2' },
  { id: 's7-5', sender: '0x4Ec9...d6A2', address: '0x4Ec91234567890123456789012345678901d6A2', message: 'Co-sponsoring is smart. Shared booth, shared costs, bigger presence. I\'d vote yes on that approach.', timestamp: t(10, 5), upvotes: 9, downvotes: 0 },
  { id: 's7-6', sender: 'treasury-mgr.eth', address: '0x4444555566667777888899990000AAAABBBBCCCC', message: 'If we co-sponsor, our share drops to about 3 ETH. That\'s well within the events budget without needing a separate vote. #Events', timestamp: t(10, 18), upvotes: 8, downvotes: 0, role: 'Role 1' },
  { id: 's7-7', sender: '0xBb58...a3F1', address: '0xBb581234567890123456789012345678901a3F1', message: 'At 3 ETH I\'m fully on board. The workshop angle is compelling too — much better than just handing out flyers at a booth.', timestamp: t(10, 30), upvotes: 5, downvotes: 0 },
  { id: 's7-8', sender: 'culture-dao.eth', address: '0x1111AAAA2222BBBB3333CCCC4444DDDD5555EEEE', message: 'Perfect. Council.eth — let\'s coordinate the co-sponsor outreach this week. I\'ll prepare a joint proposal deck. #Events', timestamp: t(10, 42), upvotes: 7, downvotes: 0, role: 'Role 4', replies: [
    { id: 's7-8r1', sender: 'council.eth', address: '0xAAAA1111BBBB2222CCCC3333DDDD4444EEEE5555', message: 'Already reached out to both. One confirmed interest, waiting on the other. Should have answers by Wednesday.', timestamp: t(10, 48), upvotes: 6, downvotes: 0, role: 'Role 2' },
  ]},
  { id: 's7-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'This is coming together nicely. Let\'s aim to have the co-sponsor proposal finalized by end of next week. #Events', timestamp: t(11, 0), upvotes: 4, downvotes: 0, role: 'Moderator' },
  { id: 's7-10', sender: '0x4Ec9...d6A2', address: '0x4Ec91234567890123456789012345678901d6A2', message: 'Looking forward to it. ETHDenver is going to be a great opportunity for visibility if we execute well.', timestamp: t(11, 15), upvotes: 6, downvotes: 0 },
];

const CHAT_SET_8: ChatMessageData[] = [
  { id: 's8-1', sender: '0xA7c3...b2E4', address: '0xA7c31234567890123456789012345678901b2E4', message: 'The delegation dashboard is showing stale data — my voting power hasn\'t updated in three days.', timestamp: t(15, 0), upvotes: 4, downvotes: 0 },
  { id: 's8-2', sender: 'epoch-keeper.eth', address: '0x6666AAAA7777BBBB8888CCCC9999DDDD0000EEEE', message: 'Known issue — the indexer fell behind after the chain reorg on Monday. Team is resyncing now, should be fixed by EOD. #Technical', timestamp: t(15, 18), upvotes: 12, downvotes: 0, role: 'Role 2' },
  { id: 's8-3', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Status updates on the indexer fix will be posted hourly. Please don\'t spam this channel with "is it fixed yet" messages.', timestamp: t(15, 30), upvotes: 6, downvotes: 0, role: 'Moderator' },
  { id: 's8-4', sender: '0x8Bc1...e9D7', address: '0x8Bc11234567890123456789012345678901e9D7', message: 'Does this affect active vote tallies or just the dashboard display? Want to make sure ongoing proposals aren\'t impacted.', timestamp: t(15, 45), upvotes: 9, downvotes: 0, replies: [
    { id: 's8-4r1', sender: 'epoch-keeper.eth', address: '0x6666AAAA7777BBBB8888CCCC9999DDDD0000EEEE', message: 'Just the display. On-chain vote tallies are pulled directly from the contract, completely separate from the indexer.', timestamp: t(15, 50), upvotes: 11, downvotes: 0, role: 'Role 2' },
    { id: 's8-4r2', sender: '0x8Bc1...e9D7', address: '0x8Bc11234567890123456789012345678901e9D7', message: 'Good to know. Thanks for the quick clarification.', timestamp: t(15, 53), upvotes: 3, downvotes: 0 },
  ]},
  { id: 's8-5', sender: 'epoch-keeper.eth', address: '0x6666AAAA7777BBBB8888CCCC9999DDDD0000EEEE', message: 'Update: indexer is back in sync as of 10 minutes ago. Dashboard should reflect current state now. #Technical', timestamp: t(16, 0), upvotes: 15, downvotes: 0, role: 'Role 2' },
  { id: 's8-6', sender: '0xA7c3...b2E4', address: '0xA7c31234567890123456789012345678901b2E4', message: 'Confirmed — my voting power is showing correctly now. Thanks for the fast turnaround.', timestamp: t(16, 12), upvotes: 4, downvotes: 0 },
  { id: 's8-7', sender: 'infra-lead.eth', address: '0x2222333344445555666677778888999900001111', message: 'We should add alerting so the team gets notified automatically when the indexer falls behind. Prevents this from happening silently. #Technical', timestamp: t(16, 25), upvotes: 10, downvotes: 0, role: 'Role 1' },
  { id: 's8-8', sender: 'epoch-keeper.eth', address: '0x6666AAAA7777BBBB8888CCCC9999DDDD0000EEEE', message: 'Agreed. I\'ll add PagerDuty integration this week so we get alerted if the indexer is more than 50 blocks behind. #Technical', timestamp: t(16, 38), upvotes: 8, downvotes: 0, role: 'Role 2', replies: [
    { id: 's8-8r1', sender: 'infra-lead.eth', address: '0x2222333344445555666677778888999900001111', message: 'Perfect. Let\'s also add a public status page so users can check service health without asking in chat.', timestamp: t(16, 44), upvotes: 7, downvotes: 0, role: 'Role 1' },
  ]},
  { id: 's8-9', sender: 'karen.eth', address: KAREN_ADDRESS, message: 'Excellent response time on this incident. Let\'s do a brief post-mortem writeup so we can prevent future reorg-related issues. #Technical', timestamp: t(16, 55), upvotes: 5, downvotes: 0, role: 'Moderator' },
  { id: 's8-10', sender: '0x8Bc1...e9D7', address: '0x8Bc11234567890123456789012345678901e9D7', message: 'The status page idea is great. Transparency builds trust — especially for newer members who might panic when things look broken.', timestamp: t(17, 8), upvotes: 6, downvotes: 0 },
];

const ALL_CHAT_SETS = [CHAT_SET_1, CHAT_SET_2, CHAT_SET_3, CHAT_SET_4, CHAT_SET_5, CHAT_SET_6, CHAT_SET_7, CHAT_SET_8];

/** Returns a deterministic chat set based on mandate ID */
export function getMandateChatMessages(mandateId: string): ChatMessageData[] {
  let hash = 0;
  for (let i = 0; i < mandateId.length; i++) {
    hash = ((hash << 5) - hash + mandateId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % ALL_CHAT_SETS.length;
  return ALL_CHAT_SETS[index];
}

export const MANDATE_CHAT_MESSAGES = CHAT_SET_1;
