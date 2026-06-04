'use client'

import { useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { readContracts } from 'wagmi/actions'
import { wagmiConfig } from '@/context/wagmiConfig'
import { powersAbi, mandateAbi } from '@/context/abi'
import { usePowersStore, setPowers } from '@/context/store'
import { bytesToParams } from '@/utils/parsers'
import { Action, ChainId, Conditions, Mandate } from '@/context/types'

export const usePowersLive = (
  powersAddress: `0x${string}` | undefined,
  chainId: ChainId | undefined
) => {
  const publicClient = usePublicClient({ chainId })

  useEffect(() => {
    if (!publicClient || !powersAddress || !chainId || powersAddress === '0x0') return

    const unwatch = publicClient.watchContractEvent({
      address: powersAddress,
      abi: powersAbi,
      pollingInterval: 30_000,
      onLogs: (logs) => {
        for (const log of logs) {
          void handleLog(log, powersAddress, chainId)
        }
      }
    })

    return () => { unwatch() }
  }, [publicClient, powersAddress, chainId])
}

async function handleLog(
  log: any,
  powersAddress: `0x${string}`,
  chainId: ChainId
) {
  const current = usePowersStore.getState()

  switch (log.eventName as string) {

    case 'PaymasterSet':
      setPowers({ paymaster: log.args.newPaymaster as `0x${string}` })
      break

    case 'RoleLabel': {
      const updatedRoles = current.roles?.map(r =>
        r.roleId === BigInt(log.args.roleId)
          ? { ...r, label: String(log.args.label) }
          : r
      )
      setPowers({ roles: updatedRoles })
      break
    }

    case 'RoleSet': {
      const updatedRoles = current.roles?.map(r => {
        if (r.roleId !== BigInt(log.args.roleId)) return r
        const delta = log.args.access ? 1n : -1n
        const prev = r.amountHolders ?? 0n
        const amountHolders = prev + delta < 0n ? 0n : prev + delta
        return { ...r, amountHolders }
      })
      setPowers({ roles: updatedRoles })
      break
    }

    case 'MandateRevoked': {
      const updatedMandates = current.mandates?.map(m =>
        m.index === BigInt(log.args.mandateId) ? { ...m, active: false } : m
      )
      setPowers({ mandates: updatedMandates })
      break
    }

    case 'FlowAdded': {
      const flows = [
        ...(current.flows || []),
        {
          nameDescription: String(log.args.nameDescription),
          mandateIds: (log.args.mandateIds as readonly any[]).map(id => BigInt(id))
        }
      ]
      setPowers({ flows })
      break
    }

    case 'FlowDeleted': {
      const flows = [...(current.flows || [])]
      flows.splice(Number(log.args.index), 1)
      setPowers({ flows })
      break
    }

    case 'FlowAdapted': {
      const flows = (current.flows || []).map((f, i) => {
        if (i !== Number(log.args.index1)) return f
        const ids = [...f.mandateIds]
        ids[Number(log.args.index2)] = BigInt(log.args.mandateId)
        return { ...f, mandateIds: ids }
      })
      setPowers({ flows })
      break
    }

    case 'ProposedActionCreated': {
      const { actionId, caller, mandateId, executeCalldata, voteStart, voteEnd, nonce, description } = log.args
      const state = log.blockNumber !== null && BigInt(voteStart) <= BigInt(log.blockNumber ?? 0n) ? 3 : 0
      const newAction: Action = {
        actionId: actionId.toString(),
        mandateId: BigInt(mandateId),
        caller: caller as `0x${string}`,
        callData: executeCalldata as `0x${string}`,
        voteStart: BigInt(voteStart),
        voteEnd: BigInt(voteEnd),
        nonce: nonce.toString(),
        description: description as string,
        proposedAt: log.blockNumber ?? undefined,
        state,
        forVotes: 0n,
        againstVotes: 0n,
        abstainVotes: 0n,
      }
      const updatedMandates = current.mandates?.map(m => {
        if (m.index !== BigInt(mandateId)) return m
        if (m.actions?.some(a => a.actionId === newAction.actionId)) return m
        return { ...m, actions: [...(m.actions || []), newAction] }
      })
      setPowers({ mandates: updatedMandates })
      break
    }

    case 'ProposedActionCancelled': {
      const updatedMandates = current.mandates?.map(m => ({
        ...m,
        actions: m.actions?.map(a =>
          a.actionId === log.args.actionId.toString()
            ? { ...a, state: 7, cancelledAt: log.blockNumber ?? undefined }
            : a
        )
      }))
      setPowers({ mandates: updatedMandates })
      break
    }

    case 'ActionFulfilled': {
      const updatedMandates = current.mandates?.map(m => ({
        ...m,
        actions: m.actions?.map(a =>
          a.actionId === log.args.actionId.toString()
            ? { ...a, state: 2, fulfilledAt: log.blockNumber ?? undefined }
            : a
        )
      }))
      setPowers({ mandates: updatedMandates })
      break
    }

    case 'MandateAdopted':
      await handleMandateAdopted(powersAddress, BigInt(log.args.mandateId), chainId)
      break

    case 'ActionRequested':
      await handleActionRequested(powersAddress, BigInt(log.args.mandateId), chainId)
      break

    // VoteCast: vote counts are not stored in the powers store (read directly by Voting component)
    // FundsReceived: treasury address unchanged, ETH balance not tracked in store
    default:
      break
  }
}

async function handleMandateAdopted(
  powersAddress: `0x${string}`,
  mandateId: bigint,
  chainId: ChainId
) {
  try {
    const [mandateTuple, conditions] = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: [
        {
          abi: powersAbi,
          address: powersAddress,
          functionName: 'getAdoptedMandate',
          args: [mandateId],
          chainId
        },
        {
          abi: powersAbi,
          address: powersAddress,
          functionName: 'getConditions',
          args: [mandateId],
          chainId
        }
      ]
    }) as [[`0x${string}`, `0x${string}`, boolean], Conditions]

    const [mandateAddress, mandateHash, active] = mandateTuple

    const [inputParams, nameDescription] = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: [
        {
          abi: mandateAbi,
          address: mandateAddress,
          functionName: 'getInputParams',
          args: [powersAddress, mandateId],
          chainId
        },
        {
          abi: mandateAbi,
          address: mandateAddress,
          functionName: 'getNameDescription',
          args: [powersAddress, mandateId],
          chainId
        }
      ]
    }) as [`0x${string}`, string]

    const newMandate: Mandate = {
      powers: powersAddress,
      mandateAddress,
      mandateHash,
      index: mandateId,
      active,
      conditions,
      inputParams,
      params: bytesToParams(inputParams),
      nameDescription
    }

    const current = usePowersStore.getState()
    const existingMandates = current.mandates || []
    const updatedMandates = existingMandates.some(m => m.index === mandateId)
      ? existingMandates.map(m => m.index === mandateId ? newMandate : m)
      : [...existingMandates, newMandate]

    setPowers({ mandates: updatedMandates })
  } catch (error) {
    console.error('@usePowersLive: MandateAdopted fetch failed', error)
  }
}

