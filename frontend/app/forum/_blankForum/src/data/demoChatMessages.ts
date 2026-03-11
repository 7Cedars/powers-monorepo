import { ChatMessageData } from '@/components/ChatMessage';

const KAREN_ADDRESS = '0xKaren0000000000000000000000000000000001';

const t = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

export const DEMO_CHAT_MESSAGES: ChatMessageData[] = [
  {
    id: 'c1',
    sender: 'builder.eth',
    address: '0xBBBB1111CCCC2222DDDD3333EEEE4444FFFF5555',
    message: 'Hey everyone — just submitted the proposal draft for the community grants program. Would love feedback before it goes to vote.',
    timestamp: t(9, 4),
    upvotes: 6,
    downvotes: 0,
    role: 'Role 1',
    replies: [
      { id: 'c1r1', sender: '0xAb12...7c9D', address: '0xAb121234567890123456789012345678907c9D', message: 'Looks solid overall. One concern — the evaluation criteria feels subjective. Can we add measurable KPIs?', timestamp: t(9, 9), upvotes: 3, downvotes: 0 },
      { id: 'c1r2', sender: 'builder.eth', address: '0xBBBB1111CCCC2222DDDD3333EEEE4444FFFF5555', message: 'Good call — I\'ll add a scoring rubric with specific metrics for each grant category.', timestamp: t(9, 13), upvotes: 5, downvotes: 0, role: 'Role 1' },
    ],
  },
  {
    id: 'c2',
    sender: '0x7F3a...b21C',
    address: '0x7F3a8c9D4e5B6a1C2d3E4f5A6b7C8d9E0f1Ab21C',
    message: 'Read through it — the milestone structure looks solid but I think the reporting cadence should be monthly instead of quarterly.',
    timestamp: t(9, 17),
    upvotes: 4,
    downvotes: 1,
  },
  {
    id: 'c3',
    sender: 'karen.eth',
    address: KAREN_ADDRESS,
    message: 'Reminder: please keep discussion focused on the proposal specifics. Off-topic messages will be flagged. #Governance',
    timestamp: t(9, 22),
    upvotes: 8,
    downvotes: 0,
    role: 'Moderator',
  },
  {
    id: 'c4',
    sender: 'steward.eth',
    address: '0x3333444455556666777788889999AAAABBBBCCCC',
    message: 'Agree with monthly reporting. Also — should we cap individual grants at 5 ETH or leave it flexible for the committee to decide?',
    timestamp: t(9, 35),
    upvotes: 11,
    downvotes: 2,
    role: 'Role 2',
    profileLink: '/user/steward.eth',
  },
  {
    id: 'c5',
    sender: '0xAb12...7c9D',
    address: '0xAb121234567890123456789012345678907c9D',
    message: 'Flexible cap makes more sense — some projects legitimately need more. Maybe set a soft cap with committee override.',
    timestamp: t(9, 48),
    upvotes: 5,
    downvotes: 0,
  },
  {
    id: 'c6',
    sender: 'delegate-x.eth',
    address: '0xBBBB2222CCCC3333DDDD4444EEEE5555FFFF6666',
    message: 'What about requiring grantees to present progress at the monthly town hall? Keeps accountability public. #Governance',
    timestamp: t(10, 5),
    upvotes: 9,
    downvotes: 0,
    role: 'Role 4',
  },
  {
    id: 'c7',
    sender: '0xDe82...b1F5',
    address: '0xDe821234567890123456789012345678901b1F5',
    message: 'Town hall presentations are a good idea but could slow things down. Maybe written updates with optional live demos?',
    timestamp: t(10, 18),
    upvotes: 3,
    downvotes: 1,
    replies: [
      { id: 'c7r1', sender: 'delegate-x.eth', address: '0xBBBB2222CCCC3333DDDD4444EEEE5555FFFF6666', message: 'Written updates work as a baseline. Live demos could be opt-in for teams that want community feedback.', timestamp: t(10, 24), upvotes: 4, downvotes: 0, role: 'Role 4' },
    ],
  },
  {
    id: 'c8',
    sender: 'treasury-mgr.eth',
    address: '0x4444555566667777888899990000AAAABBBBCCCC',
    message: 'From a treasury perspective, we have enough runway for 12 grants at 3 ETH average. That aligns with the proposed budget.',
    timestamp: t(10, 35),
    upvotes: 7,
    downvotes: 0,
    role: 'Role 1',
  },
  {
    id: 'c9',
    sender: 'karen.eth',
    address: KAREN_ADDRESS,
    message: 'Great progress on this thread. Builder.eth — can you post an updated draft by end of week incorporating the feedback? #Governance',
    timestamp: t(10, 50),
    upvotes: 6,
    downvotes: 0,
    role: 'Moderator',
  },
  {
    id: 'c10',
    sender: 'builder.eth',
    address: '0xBBBB1111CCCC2222DDDD3333EEEE4444FFFF5555',
    message: 'Will do — updated draft by Friday with monthly reporting, soft cap + committee override, and written update requirements. Thanks everyone.',
    timestamp: t(11, 2),
    upvotes: 14,
    downvotes: 0,
    role: 'Role 1',
  },
];
