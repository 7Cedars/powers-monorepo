// DAO and Sub-DAO configuration data

export interface DaoMandate {
  id: string;
  name: string;
  description: string;
  active?: boolean;
  flowId: string;
}

export interface DaoChatMessage {
  id: string;
  sender: string;
  address: string;
  message: string;
  timestamp: Date;
  role?: string;
}

export interface DaoConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  mandates: DaoMandate[];
  chatMessages: DaoChatMessage[];
}

export const DAO_CONFIGS: DaoConfig[] = [
  {
    id: 'primary-dao',
    name: 'DAO #0',
    slug: 'primary-dao',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    memberCount: 1248,
    mandates: [
      // Flow 1 (3 mandates)
      { id: 'p1', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-1' },
      { id: 'p2', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-1' },
      { id: 'p3', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-1' },
      // Flow 3 (1 mandate)
      { id: 'p4', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-3' },
      // Flow 6 (2 mandates)
      { id: 'p5', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-6' },
      { id: 'p6', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-6' },
      // Flow 8 (5 mandates)
      { id: 'p7', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-8' },
      { id: 'p8', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-8' },
      { id: 'p9', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-8' },
      { id: 'p10', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-8' },
      { id: 'p11', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-8' },
      // Flow 11 (4 mandates)
      { id: 'p12', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-11' },
      { id: 'p13', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-11' },
      { id: 'p14', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-11' },
      { id: 'p15', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-11' },
      // Flow 15 (1 mandate) — active
      { id: 'p16', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-15' },
      // Flow 17 (4 mandates) — active
      { id: 'p17', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-17' },
      { id: 'p18', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-17' },
      { id: 'p19', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-17' },
      { id: 'p20', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-17' },
    ],
    chatMessages: [],
  },
  {
    id: 'sub-dao-1',
    name: 'DAO #1',
    slug: 'sub-dao-1',
    description: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    memberCount: 35,
    mandates: [
      // Flow 2 (2 mandates)
      { id: 'd1', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-2' },
      { id: 'd2', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-2' },
      // Flow 7 (1 mandate)
      { id: 'd3', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-7' },
      // Flow 10 (3 mandates)
      { id: 'd4', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-10' },
      { id: 'd5', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-10' },
      { id: 'd6', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-10' },
      // Flow 16 (2 mandates)
      { id: 'd7', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-16' },
      // Flow 18 (2 mandates) — active
      { id: 'd8', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-18' },
      { id: 'd9', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-18' },
      // Flow 20 (1 mandate) — active
      { id: 'd10', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-20' },
    ],
    chatMessages: [],
  },
  {
    id: 'sub-dao-2',
    name: 'DAO #2',
    slug: 'sub-dao-2',
    description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    memberCount: 610,
    mandates: [
      // Flow 5 (2 mandates)
      { id: 'i1', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-5' },
      { id: 'i2', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-5' },
      // Flow 12 (1 mandate)
      { id: 'i3', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-12' },
      // Flow 19 (2 mandates) — active
      { id: 'i4', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-19' },
      { id: 'i5', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-19' },
    ],
    chatMessages: [],
  },
  {
    id: 'sub-dao-3',
    name: 'DAO #3',
    slug: 'sub-dao-3',
    description: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    memberCount: 967,
    mandates: [
      // Flow 4 (4 mandates)
      { id: 'ph1', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-4' },
      { id: 'ph2', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-4' },
      { id: 'ph3', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-4' },
      { id: 'ph4', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-4' },
      // Flow 9 (2 mandates)
      { id: 'ph5', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-9' },
      { id: 'ph6', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: false, flowId: 'flow-9' },
      // Flow 14 (2 mandates) — active
      { id: 'ph7', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-14' },
      { id: 'ph8', name: '[MANDATE NAME]', description: 'Placeholder mandate description.', active: true, flowId: 'flow-14' },
    ],
    chatMessages: [],
  },
];

export function getDaoConfigBySlug(slug: string): DaoConfig | undefined {
  return DAO_CONFIGS.find((dao) => dao.slug === slug);
}
