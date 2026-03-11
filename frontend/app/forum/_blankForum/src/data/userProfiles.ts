export interface UserProfileData {
  displayName: string;
  ensName?: string;
  address: string;
  bio: string;
  daoRoles: { dao: string; role: string; since: string }[];
}

/**
 * Lookup table keyed by ENS name or address.
 * In production this would come from an API — for now it's mock data.
 */
const PROFILES: Record<string, UserProfileData> = {
  'karen.eth': {
    displayName: 'Karen',
    ensName: 'karen.eth',
    address: '0xKaren0000000000000000000000000000000001',
    bio: 'Community moderator. Keeping things civil since 2022.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Moderator', since: '2022-06' },
    ],
  },
  'builder.eth': {
    displayName: 'Builder',
    ensName: 'builder.eth',
    address: '0xBBBB1111CCCC2222DDDD3333EEEE4444FFFF5555',
    bio: 'Full-stack contributor building governance tooling.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 1', since: '2024-01' },
    ],
  },
  'treasury-mgr.eth': {
    displayName: 'Treasury Manager',
    ensName: 'treasury-mgr.eth',
    address: '0x4444555566667777888899990000AAAABBBBCCCC',
    bio: 'Managing DAO treasury operations and budget allocation.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 1', since: '2023-05' },
    ],
  },
  'ops-lead.eth': {
    displayName: 'Ops Lead',
    ensName: 'ops-lead.eth',
    address: '0x1122334455667788990011223344556677889900',
    bio: 'Operations lead — onboarding, tooling, and process design.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 2', since: '2023-08' },
    ],
  },
  'auditor.eth': {
    displayName: 'Auditor',
    ensName: 'auditor.eth',
    address: '0xDDDD1111EEEE2222FFFF3333AAAA4444BBBB5555',
    bio: 'Security auditor and smart-contract reviewer.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 3', since: '2023-03' },
    ],
  },
  'delegate-x.eth': {
    displayName: 'Delegate X',
    ensName: 'delegate-x.eth',
    address: '0xBBBB2222CCCC3333DDDD4444EEEE5555FFFF6666',
    bio: 'Active delegate representing token-holder interests.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 4', since: '2024-02' },
    ],
  },
  'delegate-y.eth': {
    displayName: 'Delegate Y',
    ensName: 'delegate-y.eth',
    address: '0x4444555566667777888899990000AAAABBBBCCCC',
    bio: 'Community delegate focused on education and knowledge sharing.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 4', since: '2023-12' },
    ],
  },
  'community.eth': {
    displayName: 'Community',
    ensName: 'community.eth',
    address: '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333',
    bio: 'Running community programs, events, and onboarding.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 1', since: '2023-07' },
    ],
  },
  'risk-council.eth': {
    displayName: 'Risk Council',
    ensName: 'risk-council.eth',
    address: '0xCCCCDDDDEEEEFFFF00001111222233334444AAAA',
    bio: 'Risk assessment and token economics oversight.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 2', since: '2023-09' },
    ],
  },
  'infra-lead.eth': {
    displayName: 'Infra Lead',
    ensName: 'infra-lead.eth',
    address: '0x2222333344445555666677778888999900001111',
    bio: 'Infrastructure and DevOps — keeping the nodes running.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 1', since: '2023-04' },
    ],
  },
  'culture-dao.eth': {
    displayName: 'Culture DAO',
    ensName: 'culture-dao.eth',
    address: '0x1111AAAA2222BBBB3333CCCC4444DDDD5555EEEE',
    bio: 'Championing DAO culture, events, and IRL meetups.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 4', since: '2024-01' },
    ],
  },
  'council.eth': {
    displayName: 'Council',
    ensName: 'council.eth',
    address: '0xAAAA1111BBBB2222CCCC3333DDDD4444EEEE5555',
    bio: 'Governance council member and cross-DAO liaison.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 2', since: '2023-06' },
    ],
  },
  'epoch-keeper.eth': {
    displayName: 'Epoch Keeper',
    ensName: 'epoch-keeper.eth',
    address: '0x6666AAAA7777BBBB8888CCCC9999DDDD0000EEEE',
    bio: 'Maintaining epoch infrastructure and indexing services.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 2', since: '2023-10' },
    ],
  },
  'validator-node.eth': {
    displayName: 'Validator Node',
    ensName: 'validator-node.eth',
    address: '0x5555666677778888999900001111222233334444',
    bio: 'Node operator and protocol validator.',
    daoRoles: [
      { dao: '[DAO NAME]', role: 'Role 2', since: '2023-02' },
    ],
  },
};

/**
 * Look up a user profile by sender name (ENS) or address.
 * Returns undefined when no profile is found.
 */
export function getUserProfile(senderOrAddress: string): UserProfileData | undefined {
  // Try direct key match (ENS name)
  if (PROFILES[senderOrAddress]) return PROFILES[senderOrAddress];
  // Try matching by address
  return Object.values(PROFILES).find(
    (p) => p.address.toLowerCase() === senderOrAddress.toLowerCase(),
  );
}
