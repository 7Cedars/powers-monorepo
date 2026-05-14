import { sepolia, arbitrumSepolia, optimismSepolia, foundry } from "@wagmi/core/chains";

export const DeployedExamples = [
    {
        id: "powers101",
        title: "Powers 101",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/powers101.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/powers101.png",
        description: "A base example of an on-chain organisation that uses the Powers protocol to govern itself and create a simple check and balance system.",
        chainId: sepolia.id,
        address: '0x58e5c5ec3E6Baea5c886841988c7b16a954b20c7'
    },
    {
        id: "bicameralism",
        title: "Bicameralism",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/bicameralism.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/bicameralism.png",
        description: "In Bicameralism, the governance system is divided into two separate chambers or houses, each with its own distinct powers and responsibilities. In this example Delegates can initiate an action, but it can only be executed by Funders. A version of Bicameralism is implemented at the Optimism Collective.",
        chainId: sepolia.id,
        address: '0x77d2438550804f227D023F49a93F55350817c97e'
    },
    {
        id: "optimistic-execution",
        title: "Optimistic Execution",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/optimisticExecution.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/optimisticExecution.png",
        description: "In Optimistic Execution, the Powers protocol leverages optimistic mechanisms to enable faster decision-making processes by assuming proposals are valid unless challenged. This approach can improve efficiency while still allowing for dispute resolution through challenges. A similar mechanism is currently used by the Optimism Collective.",
        chainId: sepolia.id,
        address: '0xe431F2153c877C49431476deBA83B7310Dc24DdF'
    },
    {
        id: "nested-governance-parent",
        title: "Nested Governance",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/nestedGovernance-parent.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/nestedGovernance-parent.png",
        description: "Nested Governance demonstrates how the Powers protocol can be used to layer governance within each other to create complex decision-making hierarchies. This example is a single parent organisation that governs a child, but any type of complex structure can be created. The notion of sub-DAOs is similar to nested governance.",
        chainId: sepolia.id,
        address: '0xFAFDCb9cba9d39506A2e09A069063Be30Bc55877' 
    },
    {
        id: "open-elections",
        title: "Election Lists",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/electionListDao.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/electionListDao.png",
        description: "Election lists demonstrates how, using the Powers protocol, electoral lists can be used to assign roles to accounts. (These type of approaches are becoming more popular, see for instance the elections for Arbitrum's Security council, or multiple options votes). The specific logic used for an electoral list can be customised in its mandate implementation.",
        chainId: sepolia.id,
        address: '0x681eC1a272De799456aA7B15e1F13Ff0eC3046Ea'
    },
    {
        id: "token-delegates",
        title: "Token Delegates",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiaoyanrreocw5yvgoykf2nq2rfusjbxqq5j66ba3r4dix23llyecu/tokenDelegates.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwnowffbyj2gpaorm3oom42yqcp4delfwvubniuk32b26zholgwa/tokenDelegates.png",
        description: "One-token-one-vote is the most popular approach to DAO governance today, despite its many shortcomings. This Token Delegate example demonstrates how the Powers protocol can be used to give power to accounts along the amount of  delegated tokens they hold. There is one key difference with traditional approaches: after delegates have been selected, they all hold the same amount of power (similar to democratic elections) while in classic DAO governance inequality in votes is reflected in delegates power.",
        chainId: sepolia.id,
        address: '0xEa7Cf8Ad4Ae931e88A26b0609644D2acc517400D'
    }, 
    {
        id: "governed-721",
        title: "Governed 721",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeibcfc5dzcah2xxmvk3gjhij7t3sp5v6ppkub36jmtex2t75fcz22i/organisation.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiboosk4qnbeazftgdjppcuwunlxvatph5aobajj6txbcgcy3p33cu/organisation.png",
        description: "Governed 721 is an example of an organisation that governs specific functionality in a Protocol. In this case: setting payment split for royalties of NFT sales. It has a policy setting (the split) and enforcement (blacklisting of addresses). This type of organisation can be used to govern specific parameters or functionalities in a larger ecosystem, such as a protocol or platform.",
        chainId: sepolia.id,
        address: '0xAc6EBe1F618e66219d7bE0e137c293d8f62f8D46'
    }, 
    {
        id: "account-abstraction",
        title: "Account Abstraction",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeibcfc5dzcah2xxmvk3gjhij7t3sp5v6ppkub36jmtex2t75fcz22i/organisation.json",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeiboosk4qnbeazftgdjppcuwunlxvatph5aobajj6txbcgcy3p33cu/organisation.png",
        description: "Account Abstraction is an example of using ERC-4337 to sponsor gas cost for users interacting with an organisation governed by the Powers protocol. This allows users to interact with the organisation without needing to hold the native token of the chain, improving accessibility and user experience.",
        chainId: sepolia.id,
        address: '0xC974057e4281BAA647F2751Efa2759Cee43A6ca3'
    },
]
