import { useCallback, useEffect, useRef, useState } from "react";
import { mandateAbi, powersAbi } from "../context/abi";
import { MandateSimulation, Mandate, Powers, Action, ActionVote, Status } from "../context/types"
import { readContract, readContracts, simulateContract, writeContract, estimateFeesPerGas } from "@wagmi/core";
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

  // Refs written on every render so callbacks always read the latest values,
  // even if they were memoized before client finished initialising.
  const clientRef = useRef(client);
  const isSmartWalletRef = useRef(isSmartWallet);
  clientRef.current = client;
  isSmartWalletRef.current = isSmartWallet;
 
  const [transactionHash, setTransactionHash ] = useState<`0x${string}` | undefined>()
  const {data: dataReceipt, error: errorReceipt, status: statusReceipt} = useTransactionConfirmations({
    // confirmations: 1, 
    hash: transactionHash,
    chainId: parseChainId(chainId) 
  })

  // console.log("@useMandate, waypoint 0", {dataReceipt})
 
  // NB: here the powers object is updated after a transaction is successful.
  useEffect(() => {
    if (!transactionHash) return
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
  }, [statusReceipt, transactionHash])

  // reset // 
  const resetStatus = () => {
    setStatus({status: "idle"})
    setError({error: null})
    setTransactionHash(undefined)
  }

  const getFeesWithBuffer = async (targetChainId: number) => {
    const fees = await estimateFeesPerGas(wagmiConfig, { chainId: targetChainId as any })
    return {
      maxFeePerGas: fees.maxFeePerGas * 13n / 10n,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    }
  }

  // Helper to send smart wallet transaction with custom per-Powers paymaster
  const sendSmartWalletTx = async (
    to: `0x${string}`,
    data: `0x${string}`,
    powers: Powers
  ): Promise<`0x${string}`> => {
    const currentClient = clientRef.current;
    console.log("@sendSmartWalletTx, waypoint 0", {to, data, powers})
    if (!currentClient) throw new Error("Smart wallet client not found");

    // If no specific paymaster is set, use the default Privy client behavior
    if (!powers.paymaster || powers.paymaster === '0x0000000000000000000000000000000000000000') {
      const feeOverride = await getFeesWithBuffer(parseChainId(chainId))
      return await currentClient.sendTransaction({ to, data, value: 0n, ...feeOverride });
    }
    console.log("@sendSmartWalletTx, waypoint 1", {to, data, powers})

    // Stay on Privy's client (preserving its signing infrastructure) but inject the
    // custom paymaster directly into the UserOperation. Wrapping currentClient.account
    // in a new permissionless client causes AA24 because the two SDKs call
    // signUserOperation with different argument shapes.
    const userOpHash = await currentClient.sendUserOperation({
      calls: [{ to, data, value: 0n }],
      paymaster: powers.paymaster as `0x${string}`,
      paymasterData: "0x" as `0x${string}`,
      paymasterVerificationGasLimit: 100000n,
      paymasterPostOpGasLimit: 100000n,
    } as any);
    console.log("@sendSmartWalletTx, waypoint 2", {userOpHash})

    const receipt = await currentClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log("@sendSmartWalletTx, waypoint 3", {receipt})
    return receipt.receipt.transactionHash;
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
          if (isSmartWalletRef.current && clientRef.current) {
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
            const feeOverride = await getFeesWithBuffer(parseChainId(chainId))
            result = await writeContract(wagmiConfig, Object.assign({}, simulatedRequest, feeOverride) as typeof simulatedRequest)
          }
          setTransactionHash(result)
          return true
        } catch (error) {
            setStatus({status: "error"})
            setError({error: error as Error})
        }
        return false
  }, [chainId])

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
          if (isSmartWalletRef.current && clientRef.current) {
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
            const feeOverride = await getFeesWithBuffer(parseChainId(chainId))
            result = await writeContract(wagmiConfig, {
              abi: powersAbi,
              address: powers.contractAddress,
              functionName: 'cancel',
              args: [mandateId, mandateCalldata, nonce],
              chainId: parseChainId(chainId),
              ...feeOverride
            })
          }
          setTransactionHash(result)
          return true
      } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          return false
      }
  }, [chainId])

  const castVote = useCallback( 
    async (
      actionId: bigint,
      support: bigint,
      powers: Powers
    ): Promise<boolean> => {
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWalletRef.current && clientRef.current) {
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
            const feeOverride = await getFeesWithBuffer(parseChainId(chainId))
            result = await writeContract(wagmiConfig, {
              abi: powersAbi,
              address: powers.contractAddress,
              functionName: 'castVote',
              args: [actionId, support],
              chainId: parseChainId(chainId),
              ...feeOverride
            })
          }
          setTransactionHash(result)
          return true
      } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          return false
      }
  }, [chainId])

  const castVoteWithReason = useCallback( 
    async (
      actionId: bigint,
      support: bigint,
      reason: string,
      powers: Powers
    ): Promise<boolean> => {
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWalletRef.current && clientRef.current) {
            result = await sendSmartWalletTx(
              powers.contractAddress,
              encodeFunctionData({
                abi: powersAbi,
                functionName: 'castVoteWithReason',
                args: [actionId, support, reason],
              }),
              powers
            );
          } else {
            const feeOverride = await getFeesWithBuffer(parseChainId(chainId))
            result = await writeContract(wagmiConfig, {
              abi: powersAbi,
              address: powers.contractAddress,
              functionName: 'castVoteWithReason',
              args: [actionId, support, reason],
              chainId: parseChainId(chainId),
              ...feeOverride
            })
          }
          setTransactionHash(result)
          return true
      } catch (error) {
          setStatus({status: "error"}) 
          setError({error: error as Error})
          return false
      }
  }, [chainId])

  const fetchVoteData = useCallback(
    async (
      actionObject: Action,
      powers: Powers
    ): Promise<ActionVote | undefined> => {
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

        setActionVote(vote)
        return vote
      } catch (error) {
        return undefined
      }
    }, [chainId])
  
  const simulate = useCallback(
    async (caller: `0x${string}`, mandateCalldata: `0x${string}`, nonce: bigint, mandate: Mandate): Promise<boolean> => {
      try {
          const result = await readContract(wagmiConfig, {
            abi: mandateAbi,
            address: mandate.mandateAddress as `0x${string}`,
            functionName: 'handleRequest',
            args: [caller, mandate.powers, mandate.index, mandateCalldata, nonce],
            chainId: parseChainId(chainId)
            })
          setSimulation(result as MandateSimulation)
          return true
        } catch (error) {
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
        console.log("@execute: waypoint 1", {mandate, mandateCalldata, nonce, description, isSmartWallet: isSmartWalletRef.current, client: clientRef.current})
        setError({error: null})
        setStatus({status: "pending"})
        try {
          let result: `0x${string}`;
          if (isSmartWalletRef.current && clientRef.current) {
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
              const feeOverride = await getFeesWithBuffer(parseChainId(chainId))
              result = await writeContract(wagmiConfig, Object.assign({}, simulatedRequest, feeOverride) as typeof simulatedRequest)
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
      }, [chainId])

  return {simulation, actionVote, transactionHash, resetStatus, simulate, request, propose, cancel, castVote, castVoteWithReason, fetchVoteData}
}