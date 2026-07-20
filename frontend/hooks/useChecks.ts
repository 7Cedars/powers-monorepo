import { useCallback, useState } from "react";
import { powersAbi } from "../context/abi";
import { Mandate, Checks, Status, Powers } from "../context/types"
import { wagmiConfig } from "@/context/wagmiConfig";
import { ConnectedWallet } from "@privy-io/react-auth";
import { readContract } from "wagmi/actions";
import { useParams } from "next/navigation";
import { parseChainId } from "@/utils/parsers";
import { hashAction } from "@/utils/hashAction";
import { getBlockNumber } from '@wagmi/core'
import { useEffectiveAddress } from "@/hooks/useEffectiveAddress"

export const useChecks = () => {
  const { chainId } = useParams<{ chainId: string }>()
  const [checks, setChecks] = useState<Checks | undefined>()
  const [status, setStatus ] = useState<Status>("idle")
  const [error, setError] = useState<any | null>(null)
  const effectiveAddress = useEffectiveAddress()
  // note: the state of checks is not stored here, it is stored in the Zustand store

  // console.log("useChecks: waypoint 0", {error, status})

  const checkAccountAuthorised = useCallback(
    async (mandate: Mandate, powers: Powers, wallets: ConnectedWallet[]) => {
        const address = effectiveAddress ?? wallets[0]?.address
        if (!address) return false
        try {
          // console.log("@checkAccountAuthorised: waypoint 0", {mandate, powers, address})
          const result =  await readContract(wagmiConfig, {
                  abi: powersAbi,
                  address: powers.contractAddress as `0x${string}`,
                  functionName: 'canCallMandate',
                  args: [address, mandate.index],
                  chainId: parseChainId(chainId)
                })
          // console.log("@checkAccountAuthorised: waypoint 1", {result})
          return result as boolean
        } catch (error) {
            setStatus("error")
            setError(error as Error)
            // console.log("@checkAccountAuthorised: waypoint 2", {error})
        }
  }, [effectiveAddress])

  const getActionState = useCallback(
    async (mandate: Mandate, mandateId: bigint, mandateCalldata: `0x${string}`, nonce: bigint): Promise<bigint | undefined> => {
      const actionId = hashAction(mandateId, mandateCalldata, nonce)
      // console.log("@getActionState: waypoint 0", {mandateId, mandateCalldata, nonce, actionId})

      try {
        const state =  await readContract(wagmiConfig, {
                abi: powersAbi,
                address: mandate.powers as `0x${string}`,
                functionName: 'getActionState', 
                args: [actionId],
                chainId: parseChainId(chainId)
              })
        return state as bigint

      } catch (error) {
        setStatus("error")
        setError(error as Error)
      }
  }, [])

  const checkThrottledExecution = useCallback(async (mandate: Mandate): Promise<boolean> => {
    const throttle = Number(mandate.conditions?.throttleExecution ?? 0)
    if (throttle === 0) return true

    // Use the same data source as SingleFlow.tsx (indexed store events) to
    // avoid stale RPC cache disagreements with the visual Flow tab.
    const latestFulfillment = mandate.actions?.length
      ? Math.max(...mandate.actions.map(a => Number(a.fulfilledAt || 0n)))
      : 0

    if (latestFulfillment === 0) return true  // never fulfilled — contract skips throttle too

    const blockNumber = await getBlockNumber(wagmiConfig, { chainId: parseChainId(chainId) })
    if (!blockNumber) return true

    return latestFulfillment + throttle < Number(blockNumber)
  }, [chainId])

  const checkDelayedExecution = async (mandateId: bigint, nonce: bigint, calldata: `0x${string}`, powers: Powers) => {
    // console.log("CheckDelayedExecution triggered:", {mandateId, nonce, calldata, powers})
    const actionId = hashAction(mandateId, calldata, nonce)
    const mandate = powers.mandates?.find(mandate => mandate.index === mandateId)
    
    try {
      const blockNumber = await getBlockNumber(wagmiConfig, {
        chainId: parseChainId(chainId),
      })

      // Get action data to retrieve proposedAt timestamp
      const actionData = await readContract(wagmiConfig, {
        abi: powersAbi,
        address: powers.contractAddress as `0x${string}`,
        functionName: 'getActionData',
        args: [actionId],
        chainId: parseChainId(chainId)
      })

      const [, proposedAt, , , , ,] = actionData as unknown as [
        bigint, bigint, bigint, bigint, bigint, string, bigint
      ]

      // Check if delay has passed: proposedAt + timelock < blockNumber
      if (proposedAt && blockNumber) {
        // If proposedAt is 0, no proposal exists yet, so delay check fails
        const result = Number(proposedAt) > 0 
          ? Number(proposedAt) + Number(mandate?.conditions?.timelock) < Number(blockNumber) 
          : false  
        return result as boolean
      } else {
        return false
      }
    } catch (error) {
      console.log("Error checking delay:", error)
      return false
    }
  }


  // note: I did not implement castVoteWithReason -- to much work for now. 
  const checkHasVoted = useCallback( 
    async (mandateId: bigint, nonce: bigint, calldata: `0x${string}`, powers: Powers, account: `0x${string}`): Promise<boolean> => {
      const actionId = hashAction(mandateId, calldata, nonce)
      // console.log("checkHasVoted triggered")
        // setStatus({status: "pending"})
        try {
          const result = await readContract(wagmiConfig, {
            abi: powersAbi,
            address: powers.contractAddress as `0x${string}`,
            functionName: 'hasVoted', 
            args: [actionId, account],
            chainId: parseChainId(chainId)
          })
          return result as boolean
      } catch (error) {
          setStatus("error") 
          setError({error: error as Error})
          return false
      }
  }, [chainId])

  const fetchChecks = useCallback( 
    async (mandate: Mandate, callData: `0x${string}`, nonce: bigint, wallets: ConnectedWallet[], powers: Powers) => {
      // console.log("fetchChecks triggered, waypoint 0", {mandate, callData, nonce, wallets, powers, actionMandateId, caller})
        setError(null)
        setStatus("pending")

        if (wallets[0] && powers?.contractAddress && mandate.conditions) { 
          // console.log("fetchChecks triggered, waypoint 1", {mandate, callData, nonce, wallets, powers, actionMandateId, caller})
          const address = effectiveAddress ?? wallets[0]?.address as `0x${string}`
          const checksData = await Promise.all([
            checkThrottledExecution(mandate),
            checkAccountAuthorised(mandate, powers, wallets),
            getActionState(mandate, mandate.index, callData, nonce),
            getActionState(mandate, mandate.conditions.needFulfilled, callData, nonce),
            getActionState(mandate, mandate.conditions.needNotFulfilled, callData, nonce),
            checkDelayedExecution(mandate.index, nonce, callData, powers),
            checkHasVoted(mandate.index, nonce, callData, powers, address)
          ])
          const [throttled, authorised, actionState, actionStateNeedFulfilled, actionStateNeedNotFulfilled, delayed, hasVoted] = checksData

          const newChecks: Checks =  {
            delayPassed: mandate.conditions.timelock == 0n ? true : delayed,
            throttlePassed: mandate.conditions.throttleExecution === 0n ? true : throttled,
            authorised,
            actionExists: mandate.conditions.quorum == 0n ? true : actionState != 0n,
            proposalPassed: mandate.conditions.quorum == 0n ? true : actionState == 5n || actionState == 6n || actionState == 7n,
            actionNotFulfilled: actionState != 7n,
            mandateFulfilled: mandate.conditions.needFulfilled == 0n ? true : actionStateNeedFulfilled == 7n, 
            mandateNotFulfilled: mandate.conditions.needNotFulfilled == 0n ? true : actionStateNeedNotFulfilled != 7n
          } 
          newChecks.allPassed = Object.values(newChecks).filter(item => item !== undefined).every(item => item === true)
          // ActionState.Active == 3 (Powers.sol never returns ActionState.Proposed == 1 —
          // getActionState() resolves straight to Active/Defeated/Succeeded once proposed).
          newChecks.voteActive = mandate.conditions.quorum == 0n ? true : actionState == 3n
          newChecks.hasVoted = hasVoted

          console.log("fetchChecks triggered, waypoint 2", {newChecks})
          setChecks(newChecks)
          setStatus("success") //NB note: after checking status, sets the status back to idle! 
          return newChecks
        }       
  }, [ ])

  return {status, error, checks, fetchChecks, getActionState, checkAccountAuthorised, hashAction}
}