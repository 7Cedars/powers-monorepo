import { useCallback, useEffect, useState } from "react";
import { mandateAbi, powersAbi } from "../context/abi";
import { MandateSimulation, Mandate, Powers, Action, ActionVote, Status } from "../context/types"
import { readContract, readContracts, simulateContract, writeContract } from "@wagmi/core";
import { encodeFunctionData } from "viem";
import { wagmiConfig } from "@/context/wagmiConfig";
import { useConnection, useTransactionConfirmations } from "wagmi";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { parseChainId } from "@/utils/parsers";
import { useParams } from "next/navigation";
import { setStatus, setError } from "@/context/store";
import { usePowers } from "./usePowers";

export const useMandate = () => {
  const { chainId, powers: addressPowers } = useParams<{ chainId: string, powers: `0x${string}` }>()
  const { fetchPowers } = usePowers();
  const [simulation, setSimulation ] = useState<MandateSimulation>()  
  const [actionVote, setActionVote] = useState<ActionVote | undefined>() 

  const { address } = useConnection();
  const { wallets } = useWallets();
  const { user } = usePrivy();
  const { client } = useSmartWallets();
  
  const hasSmartWalletAccount = user?.linkedAccounts.find((a) => a.type === 'smart_wallet') !== undefined;
  const isSmartWallet = hasSmartWalletAccount && !!client && !!client.account;
 
  const [transactionHash, setTransactionHash ] = useState<`0x${string}` | undefined>()
  const {data: dataReceipt, error: errorReceipt, status: statusReceipt} = useTransactionConfirmations({
    // confirmations: 1, 
    hash: transactionHash,
    chainId: parseChainId(chainId) 
  })

  // console.log("@useMandate, waypoint 0", {dataReceipt})
 
  // NB: here the powers object is updated after a transaction is successful.
  useEffect(() => {
    if (statusReceipt === "pending") {
      setStatus({status: "pending"})
      fetchPowers(addressPowers, parseChainId(chainId))
    }
    if (statusReceipt === "success") {
      setStatus({status: "success"})
      fetchPowers(addressPowers, parseChainId(chainId))
    }
    if (statusReceipt === "error") {
      setStatus({status: "error"})
      setError({error: errorReceipt as Error})
    }
  }, [statusReceipt])

  // reset // 
  const resetStatus = () => {
    setStatus({status: "idle"})
    setError({error: null})
    setTransactionHash(undefined)
  }

  // Helper to send smart wallet transaction with custom per-Powers paymaster
  const sendSmartWalletTx = async (
    to: `0x${string}`,
    data: `0x${string}`,
    powers: Powers
  ): Promise<`0x${string}`> => {
    console.log("@sendSmartWalletTx, waypoint 0", {to, data, powers})
    if (!client) throw new Error("Smart wallet client not found");
    
    // If no specific paymaster is set, use the default Privy client behavior
    if (!powers.paymaster || powers.paymaster === '0x0000000000000000000000000000000000000000') {
      return await client.sendTransaction({ to, data, value: 0n });
    }
    console.log("@sendSmartWalletTx, waypoint 1", {to, data, powers})

    const { createSmartAccountClient } = await import('permissionless');
    const { http } = await import('viem');
    
    const pimlicoUrl = process.env.NEXT_PUBLIC_PIMLICO_BUNDLER_URL || "";
    let bundlerUrl = pimlicoUrl;
    if (bundlerUrl.includes('11155111') && chainId.toString() !== '11155111') {
      bundlerUrl = bundlerUrl.replace('11155111', chainId.toString());
    }

    console.log("@sendSmartWalletTx, waypoint 2", {bundlerUrl})

    const chain = wagmiConfig.chains.find(c => c.id === parseChainId(chainId));

    console.log("@sendSmartWalletTx, waypoint 3", {chain})

    const customClient = createSmartAccountClient({
      account: client.account as any,
      chain,
      bundlerTransport: http(bundlerUrl),
      paymaster: {
        getPaymasterData: async () => ({
          paymaster: powers.paymaster as `0x${string}`,
          paymasterData: "0x"
        }),
        getPaymasterStubData: async () => ({
          paymaster: powers.paymaster as `0x${string}`,
          paymasterData: "0x",
          paymasterVerificationGasLimit: 100000n,
          paymasterPostOpGasLimit: 100000n
        })
      },
      userOperation: {
        estimateFeesPerGas: async () => {
          const { createPimlicoClient } = await import('permissionless/clients/pimlico');
          const pimlicoClient = createPimlicoClient({ 
            transport: http(bundlerUrl), 
            entryPoint: { address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032", version: "0.7" } 
          });
          return await pimlicoClient.getUserOperationGasPrice().then((res: any) => res.fast);
        }
      }
    });

    return await customClient.sendTransaction({ account: customClient.account, to, data, value: 0n });
  };
  
  // Actions //  
  const propose = useCallback( 
    async (
      mandateId: bigint,
      mandateCalldata: `0x${string}`,
      nonce: bigint,
      description: string,
      powers: Powers
    ): Promise<boolean> => {
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWallet && client) {
            result = await sendSmartWalletTx(
              powers.contractAddress,
              encodeFunctionData({
                abi: powersAbi,
                functionName: 'propose',
                args: [mandateId, mandateCalldata, nonce, description],
              }),
              powers
            );
          } else {
            const { request: simulatedRequest } = await simulateContract(wagmiConfig, {
              abi: powersAbi,
              address: powers.contractAddress,
              functionName: 'propose',
              args: [mandateId, mandateCalldata, nonce, description],
              chainId: parseChainId(chainId)
            })
            result = await writeContract(wagmiConfig, simulatedRequest)
          }
          setTransactionHash(result)
          return true
        } catch (error) {
            setStatus({status: "error"}) 
            setError({error: error as Error})
        }
        return false
  }, [chainId, isSmartWallet, client])

  const cancel = useCallback( 
    async (
      mandateId: bigint,
      mandateCalldata: `0x${string}`,
      nonce: bigint,
      powers: Powers
    ): Promise<boolean> => {
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWallet && client) {
            result = await sendSmartWalletTx(
              powers.contractAddress,
              encodeFunctionData({
                abi: powersAbi,
                functionName: 'cancel',
                args: [mandateId, mandateCalldata, nonce],
              }),
              powers
            );
          } else {
            result = await writeContract(wagmiConfig, {
              abi: powersAbi,
              address: powers.contractAddress,
              functionName: 'cancel', 
              args: [mandateId, mandateCalldata, nonce],
              chainId: parseChainId(chainId)
            })
          }
          setTransactionHash(result)
          return true
      } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          return false
      }
  }, [chainId, isSmartWallet, client])

  // note: I did not implement castVoteWithReason -- to much work for now. 
  const castVote = useCallback( 
    async (
      actionId: bigint,
      support: bigint,
      powers: Powers
    ): Promise<boolean> => {
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWallet && client) {
            result = await sendSmartWalletTx(
              powers.contractAddress,
              encodeFunctionData({
                abi: powersAbi,
                functionName: 'castVote',
                args: [actionId, support],
              }),
              powers
            );
          } else {
            result = await writeContract(wagmiConfig, {
              abi: powersAbi,
              address: powers.contractAddress,
              functionName: 'castVote', 
              args: [actionId, support], 
              chainId: parseChainId(chainId)
            })
          }
          setTransactionHash(result)
          return true
      } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          return false
      }
  }, [chainId, isSmartWallet, client])

  const fetchVoteData = useCallback(
    async (
      actionObject: Action,
      powers: Powers
    ): Promise<ActionVote | undefined> => {
      setError({error: null})
      setStatus({status: "pending"})

      // console.log("@fetchVoteData, waypoint 0", {actionObject, powers})
      
      try {
        const [{ result: voteData }, { result: state }] = await readContracts(wagmiConfig, {
          contracts: [
            {
              abi: powersAbi,
              address: powers.contractAddress as `0x${string}`,
              functionName: 'getActionVoteData',
              args: [BigInt(actionObject.actionId)],
              chainId: parseChainId(chainId)
            },
            {
              abi: powersAbi,
              address: powers.contractAddress as `0x${string}`,
              functionName: 'getActionState',
              args: [BigInt(actionObject.actionId)],
              chainId: parseChainId(chainId)
            }
          ]
        })

        // console.log("@fetchVoteData, waypoint 1", {voteData, state})

        const [voteStart, voteDuration, voteEnd, againstVotes, forVotes, abstainVotes] = voteData as unknown as [
          bigint, bigint, bigint, bigint, bigint, bigint
        ]

        const vote: ActionVote = {
          actionId: actionObject.actionId as string,
          state: state ? state as number : 0,
          voteStart: voteStart as bigint,
          voteDuration: voteDuration as bigint,
          voteEnd: voteEnd as bigint,
          againstVotes: againstVotes as bigint,
          forVotes: forVotes as bigint,
          abstainVotes: abstainVotes as bigint,
        }

        // console.log("@fetchVoteData, waypoint 2", {vote})

        setActionVote(vote)
        setStatus({status: "success"})
        return vote
      } catch (error) {
        // console.log("@fetchVoteData, waypoint 3", {error})
        setStatus({status: "error"})
        setError({error: error as Error})
        return undefined
      }
    }, [chainId])
  
  const simulate = useCallback( 
    async (caller: `0x${string}`, mandateCalldata: `0x${string}`, nonce: bigint, mandate: Mandate): Promise<boolean> => {
      // console.log("@simulate: waypoint 1", {caller, mandateCalldata, nonce, mandate})
      setError({error: null})
      setStatus({status: "pending"})

      try {
          const result = await readContract(wagmiConfig, {
            abi: mandateAbi,
            address: mandate.mandateAddress as `0x${string}`,
            functionName: 'handleRequest', 
            args: [caller, mandate.powers, mandate.index, mandateCalldata, nonce],
            chainId: parseChainId(chainId)
            })
          // console.log("@simulate: waypoint 2a", {result})
          // console.log("@simulate: waypoint 2b", {result: result as MandateSimulation})
          setSimulation(result as MandateSimulation)
          setStatus({status: "success"})
          return true
        } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          console.log("@simulate: ERROR", {error})
          return false
        } 
  }, [chainId])

  const request = useCallback( 
    async (
      mandate: Mandate,
      mandateCalldata: `0x${string}`,
      nonce: bigint,
      description: string,
      powers: Powers
    ): Promise<boolean> => {
        console.log("@execute: waypoint 1", {mandate, mandateCalldata, nonce, description, isSmartWallet, client})
        setError({error: null})
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWallet && client) {
            result = await sendSmartWalletTx(
              mandate.powers,
              encodeFunctionData({
                abi: powersAbi,
                functionName: 'request',
                args: [mandate.index, mandateCalldata, nonce, description],
              }),
              powers
            );
            setTransactionHash(result)
            return true
          } else {
            const { request: simulatedRequest } = await simulateContract(wagmiConfig, {
              abi: powersAbi,
              address: mandate.powers as `0x${string}`,
              functionName: 'request',
              args: [mandate.index, mandateCalldata, nonce, description],
              chainId: parseChainId(chainId)
            })
            
            if (simulatedRequest) {
              console.log("@execute: waypoint 3", {request})
              result = await writeContract(wagmiConfig, simulatedRequest)
              setTransactionHash(result)
              console.log("@execute: waypoint 4", {result})
              return true
            }
          }
        } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          console.log("@execute: waypoint 5", {error}) 
          return false
        }
        setStatus({status: "idle"})
        return false
      }, [chainId, isSmartWallet, client])

  return {simulation, actionVote, transactionHash, resetStatus, simulate, request, propose, cancel, castVote, fetchVoteData}
}