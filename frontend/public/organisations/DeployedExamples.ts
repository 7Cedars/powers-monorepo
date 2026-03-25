import { sepolia, arbitrumSepolia, optimismSepolia, foundry } from "@wagmi/core/chains";

export const DeployedExamples = [
    {
        id: "nested-governance-parent",
        title: "Nested Governance",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreian4g4wbuollclyml5xyao3hvnbxxduuoyjdiucdmau3t62rj46am",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeihnlv5j7z5c2kx3afitiijlwg7u65snepooxtczt4biwr7t5gltoi",
        description: "Nested Governance demonstrates how the Powers protocol can be used to layer governance within each other to create complex decision-making hierarchies. This example is a single parent organisation that governs a child, but any type of complex structure can be created. The notion of sub-DAOs is similar to nested governance.",
        chainId: sepolia.id,
        address: '0x0C4C42b9f9836faA89c1fc52803E167A7d1e0F1b' 
    },
    {
        id: "bicameralism",
        title: "Bicameralism",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreidlcgxe2mnwghrk4o5xenybljieurrxhtio6gq5fq5u6lxduyyl6e",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeihlduuz4ql3mcwyqifixrctuou6v45pspp5igjzmznpxwto6qdtdu",
        description: "In Bicameralism, the governance system is divided into two separate chambers or houses, each with its own distinct powers and responsibilities. In this example Delegates can initiate an action, but it can only be executed by Funders. A version of Bicameralism is implemented at the Optimism Collective.",
        chainId: sepolia.id,
        address: '0x3918BB2e0437cdAE66f8EED1954917eAdEE12562'
    },
    {
        id: "optimistic-execution",
        title: "Optimistic Execution",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreibzf5td4orxnfknmrz5giiifw4ltsbzciaam7izm6dok5pkm6aqqa",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeihd4il4irvu3kqxnlohkkzlhpywcujqmabwldi3nftqmt5xaszwxy",
        description: "In Optimistic Execution, the Powers protocol leverages optimistic mechanisms to enable faster decision-making processes by assuming proposals are valid unless challenged. This approach can improve efficiency while still allowing for dispute resolution through challenges. A similar mechanism is currently used by the Optimism Collective.",
        chainId: sepolia.id,
        address: '0xd1DFf7dFe7D8ec2D08c2313c9CA7f1192038Aa3c'
    },
    // {
    //     id: "power-labs",
    //     title: "Power Labs",
    //     uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreibnvjwah2wdgd3fhak3sedriwt5xemjlacmrabt6mrht7f24m5w3i",
    //     banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeideomrrzq4goct7we74barpvwte7qvbaljrj3azlwiyzzjku6wsou",
    //     description: "This is an alpha implementation of the Power Labs organisation. It manages protocol development funding via Safe Smart Accounts and governance based on GitHub contributions verified by commit signatures. Also it is possible to buy Funder roles through ETH donations.",
    //     chainId: sepolia.id,
    //     address: '0xfCc77b6a992FBd5Af6b41D5d572d50377588c5E5'
    // },
    {
        id: "open-elections",
        title: "Election Lists",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreiaaprfqxtgyxa5v2dnf7edfbc3mxewdh4axf4qtkurpz66jh2f2ve",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeideyeixpz7bkqxpasrlhu7ia3plir6z5b2vh3d7w26e5is27nqyfu",
        description: "Election lists demonstrates how, using the Powers protocol, electoral lists can be used to assign roles to accounts. (These type of approaches are becoming more popular, see for instance the elections for Arbitrum's Security council, or multiple options votes). The specific logic used for an electoral list can be customised in its mandate implementation.",
        chainId: sepolia.id,
        address: '0x770B28492A1548f2164b4ACE5f8E593Cc092E23e'
    },
    {
        id: "token-delegates",
        title: "Token Delegates",
        uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreicpqpipzetgtcbqdeehcg33ibipvrb3pnikes6oqixa7ntzaniinm",
        banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeidwk32aq52ap5fyrrojmtuhbehvwdv5emyld4nspznaepcxcqnbv4",
        description: "One-token-one-vote is the most popular approach to DAO governance today, despite its many shortcomings. This Token Delegate example demonstrates how the Powers protocol can be used to give power to accounts along the amount of  delegated tokens they hold. There is one key difference with traditional approaches: after delegates have been selected, they all hold the same amount of power (similar to democratic elections) while in classic DAO governance inequality in votes is reflected in delegates power.",
        chainId: sepolia.id,
        address: '0xF9E1bE122f7a13Ad7e915270b32B6De26D236814'
    }
]
