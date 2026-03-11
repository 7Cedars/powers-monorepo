 // Mock Sub-DAO data for proof-of-concept
 export interface SubDAO {
   id: string;
   name: string;
   parentDao: string;
   description: string;
   isActive: boolean;
   memberCount: number;
   createdAt: Date;
   expiresAt?: Date;
 }
 
 export interface SubDAOMessage {
   id: string;
   sender: string;
   address: string;
   message: string;
   timestamp: Date;
 }
 
 export const MOCK_SUB_DAOS: SubDAO[] = [
   {
     id: 'ideas-dao-7',
     name: 'IdeasDAO #7: Project Orange',
     parentDao: 'The Cultural Stewardship DAO',
     description: 'A creative collective exploring ideas around the colour orange - from its cultural significance to its use in visual storytelling.',
     isActive: true,
     memberCount: 23,
     createdAt: new Date(Date.now() - 86400000 * 90),
   },
   {
     id: 'heritage-archive-1',
     name: 'Heritage Archive Initiative',
     parentDao: 'The Cultural Stewardship DAO',
     description: 'Dedicated to preserving and digitizing cultural artifacts and oral histories.',
     isActive: true,
     memberCount: 45,
     createdAt: new Date(Date.now() - 86400000 * 180),
   },
   {
     id: 'visual-stories-3',
     name: 'Visual Stories Collective',
     parentDao: 'The Cultural Stewardship DAO',
     description: 'Filmmakers and photographers documenting cultural narratives worldwide.',
     isActive: true,
     memberCount: 31,
     createdAt: new Date(Date.now() - 86400000 * 120),
   },
   {
     id: 'sound-heritage-2',
     name: 'Sound Heritage Lab',
     parentDao: 'The Cultural Stewardship DAO',
     description: 'Preserving endangered musical traditions and acoustic heritage.',
     isActive: false,
     memberCount: 18,
     createdAt: new Date(Date.now() - 86400000 * 365),
     expiresAt: new Date(Date.now() - 86400000 * 30),
   },
   {
     id: 'textile-memory-5',
     name: 'Textile Memory Project',
     parentDao: 'The Cultural Stewardship DAO',
     description: 'Documenting traditional weaving and textile techniques.',
     isActive: false,
     memberCount: 12,
     createdAt: new Date(Date.now() - 86400000 * 200),
     expiresAt: new Date(Date.now() - 86400000 * 15),
   },
 ];
 
 // The demo user is a member of this Sub-DAO
 export const USER_SUB_DAO_MEMBERSHIPS = ['ideas-dao-7'];
 
 export const MOCK_SUB_DAO_MESSAGES: Record<string, SubDAOMessage[]> = {
   'ideas-dao-7': [
     {
       id: '1',
       sender: 'curator.eth',
       address: '0x1234...abcd',
       message: 'gm team. excited to kick off Project Orange.',
       timestamp: new Date(Date.now() - 3600000 * 24),
     },
     {
       id: '2',
       sender: 'participant.eth',
       address: '0xe580...2b11',
       message: 'thinking about orange as a liminal colour - between red and yellow, fire and sun.',
       timestamp: new Date(Date.now() - 3600000 * 20),
     },
     {
       id: '3',
       sender: '0xbeef...cafe',
       address: '0xbeef...cafe',
       message: 'the dutch royal house chose orange for a reason. there is heritage weight there.',
       timestamp: new Date(Date.now() - 3600000 * 16),
     },
     {
       id: '4',
       sender: 'archivist.eth',
       address: '0x9999...1111',
       message: 'uploaded some saffron textile samples to the shared vault.',
       timestamp: new Date(Date.now() - 3600000 * 8),
     },
   ],
   'heritage-archive-1': [
     {
       id: '1',
       sender: 'keeper.eth',
       address: '0xaaaa...bbbb',
       message: 'new batch of oral histories uploaded from the field team.',
       timestamp: new Date(Date.now() - 3600000 * 48),
     },
     {
       id: '2',
       sender: 'digizen.eth',
       address: '0xcccc...dddd',
       message: 'working on metadata standards for the next release.',
       timestamp: new Date(Date.now() - 3600000 * 24),
     },
   ],
   'visual-stories-3': [
     {
       id: '1',
       sender: 'lens.eth',
       address: '0x5555...6666',
       message: 'documentary edit is 80% complete. sharing rough cut tomorrow.',
       timestamp: new Date(Date.now() - 3600000 * 12),
     },
   ],
   'sound-heritage-2': [
     {
       id: '1',
       sender: 'sonic.eth',
       address: '0x7777...8888',
       message: '[ARCHIVED] final recordings uploaded before sunset.',
       timestamp: new Date(Date.now() - 86400000 * 35),
     },
   ],
   'textile-memory-5': [
     {
       id: '1',
       sender: 'weaver.eth',
       address: '0x3333...4444',
       message: '[ARCHIVED] project concluded. all patterns documented.',
       timestamp: new Date(Date.now() - 86400000 * 20),
     },
   ],
 };