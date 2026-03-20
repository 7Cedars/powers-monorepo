import { Powers } from './types'

/**
 * Default Powers 101 protocol
 * 
 * A simple DAO with basic governance based on a separation of powers between 
 * delegates, an executive council and an admin. It is a good starting point 
 * for understanding the Powers protocol.
 */
export const defaultPowers101: Powers = {
  contractAddress: '0x1571A0F747c1E93889bbDfe7b44A60cC56a83cBA' as `0x${string}`,
  chainId: 11155111n,
  name: 'Powers 101',
  uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreicbh6txnypkoy6ivngl3l2k6m646hruupqspyo7naf2jpiumn2jqe",
  metadatas: {
    icon: '/logo1_notext.png',
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeickdiqcdmjjwx6ah6ckuveufjw6n2g6qdvatuhxcsbmkub3pvshnm",
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
 * An example of an organisaiton that govens specific functionality in a Protocol. 
 * In this case: setting payment split for royalties of NFT sales. 
 * It has a policy setting (the split) and enforcement (blacklisting of addresses). 
 */
export const Governed721DAO: Powers = {
  contractAddress: '0x1571A0F747c1E93889bbDfe7b44A60cC56a83cBA' as `0x${string}`,
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
 * An example of an organisaiton that govens specific functionality in a Protocol. 
 * In this case: setting payment split for royalties of NFT sales. 
 * It has a policy setting (the split) and enforcement (blacklisting of addresses). 
 */
export const CulturalStewardsDAO: Powers = {
  contractAddress: '0x83D2a716e6881a2364E7e05EAfA75fd47B9589A3' as `0x${string}`,
  chainId: 11155111n,
  name: 'Cultural Stewards DAO',
  uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeifpvurtqfawksmflqgm342fdsvmmtme2pjzzlvdr7vippeygfy3au/primaryDao.json",
  metadatas: {
    icon: '/logo1_notext.png',
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeigawgiso7mndeswvhxgmkad2dg4fduwyojsk5zl5cz2lyyxc7jvae/primaryDao.png",
    description: "The Cultural Stewardship DAO is a multi-layered ecosystem designed to foster an interplay between  ideational concepts, physical spaces, and digital manifestations.",
    attributes: []
  },
  mandateCount: 0n,
  mandates: [],
  roles: [],
}

/**
 * Default Digital Sub DAO protocol
 * 
 * An example of an organisaiton that govens specific functionality in a Protocol. 
 * In this case: setting payment split for royalties of NFT sales. 
 * It has a policy setting (the split) and enforcement (blacklisting of addresses). 
 */
export const DigitalSubDAO: Powers = {
  contractAddress: '0x9Bd3d0a48CE86781428dAd2a70C4e84a6b737B6b' as `0x${string}`,
  chainId: 11155111n,
  name: 'Digital Sub DAO',
  uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeifpvurtqfawksmflqgm342fdsvmmtme2pjzzlvdr7vippeygfy3au/digitalSubDao.json",
  metadatas: {
    icon: '/logo1_notext.png',
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeigawgiso7mndeswvhxgmkad2dg4fduwyojsk5zl5cz2lyyxc7jvae/digitalSubDao.png",
    description: "Manages code repositories, commits, and digital representation of the organisation and its sub-DAOs. The parent DAO holds some veto powers over this DAO.",
    attributes: []
  },
  mandateCount: 0n,
  mandates: [],
  roles: [],
}



// £TODO: adding new Powers Labs governance demo protocol here once deployed.