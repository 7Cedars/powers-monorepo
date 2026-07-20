import { Status, Action, Powers, Mandate, Metadata, Role, Conditions, ChainId, Flow } from "../context/types"
import { wagmiConfig } from '../context/wagmiConfig'
import { useCallback, useState } from "react";
import { mandateAbi, powersAbi } from "@/context/abi";
import { readContract, readContracts, getBlockNumber } from "wagmi/actions";
import { bytesToParams, parseMetadata } from "@/utils/parsers";
import { useParams } from "next/navigation";
import { setPowers, setError, setStatus } from "@/context/store";
import { stringifyWithBigInt, parseWithBigInt } from "@/utils/localStorage";

export const usePowers = () => {
  // function to save powers to local storage
  const savePowers = (powers: Powers, address: `0x${string}`) => {
    if (typeof window === 'undefined') return
    const localStore = localStorage.getItem("powersProtocols")
    const saved: Powers[] = localStore && localStore != "undefined" ? parseWithBigInt<Powers[]>(localStore) : []
    const existing = saved.find(item => item.contractAddress == address)
    if (existing) {
      saved.splice(saved.indexOf(existing), 1)
    }
    saved.push(powers)
    localStorage.setItem("powersProtocols", stringifyWithBigInt(saved));
  }

  // Everytime powers is fetched these functions are called. 
  const fetchPowersData = async(powers: Powers, chainId: ChainId): Promise<Powers | undefined> => {
    const powersPopulated: Powers | undefined = powers
    try { 
      const [ namePowers, uriPowers, mandateCountPowers, treasuryPowers, foundedAtPowers, paymasterPowers ] = await readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: [
          {
            address: powers.contractAddress as `0x${string}`,
            abi: powersAbi,
            functionName: 'name',
            chainId: chainId
          },
          {
            address: powers.contractAddress as `0x${string}`,
            abi: powersAbi,
            functionName: 'uri',
            chainId: chainId
          },
          {
            address: powers.contractAddress as `0x${string}`,
            abi: powersAbi,
            functionName: 'mandateCounter',
            chainId: chainId
          },
          {
            address: powers.contractAddress as `0x${string}`,
            abi: powersAbi,
            functionName: 'getTreasury',
            chainId: chainId
          },
          {
            address: powers.contractAddress as `0x${string}`,
            abi: powersAbi,
            functionName: 'FOUNDED_AT',
            chainId: chainId
          },
          {
            address: powers.contractAddress as `0x${string}`,
            abi: powersAbi,
            functionName: 'paymaster',
            chainId: chainId
          }
        ]
      }) as [string, string, bigint, `0x${string}`, bigint, `0x${string}` ]

      powersPopulated.name = namePowers as string
      powersPopulated.uri = uriPowers as string
      powersPopulated.mandateCount = mandateCountPowers as bigint
      powersPopulated.treasury = treasuryPowers as `0x${string}`
      powersPopulated.foundedAt = foundedAtPowers as bigint
      powersPopulated.paymaster = paymasterPowers as `0x${string}`
      console.log("@fetchPowersData, waypoint 2", {powersPopulated})
      return powersPopulated

    } catch (error) {
      setStatus({status: "error"}) 
      setError({error: error as Error})
    }
  }

  const fetchMetaData = async (powers: Powers, chainId: ChainId): Promise<Metadata | undefined> => {
    let updatedMetaData: Metadata | undefined

    if (powers && powers.uri) {
      try {
          const fetchedMetadata: unknown = await(
            await fetch(powers.uri as string)
            ).json() 
          updatedMetaData = parseMetadata(fetchedMetadata) 
          return updatedMetaData
      } catch (error) {
          console.warn("Failed to fetch metadata from URI, treating as empty:", error)
      }
    }
    return undefined
  }
  
  const checkMandates = async (mandateIds: bigint[], address: `0x${string}`, chainId: ChainId) => {
    if (mandateIds.length === 0) return []

    const fetchedMandates: Mandate[] = []

    if (wagmiConfig && address) {
        try {
          const contracts = mandateIds.map((id) => ({
            abi: powersAbi,
            address: address as `0x${string}`,
            functionName: 'getAdoptedMandate' as const,
            args: [BigInt(id)] as [bigint],
            chainId: chainId
          }))

          const results = await readContracts(wagmiConfig, {
            allowFailure: false,
            contracts
          }) as Array<[`0x${string}`, `0x${string}`, boolean]>

          results.forEach((mandateTuple, idx) => {
            const id = mandateIds[idx]
            fetchedMandates.push({
              powers: address,
              mandateAddress: mandateTuple[0] as unknown as `0x${string}`,
              mandateHash: mandateTuple[1] as unknown as `0x${string}`,
              index: id,
              active: mandateTuple[2] as unknown as boolean
            })
          })
          return fetchedMandates
        } catch (error) {
          setStatus({status: "error"})
          setError({error: error as Error})
        }
    }
  }

  const populateMandates = async (mandates: Mandate[], chainId: ChainId) => {
    let mandate: Mandate
    const populatedMandates: Mandate[] = []

    try {
      type PendingCall = {
        kind: 'conditions' | 'inputParams' | 'nameDescription'
        mandateIdx: number
      }
      const contracts: any[] = []
      const pending: PendingCall[] = []

      mandates.forEach((l, idx) => {
        if (l.mandateAddress != `0x0000000000000000000000000000000000000000`) {
          if (!l.conditions || l.conditions.throttleExecution === undefined) {
            contracts.push({
              abi: powersAbi,
              address: l.powers as `0x${string}`,
              functionName: 'getConditions',
              args: [l.index],
              chainId: chainId!
            })
            pending.push({ kind: 'conditions', mandateIdx: idx })
          }
          if (!l.inputParams) {
            contracts.push({
              abi: mandateAbi,
              address: l.mandateAddress as `0x${string}`,
              functionName: 'getInputParams',
              args: [l.powers, l.index],
              chainId: chainId!
            })
            pending.push({ kind: 'inputParams', mandateIdx: idx })
          }
          if (!l.nameDescription) {
            contracts.push({
              abi: mandateAbi,
              address: l.mandateAddress as `0x${string}`,
              functionName: 'getNameDescription',
              args: [l.powers, l.index],
              chainId: chainId!
            })
            pending.push({ kind: 'nameDescription', mandateIdx: idx })
          }
        }
      })

      if (contracts.length > 0) {
        const results = await readContracts(wagmiConfig, {
          allowFailure: false,
          contracts
        })

        results.forEach((value, i) => {
          const meta = pending[i]
          const target = mandates[meta.mandateIdx]
          if (meta.kind === 'conditions') {
            target.conditions = value as Conditions
          } else if (meta.kind === 'inputParams') {
            target.inputParams = value as `0x${string}`
            target.params = bytesToParams(target.inputParams)
          } else if (meta.kind === 'nameDescription') {
            target.nameDescription = value as string
          }
        })
      }

      for (mandate of mandates) {
        populatedMandates.push(mandate)
      }
      return populatedMandates
    } catch (error) {
      setStatus({status: "error"}) 
      setError({error: error as Error})
    }
  }

  const fetchFlows = async (powersAddress: `0x${string}`, chainId: ChainId): Promise<Flow[] | undefined> => {
    try {
      const amountFlows = await readContract(wagmiConfig, {
        abi: powersAbi,
        address: powersAddress,
        functionName: 'getFlowCount',
        chainId: chainId
      }) as bigint

      if (amountFlows === 0n) return []

      const flowIndices = Array.from({ length: Number(amountFlows) }, (_, i) => i)
      
      const contracts = flowIndices.flatMap(i => [
        {
          abi: powersAbi,
          address: powersAddress,
          functionName: 'getFlowMandatesAtIndex',
          args: [i],
          chainId: chainId
        },
        {
          abi: powersAbi,
          address: powersAddress,
          functionName: 'getFlowDescriptionAtIndex',
          args: [i],
          chainId: chainId
        }
      ])

      const results = await readContracts(wagmiConfig, {
        allowFailure: false,
        contracts
      })

      const flows: Flow[] = []
      
      for (let i = 0; i < flowIndices.length; i++) {
        const mandateIds = results[i * 2] as readonly number[] | readonly bigint[]
        const nameDescription = results[i * 2 + 1] as string
        
        flows.push({
          nameDescription,
          mandateIds: mandateIds.map(id => BigInt(id))
        })
      }

      return flows
    } catch (error) {
      console.warn("Failed to fetch flows", error)
      return undefined
    }
  }

  const fetchRoles = async (mandates: Mandate[], chainId: ChainId): Promise<Role[] | undefined> => {
    const rolesIds = new Set(
      mandates
        .filter((mandate) => mandate.active)
        .map((mandate) => mandate.conditions?.allowedRole)
        .filter((role) => role !== undefined)
    ) as Set<bigint>;
 
    if (rolesIds.size > 0) {
      try {
        const contracts = Array.from(rolesIds).flatMap((roleId) => ([
          {
            abi: powersAbi,
            address: mandates[0].powers as `0x${string}`,
            functionName: 'getRoleLabel' as const,
            args: [roleId] as [bigint],
            chainId: chainId
          },
          {
            abi: powersAbi,
            address: mandates[0].powers as `0x${string}`,
            functionName: 'getRoleMetadata' as const,
            args: [roleId] as [bigint],
            chainId: chainId
          },
          {
            abi: powersAbi,
            address: mandates[0].powers as `0x${string}`,
            functionName: 'getAmountRoleHolders' as const,
            args: [roleId] as [bigint],
            chainId: chainId
          }
        ]))

        const results = await readContracts(wagmiConfig, {
          allowFailure: true,
          contracts
        })
        
        const rolePromises = Array.from(rolesIds).map(async (roleId, i) => {
          const labelResult = results[i * 3]
          const metadataResult = results[i * 3 + 1]
          const holdersResult = results[i * 3 + 2]
          
          const label = labelResult.status === 'success' ? labelResult.result as string : `Role ${roleId}`
          const metadata = metadataResult.status === 'success' ? metadataResult.result as string : undefined
          const holders = holdersResult.status === 'success' ? holdersResult.result as bigint : undefined

          let description: string | undefined
          let icon: string | undefined

          if (metadata && metadata.startsWith('http')) {
             try {
               const response = await fetch(metadata)
               const json = await response.json()
               if (json && typeof json === 'object') {
                 // @ts-ignore
                 description = json.description 
                 // @ts-ignore
                 icon = json.icon 
               }
             } catch (e) {
               console.warn(`Failed to fetch metadata for role ${roleId}`, e)
             }
          }

          return { 
            roleId: roleId as bigint, 
            label, 
            metadata, 
            amountHolders: holders,
            description,
            icon
          } as Role
        })

        const updatedRoleLabels = await Promise.all(rolePromises)
        return updatedRoleLabels
      } catch (error) {
        setStatus({status: "error"})
        setError({error: error as Error})
        return []
      }
    }
  }

  const fetchMandates = async (powers: Powers, chainId: ChainId): Promise<Mandate[] | undefined> => {
    try {
      const mandateCount = await readContract(wagmiConfig, {
        abi: powersAbi,
        address: powers.contractAddress as `0x${string}`,
        functionName: 'getMandateCounter',
        chainId: chainId
      })
      const mandateIds = Array.from({length: Number(mandateCount) - 1}, (_, i) => BigInt(i+1))
      const mandates = await checkMandates(mandateIds, powers.contractAddress, chainId)
      if (mandates) {
        const mandatesPopulated = await populateMandates(mandates, chainId)
        return mandatesPopulated
      } else {
        setStatus({status: "error"})
        setError({error: Error("Failed to fetch mandates")})
        return undefined
      }
    } catch (error) {
      setStatus({status: "error"})
      setError({error: error as Error})
      return undefined
    }
  }

  const populateActions = async(actionIds: string[], powersAddress: `0x${string}`, chainId: ChainId): Promise<Action[]> => {
    if (actionIds.length === 0) return []

    const [stateResults, dataResults, calldataResults, metadataResults] = await Promise.all([
      readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: actionIds.map((actionId) => ({
          abi: powersAbi,
          address: powersAddress as `0x${string}`,
          functionName: 'getActionState' as const,
          args: [BigInt(actionId)],
          chainId: chainId
        }))
      }) as Promise<Array<number>>,
 
      readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: actionIds.map((actionId) => ({
          abi: powersAbi,
          address: powersAddress as `0x${string}`,
          functionName: 'getActionData' as const,
          args: [BigInt(actionId)],
          chainId: chainId
        }))
      }) as Promise<Array<[
        number,
        bigint,
        bigint,
        bigint,
        bigint,
        `0x${string}`,
        bigint
      ]>>,
 
      readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: actionIds.map((actionId) => ({
          abi: powersAbi,
          address: powersAddress as `0x${string}`,
          functionName: 'getActionCalldata' as const,
          args: [BigInt(actionId)],
          chainId: chainId
        }))
      }) as Promise<Array<`0x${string}`>>,

      readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: actionIds.map((actionId) => ({
          abi: powersAbi,
          address: powersAddress as `0x${string}`,
          functionName: 'getActionUri' as const,
          args: [BigInt(actionId)],
          chainId: chainId
        }))
      }) as Promise<Array<string>>
    ])

    const actions: Action[] = actionIds.map((actionId, idx) => {
      const data = dataResults[idx]
      
      return {
        actionId: actionId,
        mandateId: BigInt(data[0]),
        proposedAt: data[1],
        requestedAt: data[2],
        fulfilledAt: data[3],
        cancelledAt: data[4],
        caller: data[5],
        nonce: String(data[6]),
        callData: calldataResults[idx],
        description: metadataResults[idx],
        state: stateResults[idx]
      }
    })

    return actions
  }
  
  const fetchActions = async (mandates: Mandate[], chainId: ChainId): Promise<Mandate[] | undefined> => {
    const activeMandates = mandates.filter((mandate) => mandate.active)

    const staleActionsByMandate = new Map<string, Set<number>>()

    activeMandates.forEach((mandate) => {
      const savedActions = mandate.actions || []
      const staleIndices = new Set<number>()
      
      savedActions.forEach((action, index) => {
        if (action.state === 2 || action.state === 4 || action.state === 7) {
          staleIndices.add(index)
        }
      })
      
      if (staleIndices.size > 0) {
        staleActionsByMandate.set(mandate.index.toString(), staleIndices)
      }
    })

    const actionQuantities = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: activeMandates.map((mandate) => ({
        abi: powersAbi,
        address: activeMandates[0].powers as `0x${string}`,
        functionName: 'getQuantityMandateActions' as const,
        args: [mandate.index],
        chainId: chainId
      }))
    }) as Array<bigint>

    type FetchRequest = {
      mandateId: bigint
      actionIndex: number
    }
    
    const fetchRequests: FetchRequest[] = []
    
    actionQuantities.forEach((quantity, mandateIndex) => {
      const mandate = activeMandates[mandateIndex]
      const mandateId = mandate.index
      const staleIndices = staleActionsByMandate.get(mandateId.toString()) || new Set()
      
      for (let i = 0; i < Number(quantity); i++) {
        if (!staleIndices.has(i)) {
          fetchRequests.push({
            mandateId,
            actionIndex: i
          })
        }
      }
    })

    if (fetchRequests.length === 0) {
      return mandates
    }

    const actionIds = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: fetchRequests.map((req) => ({
        abi: powersAbi,
        address: activeMandates[0].powers as `0x${string}`,
        functionName: 'getMandateActionAtIndex' as const,
        args: [req.mandateId, BigInt(req.actionIndex)],
        chainId: chainId
      }))
    }) as Array<bigint>

    const actionIdMapping = new Map<string, { mandateId: bigint, index: number }>()
    
    fetchRequests.forEach((req, idx) => {
      const actionId = actionIds[idx]
      actionIdMapping.set(actionId.toString(), {
        mandateId: req.mandateId,
        index: req.actionIndex
      })
    })

    const actionIdsArray = Array.from(actionIdMapping.keys())
    const populatedActions = await populateActions(actionIdsArray, activeMandates[0].powers as `0x${string}`, chainId)

    const actionsByMandate = new Map<string, Map<number, Action>>()
    
    populatedActions.forEach((action) => {
      const mapping = actionIdMapping.get(action.actionId)
      if (mapping) {
        const mandateKey = mapping.mandateId.toString()
        
        if (!actionsByMandate.has(mandateKey)) {
          actionsByMandate.set(mandateKey, new Map())
        }
        
        actionsByMandate.get(mandateKey)!.set(mapping.index, action)
      }
    })

    const updatedMandates = mandates.map((mandate) => {
      const mandateKey = mandate.index.toString()
      const newActionsByIndex = actionsByMandate.get(mandateKey)
      
      if (!newActionsByIndex && !mandate.active) {
        return mandate
      }

      const mandateIndex = activeMandates.findIndex(l => l.index === mandate.index)
      const quantity = mandateIndex >= 0 ? Number(actionQuantities[mandateIndex]) : 0
      
      if (quantity === 0) {
        return { ...mandate, actions: [] }
      }
      
      const actionsArray: Action[] = new Array(quantity)
      const savedActions = mandate.actions || []
      const staleIndices = staleActionsByMandate.get(mandateKey) || new Set()
      
      savedActions.forEach((action, index) => {
        if (staleIndices.has(index)) {
          actionsArray[index] = action
        }
      })
      
      if (newActionsByIndex) {
        newActionsByIndex.forEach((action, index) => {
          actionsArray[index] = action
        })
      }
      
      const finalActions = actionsArray.filter(a => a !== undefined)
      
      return {
        ...mandate,
        actions: finalActions
      }
    })

    return updatedMandates
  }

  // ============ COLD FETCH LOGIC ============
  const coldFetch = async (
    address: `0x${string}`,
    chainId: ChainId,
    existingPowers?: Powers
  ): Promise<Powers | undefined> => {
    console.log("@coldFetch: Full data refresh for", address)
    
    let metaData: Metadata | undefined
    let mandates: Mandate[] | undefined
    let mandateWithActions: Mandate[] | undefined
    let roles: Role[] | undefined
    let flows: Flow[] | undefined

    const powersToBeUpdated = existingPowers ? existingPowers : {
      contractAddress: address,
      chainId: BigInt(chainId)
    }

    try {
      const data = await fetchPowersData(powersToBeUpdated, chainId)
      if (data) {
        [metaData, mandates] = await Promise.all([
          fetchMetaData(data, chainId),
          fetchMandates(data, chainId)
        ])
      }
      if (mandates) {
        mandateWithActions = await fetchActions(mandates, chainId)
        roles = await fetchRoles(mandates, chainId)
        flows = await fetchFlows(address, chainId)
      }

      if (data != undefined && mandates != undefined) {
        // Get current block number for lastFetched
        const currentBlock = await getBlockNumber(wagmiConfig, { chainId })
        
        const newPowers: Powers = {
          contractAddress: powersToBeUpdated.contractAddress as `0x${string}`,
          chainId: BigInt(chainId),
          lastFetched: currentBlock,
          name: data.name,
          metadatas: metaData,
          uri: data.uri,
          treasury: data.treasury,
          paymaster: data.paymaster,
          foundedAt: data.foundedAt,
          mandateCount: data.mandateCount,
          mandates: mandateWithActions,
          roles: roles,
          flows: flows,
          layout: powersToBeUpdated.layout
        }
        return newPowers
      }
    } catch (error) {
      console.error("@coldFetch error:", error)
      throw error
    }
    return undefined
  }

  // ============ MAIN FETCH FUNCTION ============
  const fetchPowers = useCallback(
    async (address: `0x${string}`, chainId: ChainId) => {
      console.log("@fetchPowers: Starting cold fetch for", address)
      setStatus({status: "pending"})

      try {
        let existing: Powers | undefined
        const localStore = localStorage.getItem("powersProtocols")
        const saved: Powers[] = localStore && localStore != "undefined" ? parseWithBigInt<Powers[]>(localStore) : []
        existing = saved.find(item => item.contractAddress == address)

        const newPowers = await coldFetch(address, chainId, existing)

        if (newPowers) {
          setPowers(newPowers)
          savePowers(newPowers, address)
          setStatus({status: "success"})
        } else {
          setStatus({status: "error"})
          setError({error: Error("Failed to fetch powers data")})
        }
      } catch (error) {
        console.error("@fetchPowers error:", error)
        setStatus({status: "error"})
        setError({error: error as Error})
      }
    }, []
  )

  return {fetchPowers}  
}