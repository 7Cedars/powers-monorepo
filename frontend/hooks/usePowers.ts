import { Status, Action, Powers, Mandate, Metadata, Role, Conditions, ChainId, Flow } from "../context/types"
import { wagmiConfig } from '../context/wagmiConfig'
import { useCallback, useState } from "react";
import { mandateAbi, powersAbi } from "@/context/abi";
import { readContract, readContracts } from "wagmi/actions";
import { bytesToParams, parseMetadata } from "@/utils/parsers";
import { useParams } from "next/navigation";
import { setPowers, setError, setStatus } from "@/context/store";

export const usePowers = () => {
  // function to save powers to local storage
  const savePowers = (powers: Powers, address: `0x${string}`) => {
    if (typeof window === 'undefined') return
    // console.log("@savePowers, waypoint 0", {powers})
    const localStore = localStorage.getItem("powersProtocols")
    // console.log("@savePowers, waypoint 1", {localStore})
    const saved: Powers[] = localStore && localStore != "undefined" ? JSON.parse(localStore) : []
    // console.log("@savePowers, waypoint 2", {saved})
    const existing = saved.find(item => item.contractAddress == address)
    if (existing) {
      saved.splice(saved.indexOf(existing), 1)
    }
    saved.push(powers)
    localStorage.setItem("powersProtocols", JSON.stringify(saved, (key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ));
  }

  // Everytime powers is fetched these functions are called. 
  const fetchPowersData = async(powers: Powers, chainId: ChainId): Promise<Powers | undefined> => {
    const powersPopulated: Powers | undefined = powers
    // console.log("@fetchPowersData, waypoint 0", {powers})
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

      // console.log("@fetchPowersData, waypoint 1", {namePowers, uriPowers, mandateCountPowers})
      powersPopulated.name = namePowers as string
      powersPopulated.uri = uriPowers as string
      powersPopulated.mandateCount = mandateCountPowers as bigint
      powersPopulated.treasury = treasuryPowers as `0x${string}`
      powersPopulated.foundedAt = foundedAtPowers as bigint
      powersPopulated.paymaster = paymasterPowers as `0x${string}`
      console.log("@fetchPowersData, waypoint 2", {powersPopulated})
      return powersPopulated

    } catch (error) {
      // console.log("@fetchPowersData, waypoint 3", {error})
      setStatus({status: "error"}) 
      setError({error: error as Error})
    }
  }

  const fetchMetaData = async (powers: Powers, chainId: ChainId): Promise<Metadata | undefined> => {
    let updatedMetaData: Metadata | undefined

    // console.log("@fetchMetaData, waypoint 0", {powers}) 

    if (powers && powers.uri) {
      try {
          const fetchedMetadata: unknown = await(
            await fetch(powers.uri as string)
            ).json() 
            // console.log("@fetchMetaData, waypoint 1", {fetchedMetadata})
          updatedMetaData = parseMetadata(fetchedMetadata) 
          // console.log("@fetchMetaData, waypoint 2", {updatedMetaData})
          return updatedMetaData
      } catch (error) {
          // console.log("@fetchMetaData, waypoint 3", {error})
          console.warn("Failed to fetch metadata from URI, treating as empty:", error)
      }
    }
    return undefined
  }
  
  const checkMandates = async (mandateIds: bigint[], address: `0x${string}`, chainId: ChainId) => {
    const fetchedMandates: Mandate[] = []
    // console.log("@checkMandates, waypoint 0", {mandateIds, address})

    if (wagmiConfig && mandateIds.length > 0 && address) {
        try {
          const contracts = mandateIds.map((id) => ({
            abi: powersAbi,
            address: address as `0x${string}`,
            functionName: 'getAdoptedMandate' as const,
            args: [BigInt(id)] as [bigint],
            chainId: chainId
          }))
          // console.log("@checkMandates, waypoint 1", {contracts})

          const results = await readContracts(wagmiConfig, {
            allowFailure: false,
            contracts
          }) as Array<[`0x${string}`, `0x${string}`, boolean]>
          // console.log("@checkMandates, waypoint 2", {results})

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
          // console.log("@checkMandates, waypoint 3", {fetchedMandates})  
          return fetchedMandates
        } catch (error) {
          // console.log("@checkMandates, waypoint 4", {error})
          setStatus({status: "error"})
          setError({error: error as Error})
        }
    }
  }

  const populateMandates = async (mandates: Mandate[], chainId: ChainId) => {
    let mandate: Mandate
    const populatedMandates: Mandate[] = []
    // console.log("@populateMandates, waypoint 0", {mandates})

    try {
      type PendingCall = {
        kind: 'conditions' | 'inputParams' | 'nameDescription'
        mandateIdx: number
      }
      const contracts: any[] = []
      const pending: PendingCall[] = []

      mandates.forEach((l, idx) => {
        // console.log("@populateMandates, waypoint 1 loop", {l})
        if (l.mandateAddress != `0x0000000000000000000000000000000000000000`) {
          if (!l.conditions) {
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
            // console.log("@populateMandates, waypoint 1.5 loop", {contracts, l})
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

        // console.log("@populateMandates, waypoint 1.75", {results})

        // Apply results back to the corresponding mandates in order
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
      // console.log("@populateMandates, waypoint 2", {populatedMandates})
      return populatedMandates
    } catch (error) {
      // console.log("@populateMandates, waypoint 3", {error})
      setStatus({status: "error"}) 
      setError({error: error as Error})
    }
  }

  const fetchFlows = async (powersAddress: `0x${string}`, chainId: ChainId): Promise<Flow[] | undefined> => {
    try {
      const amountFlows = await readContract(wagmiConfig, {
        abi: powersAbi,
        address: powersAddress,
        functionName: 'getAmountFlows',
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
        // Build a multicall to fetch labels, uris and holder counts for all roles
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
        
        // Process results and fetch metadata in parallel
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
    // console.log("@fetchMandates, waypoint 0", {powers})
    try {
      const mandateCount = await readContract(wagmiConfig, {
        abi: powersAbi,
        address: powers.contractAddress as `0x${string}`,
        functionName: 'getMandateCounter',
        chainId: chainId
      })
      // console.log("@fetchMandates, waypoint 0.5", {mandateCount})
      const mandateIds = Array.from({length: Number(mandateCount) - 1}, (_, i) => BigInt(i+1))
      const mandates = await checkMandates(mandateIds, powers.contractAddress, chainId)
      // console.log("@fetchMandates, waypoint 1", {mandateCount, mandateIds, mandates})
      if (mandates) {
        const mandatesPopulated = await populateMandates(mandates, chainId)
        // console.log("@fetchMandates, waypoint 2", {mandatesPopulated})
        return mandatesPopulated
      } else {
        // console.log("@fetchMandates, waypoint 3", {mandates})
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
    // console.log("@populateActions, waypoint 0", {actionIds, powersAddress})
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
        number,      // mandateId (uint16)
        bigint,      // proposedAt (uint48)
        bigint,      // requestedAt (uint48)
        bigint,      // fulfilledAt (uint48)
        bigint,      // cancelledAt (uint48)
        `0x${string}`, // caller (address)
        bigint       // nonce (uint256)
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
  
  // Returns a mapping of non-stale actionIds to their mandateId and index
  const fetchActions = async (mandates: Mandate[], chainId: ChainId): Promise<Mandate[] | undefined> => {
    // console.log("@fetchActions, waypoint 0", {mandates})
    const activeMandates = mandates.filter((mandate) => mandate.active)

    // Step 1: Identify stale actions by mandate
    const staleActionsByMandate = new Map<string, Set<number>>() // mandateId -> Set of stale indices
    
    activeMandates.forEach((mandate) => {
      const savedActions = mandate.actions || []
      const staleIndices = new Set<number>()
      
      savedActions.forEach((action, index) => {
        // State 2, 4, or 7 are stale (Defeated, Fulfilled, or NonExistent)
        if (action.state === 2 || action.state === 4 || action.state === 7) {
          staleIndices.add(index)
        }
      })
      
      if (staleIndices.size > 0) {
        staleActionsByMandate.set(mandate.index.toString(), staleIndices)
      }
    })

    // console.log("@fetchActions, waypoint 1", {staleActionsByMandate})

    // Step 2: Fetch action quantities for each active mandate
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

    // console.log("@fetchActions, waypoint 2", {actionQuantities})

    // Step 3: Create list of non-stale action indices to fetch per mandate
    type FetchRequest = {
      mandateId: bigint
      actionIndex: number
    }
    
    const fetchRequests: FetchRequest[] = []
    
    actionQuantities.forEach((quantity, mandateIndex) => {
      const mandate = activeMandates[mandateIndex]
      const mandateId = mandate.index
      const staleIndices = staleActionsByMandate.get(mandateId.toString()) || new Set()
      
      // Create requests for non-stale indices only
      for (let i = 0; i < Number(quantity); i++) {
        if (!staleIndices.has(i)) {
          fetchRequests.push({
            mandateId,
            actionIndex: i
          })
        }
      }
    })

    // console.log("@fetchActions, waypoint 3", {fetchRequests})

    // Early exit if no actions to fetch
    if (fetchRequests.length === 0) {
      return mandates
    }

    // Step 4: Fetch actionIds for non-stale actions
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

    // console.log("@fetchActions, waypoint 4", {actionIds})

    // Step 5: Create mapping of actionId -> { mandateId, index }
    const actionIdMapping = new Map<string, { mandateId: bigint, index: number }>()
    
    fetchRequests.forEach((req, idx) => {
      const actionId = actionIds[idx]
      actionIdMapping.set(actionId.toString(), {
        mandateId: req.mandateId,
        index: req.actionIndex
      })
    })

    // Step 6: Populate actions with full data
    const actionIdsArray = Array.from(actionIdMapping.keys())
    const populatedActions = await populateActions(actionIdsArray, activeMandates[0].powers as `0x${string}`, chainId)

    // Step 7: Organize actions by mandate and index
    const actionsByMandate = new Map<string, Map<number, Action>>() // mandateId -> (index -> Action)
    
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

    // console.log("@fetchActions, waypoint 5", {actionsByMandate})

    // Step 8: Update mandates with populated actions (including stale actions)
    const updatedMandates = mandates.map((mandate) => {
      const mandateKey = mandate.index.toString()
      const newActionsByIndex = actionsByMandate.get(mandateKey)
      
      if (!newActionsByIndex && !mandate.active) {
        // Inactive mandate with no new actions - keep as is
        return mandate
      }
      
      // Get the total quantity for this mandate
      const mandateIndex = activeMandates.findIndex(l => l.index === mandate.index)
      const quantity = mandateIndex >= 0 ? Number(actionQuantities[mandateIndex]) : 0
      
      if (quantity === 0) {
        return { ...mandate, actions: [] }
      }
      
      // Build actions array with correct indices
      const actionsArray: Action[] = new Array(quantity)
      const savedActions = mandate.actions || []
      const staleIndices = staleActionsByMandate.get(mandateKey) || new Set()
      
      // First, place stale actions at their indices
      savedActions.forEach((action, index) => {
        if (staleIndices.has(index)) {
          actionsArray[index] = action
        }
      })
      
      // Then, place newly fetched actions at their indices
      if (newActionsByIndex) {
        newActionsByIndex.forEach((action, index) => {
          actionsArray[index] = action
        })
      }
      
      // Filter out undefined entries
      const finalActions = actionsArray.filter(a => a !== undefined)
      
      return {
        ...mandate,
        actions: finalActions
      }
    })

    // console.log("@fetchActions, waypoint 6", {updatedMandates})
    return updatedMandates
  }

  const fetchPowers = useCallback(
    async (address: `0x${string}`, chainId: ChainId) => {
      // console.log("@fetchPowers, waypoint 0", {address, chainId})
      setStatus({status: "pending"})
      let metaData: Metadata | undefined
      let mandates: Mandate[] | undefined
      let mandateWithActions: Mandate[] | undefined
      let roles: Role[] | undefined
      let flows: Flow[] | undefined

      let existing: Powers | undefined
      const localStore = localStorage.getItem("powersProtocols")
      const saved: Powers[] = localStore && localStore != "undefined" ? JSON.parse(localStore) : []
      existing = saved.find(item => item.contractAddress == address)

      const powersToBeUpdated = existing ? existing : {
        contractAddress: address,
        chainId: BigInt(chainId)
      }
      // console.log("@refetchPowers, waypoint 1", {powersToBeUpdated})

      try {
        const data = await fetchPowersData(powersToBeUpdated, chainId)
        // console.log("@refetchPowers, waypoint 2", {data})
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

        // console.log("@refetchPowers, waypoint 4", {metaData, mandates})

        if (data != undefined && mandates != undefined) {
          // console.log("@refetchPowers, waypoint 7", {data, metaData, mandates})
          const newPowers: Powers = {
            contractAddress: powersToBeUpdated.contractAddress as `0x${string}`,
            chainId: BigInt(chainId),
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
          // console.log("@refetchPowers, waypoint 8", {newPowers})
          setPowers(newPowers)
          savePowers(newPowers, address)
          setStatus({status: "success"})
        }
      } catch (error) {
        //  console.error("@fetchPowers error:", error)
        setStatus({status: "error"})
        setError({error: error as Error})
      }
    }, [] 
  )

  return {fetchPowers}  
}
