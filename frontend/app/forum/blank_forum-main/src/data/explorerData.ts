export interface PortalDAO {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  route: string; // internal route or external URL
  isInternal: boolean;
}

export const EXPLORER_DAOS: PortalDAO[] = [
  {
    id: 'cultural-stewardship',
    name: 'The Cultural Stewardship DAO',
    description: 'Preserving and celebrating cultural heritage through decentralised governance and collaborative storytelling.',
    memberCount: 129,
    category: 'Culture',
    route: '/portal',
    isInternal: true,
  },
  {
    id: 'open-science-collective',
    name: 'Open Science Collective',
    description: 'Funding and coordinating open-source scientific research across disciplines.',
    memberCount: 312,
    category: 'Science',
    route: '#',
    isInternal: false,
  },
  {
    id: 'regen-land-dao',
    name: 'RegenLand DAO',
    description: 'Regenerative agriculture projects governed by land stewards and ecological researchers.',
    memberCount: 87,
    category: 'Environment',
    route: '#',
    isInternal: false,
  },
  {
    id: 'builders-guild',
    name: 'The Builders Guild',
    description: 'A coordination layer for open-source developers building public goods infrastructure.',
    memberCount: 204,
    category: 'Technology',
    route: '#',
    isInternal: false,
  },
  {
    id: 'music-commons',
    name: 'Music Commons DAO',
    description: 'Collective ownership and fair distribution for independent musicians and producers.',
    memberCount: 156,
    category: 'Music',
    route: '#',
    isInternal: false,
  },
  {
    id: 'civic-futures',
    name: 'Civic Futures Lab',
    description: 'Experimental governance models for local communities and civic participation.',
    memberCount: 63,
    category: 'Governance',
    route: '#',
    isInternal: false,
  },
];
