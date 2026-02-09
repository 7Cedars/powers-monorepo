import { Organization } from "./types";
import { powersAbi } from "@/context/abi";
import { Abi, encodeAbiParameters, encodeFunctionData, parseAbiParameters, toFunctionSelector } from "viem";
import { minutesToBlocks, ADMIN_ROLE, PUBLIC_ROLE, createConditions, getInitialisedAddress } from "./helpers";
import { MandateInitData } from "./types";
import { sepolia, arbitrumSepolia, optimismSepolia, mantleSepoliaTestnet, foundry } from "@wagmi/core/chains";
import SimpleErc20Votes from "@/context/builds/SimpleErc20Votes.json";
import Erc20DelegateElection from "@/context/builds/Erc20DelegateElection.json";
import Nominees from "@/context/builds/Nominees.json";

/**
 * Powers 101 Organization
 * 
 * A simple DAO with basic governance based on separation of powers between 
 * delegates, members, and an admin. Perfect for learning the Powers protocol.
 * 
 * Key Features:
 * - Statement of Intent system for proposals
 * - Delegate execution with voting requirements
 * - Veto power for admin
 * - Self-nomination and election system
 * - Community membership via self-selection
 */
export const Powers101: Organization = {
  metadata: {
    id: "powers-101",
    title: "Powers 101",
    uri: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafkreicbh6txnypkoy6ivngl3l2k6m646hruupqspyo7naf2jpiumn2jqe",
    banner: "https://aqua-famous-sailfish-288.mypinata.cloud/ipfs/bafybeickdiqcdmjjwx6ah6ckuveufjw6n2g6qdvatuhxcsbmkub3pvshnm",
    description: "A simple DAO with basic governance based on a separation of powers between delegates, an executive council and an admin. It is a good starting point for understanding the Powers protocol.",
    disabled: false,
    onlyLocalhost: false
  },
  fields: [],
  dependencies: [
    {
      name: "SimpleErc20Votes",
      abi: SimpleErc20Votes.abi as Abi,
      bytecode: SimpleErc20Votes.bytecode.object as `0x${string}`,
      args: []
    },
    // Note: Erc20DelegateElection depends on SimpleErc20Votes address.
    // The deployment system is assumed to handle sequential deployment and argument resolution if supported,
    // or requires manual handling if not. 
    // For now, we define it here as per the script's logic.
    {
      name: "Erc20DelegateElection",
      abi: Erc20DelegateElection.abi as Abi,
      bytecode: Erc20DelegateElection.bytecode.object as `0x${string}`,
      // Placeholder: In a real system this needs to be the address of SimpleErc20Votes
      args: [] 
    },
    {
      name: "Nominees",
      abi: Nominees.abi as Abi,
      bytecode: Nominees.bytecode.object as `0x${string}`,
      args: []
    }
  ],
  allowedChains: [
    sepolia.id, 
    optimismSepolia.id
  ],
  allowedChainsLocally: [
    sepolia.id, 
    optimismSepolia.id,
    foundry.id
  ],

  createMandateInitData: (
    powersAddress: `0x${string}`, 
    formData: Record<string, any>,
    deployedMandates: Record<string, `0x${string}`>,
    dependencyReceipts: Record<string, any>,
    chainId: number,
  ): MandateInitData[] => {
    const mandateInitData: MandateInitData[] = [];
    let mandateCount = 0;

    // Retrieve deployed dependency addresses
    // Note: Assuming dependencyReceipts keys match dependency names
    const simpleErc20VotesAddress = dependencyReceipts["SimpleErc20Votes"]?.contractAddress || "0x0000000000000000000000000000000000000000";
    const erc20DelegateElectionAddress = dependencyReceipts["Erc20DelegateElection"]?.contractAddress || "0x0000000000000000000000000000000000000000";
    const nomineesAddress = dependencyReceipts["Nominees"]?.contractAddress || "0x0000000000000000000000000000000000000000";

    //////////////////////////////////////////////////////////////////
    //                 LAW 1: INITIAL SETUP                         //
    //////////////////////////////////////////////////////////////////

    mandateCount++;
    mandateInitData.push({
      nameDescription: "Initial Setup: Assign labels to roles and set the treasury. It self-destructs after execution.",
      targetMandate: getInitialisedAddress("PresetActions_Single", deployedMandates),
      config: encodeAbiParameters(
        [
          { name: 'targets', type: 'address[]' },
          { name: 'values', type: 'uint256[]' },
          { name: 'calldatas', type: 'bytes[]' }
        ],
        [
          [
            powersAddress, 
            powersAddress,  
            powersAddress
          ],
          [0n, 0n, 0n],
          [
            encodeFunctionData({
              abi: powersAbi,
              functionName: "labelRole",
              args: [1n, "Delegate"]
            }),
            encodeFunctionData({
              abi: powersAbi,
              functionName: "setTreasury",  
              args: [powersAddress]
            }),
            encodeFunctionData({
              abi: powersAbi,
              functionName: "revokeMandate",
              args: [BigInt(mandateCount)]
            })
          ]
        ]
      ),
      conditions: createConditions({
        allowedRole: PUBLIC_ROLE // Anyone
      })
    });

    //////////////////////////////////////////////////////////////////
    //                    EXECUTIVE MANDATES                        //
    //////////////////////////////////////////////////////////////////

    // MINT NEW TOKENS FLOW // 
    // Members: propose minting tokens to an address.  
    const mintInputParams = ["address To", "uint256 Quantity"];

    mandateCount++;
    const proposeMintIndex = BigInt(mandateCount);
    mandateInitData.push({
      nameDescription: `Propose to Mint: Propose to mint tokens at ${simpleErc20VotesAddress}.`,
      targetMandate: getInitialisedAddress("StatementOfIntent", deployedMandates),
      config: encodeAbiParameters(
        [{ name: 'inputParams', type: 'string[]' }],
        [mintInputParams]
      ),
      conditions: createConditions({
        allowedRole: PUBLIC_ROLE // Anyone
      })
    });

    mandateCount++;
    const vetoMintIndex = BigInt(mandateCount);
    mandateInitData.push({
      nameDescription: `Veto a mint: Veto a proposed token mint at ${simpleErc20VotesAddress}.`,
      targetMandate: getInitialisedAddress("StatementOfIntent", deployedMandates),
      config: encodeAbiParameters(
        [{ name: 'inputParams', type: 'string[]' }],
        [mintInputParams]
      ),
      conditions: createConditions({
        allowedRole: 0n, // Admin
        needFulfilled: proposeMintIndex
      })
    });

    mandateCount++;
    mandateInitData.push({
      nameDescription: `Execute a mint: Execute a mint at ${simpleErc20VotesAddress}. it has to be proposed first by the community and should not have been vetoed by an admin.`,
      targetMandate: getInitialisedAddress("BespokeAction_Simple", deployedMandates),
      config: encodeAbiParameters(
        [
          { name: 'target', type: 'address' },
          { name: 'functionSelector', type: 'bytes4' },
          { name: 'inputParams', type: 'string[]' }
        ],
        [
          simpleErc20VotesAddress,
          toFunctionSelector("mint(address,uint256)"), 
          mintInputParams
        ]
      ),
      conditions: createConditions({
        allowedRole: 1n, // Delegate
        votingPeriod: minutesToBlocks(5, chainId),
        succeedAt: 66n, // 66%
        quorum: 20n, // 20%
        needFulfilled: proposeMintIndex,
        needNotFulfilled: vetoMintIndex
      })
    });

    //////////////////////////////////////////////////////////////////
    //                    ELECTORAL MANDATES                        //
    //////////////////////////////////////////////////////////////////

    // ELECT DELEGATES FLOW //
    // Members: nominate themselves for a delegate 
    const nominateParams = ["bool NominateMe"];

    mandateCount++;
    mandateInitData.push({
      nameDescription: "Nominate Me: Nominate yourself for a delegate election. (Set nominateMe to false to revoke nomination)",
      targetMandate: getInitialisedAddress("BespokeAction_Simple", deployedMandates),
      config: encodeAbiParameters(
        [
          { name: 'target', type: 'address' },
          { name: 'functionSelector', type: 'bytes4' },
          { name: 'inputParams', type: 'string[]' }
        ],
        [
          erc20DelegateElectionAddress,
          toFunctionSelector("nominate(address,bool)"), // Check Nominees selector. It is nominate(address nominee, bool shouldNominate). 
          // Wait, Nominees.sol nominate is (address nominee, bool shouldNominate).
          // BespokeAction_Simple typically maps caller to first arg if configured?
          // No, BespokeAction_Simple usually takes params from user.
          // If the user calls this mandate, they provide arguments matching inputParams.
          // inputParams is "bool NominateMe".
          // The function selector is nominate(address,bool).
          // Does BespokeAction_Simple inject msg.sender?
          // Let's check BespokeAction_Simple.sol content.
          nominateParams
        ]
      ),
      conditions: createConditions({
        allowedRole: PUBLIC_ROLE // Anyone
      })
    });

    // Anyone: call delegate select.  
    mandateCount++;
    mandateInitData.push({
      nameDescription: "Call a delegate election: This can be done at any time. Nominations are elected on the amount of delegated tokens they have received.",
      targetMandate: getInitialisedAddress("DelegateTokenSelect", deployedMandates),
      config: encodeAbiParameters(
        [
          { name: 'electionContract', type: 'address' },
          { name: 'nomineesContract', type: 'address' },
          { name: 'roleId', type: 'uint256' },
          { name: 'maxHolders', type: 'uint256' }
        ],
        [
          erc20DelegateElectionAddress,
          nomineesAddress,
          1n, // Role to be elected (Delegate)
          3n  // Max number role holders
        ]
      ),
      conditions: createConditions({
        allowedRole: PUBLIC_ROLE
      })
    });

    return mandateInitData;
  }
};
