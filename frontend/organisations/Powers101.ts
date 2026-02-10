import { Organization } from "./types";
import { powersAbi } from "@/context/abi";
import { Abi, encodeAbiParameters, encodeFunctionData, parseAbiParameters, toFunctionSelector } from "viem";
import { minutesToBlocks, ADMIN_ROLE, PUBLIC_ROLE, createConditions, getInitialisedAddress } from "./helpers";
import { MandateInitData } from "./types";
import { sepolia, arbitrumSepolia, optimismSepolia, mantleSepoliaTestnet, foundry } from "@wagmi/core/chains";
import SimpleErc20Votes from "@/context/builds/SimpleErc20Votes.json";

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
    const simpleErc20VotesAddress = dependencyReceipts["SimpleErc20Votes"]?.contractAddress || "0x0000000000000000000000000000000000000000";
    const electionListAddress = getInitialisedAddress("ElectionList", deployedMandates);

    //////////////////////////////////////////////////////////////////
    //                 LAW 1: INITIAL SETUP                         //
    //////////////////////////////////////////////////////////////////

    mandateCount++;
    mandateInitData.push({
      nameDescription: "Setup:  assigns labels to roles and set the treasury. It self-destructs after execution.",
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
    //                    ELECTORAL LAWS                            //
    ///////////////////////////////////////////////////////////////// 
    mandateCount++;
    mandateInitData.push({
      nameDescription: "Admin can assign any role: For this demo, the admin can assign any role to an account.",
      targetMandate: getInitialisedAddress("BespokeAction_Simple", deployedMandates),
      config: encodeAbiParameters(
      parseAbiParameters('address powers, bytes4 FunctionSelector, string[] Params'),
        [
          powersAddress,
          toFunctionSelector("assignRole(uint256,address)"),
          ["uint256 roleId","address account"]
        ]
      ),
      conditions: createConditions({
        allowedRole: ADMIN_ROLE
      })
    });
    const assignAnyRole = BigInt(mandateCount);

    mandateCount++;
    mandateInitData.push({
      nameDescription: "A delegate can revoke a role: For this demo, any delegate can revoke previously assigned roles.",
      targetMandate: getInitialisedAddress("BespokeAction_Simple", deployedMandates),
      config: encodeAbiParameters(
      parseAbiParameters('address powers, bytes4 FunctionSelector, string[] Params'),
        [
          powersAddress,
          toFunctionSelector("revokeRole(uint256,address)"),
          ["uint256 roleId","address account"]
        ]
      ),
      conditions: createConditions({
        allowedRole: 1n,
        needFulfilled: assignAnyRole
      })
    });  

    return mandateInitData;
  }
};