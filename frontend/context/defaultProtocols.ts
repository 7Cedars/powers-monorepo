import { Powers } from './types'

/**
 * Default Powers 101 protocol
 * 
 * A simple DAO with basic governance based on a separation of powers between 
 * delegates, an executive council and an admin. It is a good starting point 
 * for understanding the Powers protocol.
 */
export const defaultPowers101: Powers = {
  contractAddress: '0x49cf94fc23ba8f6dffea883b7a260ce3cf97bf91' as `0x${string}`,
  chainId: 11155111n,
  name: 'Powers 101',
  uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/powers101.json",
  metadatas: {
    icon: '/logo1_notext.png',
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/powers101.png",
    description: "A simple DAO with basic governance based on a separation of powers between delegates, an executive council and an admin. It is a good starting point for understanding the Powers protocol.",
    attributes: []
  },
  mandateCount: 0n,
  mandates: [],
  roles: [],
}

/**
 * Default Governed 721 DAO protocol
 * 
 * An example of an organisation that governs specific functionality in a Protocol. 
 * In this case: setting payment split for royalties of NFT sales. 
 * It has a policy setting (the split) and enforcement (blacklisting of addresses). 
 */
export const Governed721DAO: Powers = {
  contractAddress: '0x3C9BdC75Fb5b89Ef2d80AC2A21b06aFC80726EEC' as `0x${string}`,
  chainId: 11155111n,
  name: 'Governed 721 DAO',
  uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidklnn4b7heysrhr5pqtiabvcl5aldnzuv2mdybotdtx5vvq44nqi",
  metadatas: {
    icon: '/logo1_notext.png',
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiboosk4qnbeazftgdjppcuwunlxvatph5aobajj6txbcgcy3p33cu/organisation.png",
    description: "An example of an organisation that governs specific functionality in a Protocol. In this case: setting payment split for royalties of NFT sales. It has a policy setting (the split) and enforcement (blacklisting of addresses).",
    attributes: []
  },
  mandateCount: 0n,
  mandates: [],
  roles: [],
}

/**
 * Default Cultural Stewards DAO protocol
 * 
 * An example of an organisation that governs specific functionality in a Protocol. 
 * In this case: setting payment split for royalties of NFT sales. 
 * It has a policy setting (the split) and enforcement (blacklisting of addresses). 
 */
export const CulturalStewardsDAO: Powers = {
  contractAddress: '0x35f9418b033ab695AAC48793b1E011187b521Ca7' as `0x${string}`,
  chainId: 11155111n,
  name: 'Primary DAO',
  uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeifpvurtqfawksmflqgm342fdsvmmtme2pjzzlvdr7vippeygfy3au/primaryDao.json",
  metadatas: {
    icon: '/logo1_notext.png',
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeigawgiso7mndeswvhxgmkad2dg4fduwyojsk5zl5cz2lyyxc7jvae/primaryDao.png",
    description: "The Cultural Stewardship Experiment is a multi-layered ecosystem designed to foster an interplay between ideational concepts, physical spaces, and digital manifestations. It is an example of the type of complex ecosystems that can be governed through the Powers Protocol.",
    attributes: []
  },
  mandateCount: 0n,
  mandates: [],
  roles: [],
}




// £TODO: adding new Powers Labs governance demo protocol here once deployed.