async function handleActionRequested(
  powersAddress: `0x${string}`,
  mandateId: bigint,
  chainId: ChainId
) {
  try {
    const [quantity] = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: [{
        abi: powersAbi,
        address: powersAddress,
        functionName: 'getQuantityMandateActions',
        args: [mandateId],
        chainId
      }]
    }) as [bigint]

    if (!quantity || quantity === 0n) return

    const [actionId] = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: [{
        abi: powersAbi,
        address: powersAddress,
        functionName: 'getMandateActionAtIndex',
        args: [mandateId, quantity - 1n],
        chainId
      }]
    }) as [bigint]

    const [actionState, actionData, actionCalldata, actionUri] = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: [
        { abi: powersAbi, address: powersAddress, functionName: 'getActionState', args: [actionId], chainId },
        { abi: powersAbi, address: powersAddress, functionName: 'getActionData', args: [actionId], chainId },
        { abi: powersAbi, address: powersAddress, functionName: 'getActionCalldata', args: [actionId], chainId },
        { abi: powersAbi, address: powersAddress, functionName: 'getActionUri', args: [actionId], chainId }
      ]
    }) as [number, [number, bigint, bigint, bigint, bigint, `0x${string}`, bigint], `0x${string}`, string]

    const actionIdStr = actionId.toString()
    const newAction: Action = {
      actionId: actionIdStr,
      mandateId,
      proposedAt: actionData[1],
      requestedAt: actionData[2],
      fulfilledAt: actionData[3],
      cancelledAt: actionData[4],
      caller: actionData[5],
      nonce: String(actionData[6]),
      callData: actionCalldata,
      description: actionUri,
      state: actionState
    }

    const current = usePowersStore.getState()
    const updatedMandates = current.mandates?.map(m => {
      if (m.index !== mandateId) return m
      const alreadyExists = m.actions?.some(a => a.actionId === actionIdStr)
      if (alreadyExists) return {
        ...m,
        actions: m.actions?.map(a => a.actionId === actionIdStr ? newAction : a)
      }
      return { ...m, actions: [...(m.actions || []), newAction] }
    })
    setPowers({ mandates: updatedMandates })
  } catch (error) {
    console.error('@usePowersLive: ActionRequested fetch failed', error)
  }
}
