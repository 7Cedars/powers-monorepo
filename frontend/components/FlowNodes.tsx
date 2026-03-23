'use client'

import React, { useMemo } from 'react'
import {
  Handle,
  Position,
  NodeProps,
} from 'reactflow'
import { Mandate, Powers, Action, Status } from '@/context/types'
import { toFullDateFormat, toEurTimeFormat } from '@/utils/toDates'
import { useBlocks } from '@/hooks/useBlocks'
import { parseChainId } from '@/utils/parsers'
import { fromFutureBlockToDateTime } from '@/organisations/helpers'
import { useBlockNumber } from 'wagmi'
import {
  CalendarDaysIcon,
  QueueListIcon,  
  DocumentCheckIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
  FlagIcon,
} from '@heroicons/react/24/outline'
import { bigintToRole } from '@/utils/bigintTo'
import { hashAction } from '@/utils/hashAction'

// Node dimensions
export const NODE_WIDTH = 220
export const NODE_SPACING_X = 280
export const NODE_SPACING_Y = 160

// Handle styling
const HANDLE_STYLE = {
  width: 7,
  height: 7,
  background: 'hsl(var(--muted-foreground))',
  border: 'none',
}

// Helper function to get action data for all mandates in the dependency chain
export function getActionDataForChain(
  selectedAction: Action | undefined,
  mandates: Mandate[],
  powers: Powers
): Map<string, Action> {
  const actionDataMap = new Map<string, Action>()
  
  // If no selected action or no calldata/nonce, return empty map
  if (!selectedAction || !selectedAction.callData || !selectedAction.nonce) {
    return actionDataMap
  }
  
  // For each mandate, calculate the actionId and look up the action data
  mandates.forEach(mandate => {
    const mandateId = mandate.index
    const calculatedActionId = hashAction(mandateId, selectedAction.callData!, BigInt(selectedAction.nonce!))
    
    // Check if this action exists in the Powers object
    const mandateData = powers.mandates?.find(l => l.index === mandateId)
    if (mandateData && mandateData.actions) {
      const action = mandateData.actions.find(a => a.actionId === String(calculatedActionId))
      if (action) {
        actionDataMap.set(String(mandateId), action)
      }
    }
  })
  
  return actionDataMap
}

export interface MandateSchemaNodeData {
  mandate: Mandate
  powers: Powers
  onNodeClick: (mandateId: string) => void
  chainActionData: Map<string, Action>
  chainId: string
  isHighlighted?: boolean
}

const MandateSchemaNode: React.FC<NodeProps<MandateSchemaNodeData>> = ({ data }) => {
  const { mandate, powers, onNodeClick, chainActionData, chainId, isHighlighted } = data
  const { timestamps, fetchTimestamps } = useBlocks()
  const { data: blockNumber } = useBlockNumber()
  const cond = mandate.conditions

  const mandateName = mandate.nameDescription?.split(':')[0] ?? `Mandate ${mandate.index}`
  const roleName = cond ? bigintToRole(cond.allowedRole, powers) : ''

  const hasVote = cond?.quorum != null && cond.quorum > 0n
  const hasTimelock = cond?.timelock != null && cond.timelock > 0n
  const hasThrottle = cond?.throttleExecution != null && cond.throttleExecution > 0n
  const needsFulfilled = !!(cond?.needFulfilled && cond.needFulfilled !== 0n)
  const needsNotFulfilled = !!(cond?.needNotFulfilled && cond.needNotFulfilled !== 0n)

  // Get action data for this mandate
  const currentMandateAction = chainActionData.get(String(mandate.index))

  // Fetch timestamps for the current mandate's action data
  React.useEffect(() => {
    if (currentMandateAction) {
      const blockNumbers: bigint[] = []
      
      // Collect all block numbers that need timestamps
      if (currentMandateAction.proposedAt && currentMandateAction.proposedAt !== 0n) {
        blockNumbers.push(currentMandateAction.proposedAt)
      }
      if (currentMandateAction.requestedAt && currentMandateAction.requestedAt !== 0n) {
        blockNumbers.push(currentMandateAction.requestedAt)
      }
      if (currentMandateAction.fulfilledAt && currentMandateAction.fulfilledAt !== 0n) {
        blockNumbers.push(currentMandateAction.fulfilledAt)
      }
      
      // Also fetch timestamps for dependent mandates
      if (mandate.conditions) {
        if (mandate.conditions.needFulfilled != null && BigInt(mandate.conditions.needFulfilled) != 0n) {
          const dependentAction = chainActionData.get(String(mandate.conditions.needFulfilled))
          if (dependentAction && dependentAction.fulfilledAt && dependentAction.fulfilledAt != 0n) {
            blockNumbers.push(dependentAction.fulfilledAt)
          }
        }
        if (mandate.conditions.needNotFulfilled != null && BigInt(mandate.conditions.needNotFulfilled) != 0n) {
          const dependentAction = chainActionData.get(String(mandate.conditions.needNotFulfilled))
          if (dependentAction && dependentAction.fulfilledAt && dependentAction.fulfilledAt != 0n) {
            blockNumbers.push(dependentAction.fulfilledAt)
          }
        }
      }
      
      // Fetch timestamps if we have block numbers
      if (blockNumbers.length > 0) {
        fetchTimestamps(blockNumbers, chainId)
      }
    }
  }, [chainActionData, mandate.index, mandate.conditions, chainId, fetchTimestamps, currentMandateAction])

  // Helper function to format block number or timestamp to desired format
  const formatBlockNumberOrTimestamp = (value: bigint | undefined): string | null => {
    if (!value || value === 0n) {
      return null
    }
    
    try {
      // First, check if we have this as a cached timestamp from useBlocks
      const cacheKey = `${chainId}:${value}`
      const cachedTimestamp = timestamps.get(cacheKey)
      
      if (cachedTimestamp && cachedTimestamp.timestamp) {
        // Convert bigint timestamp to number for the utility functions
        const timestampNumber = Number(cachedTimestamp.timestamp)
        const dateStr = toFullDateFormat(timestampNumber)
        const timeStr = toEurTimeFormat(timestampNumber)
        return `${dateStr}: ${timeStr}`
      }
      
      // If not in cache, it might be a direct timestamp (fallback)
      const valueNumber = Number(value)
      
      // If it's a very large number, treat as timestamp
      if (valueNumber > 1000000000) { // Unix timestamp threshold
        const dateStr = toFullDateFormat(valueNumber)
        const timeStr = toEurTimeFormat(valueNumber)
        return `${dateStr}: ${timeStr}`
      }
      
      // If it's a smaller number, it's likely a block number that hasn't been fetched yet
      return null
    } catch (error) {
      return null
    }
  }

  // Helper function to get date for each check item
  const getCheckItemDate = (itemKey: string): string | null => {
    switch (itemKey) {
      case 'needFulfilled':
      case 'needNotFulfilled': {
        const dependentMandateId = itemKey == 'needFulfilled' 
          ? mandate.conditions?.needFulfilled 
          : mandate.conditions?.needNotFulfilled
        
        if (dependentMandateId && dependentMandateId != 0n) {
          const dependentAction = chainActionData.get(String(dependentMandateId))
          return formatBlockNumberOrTimestamp(dependentAction?.fulfilledAt)
        }
        return null
      }
      
      case 'proposalCreated': {
        if (currentMandateAction && currentMandateAction.proposedAt && currentMandateAction.proposedAt != 0n) {
          return formatBlockNumberOrTimestamp(currentMandateAction.proposedAt)
        }
        return null
      }
      
      case 'voteEnded': {
        if (currentMandateAction && currentMandateAction.proposedAt && currentMandateAction.proposedAt != 0n && mandate.conditions?.votingPeriod && blockNumber != null) {
          const parsedChainId = parseChainId(chainId)
          if (parsedChainId == null) return null
          
          const voteEndBlock = BigInt(currentMandateAction.proposedAt) + BigInt(mandate.conditions.votingPeriod)
          return fromFutureBlockToDateTime(voteEndBlock, BigInt(blockNumber), parsedChainId)
        }
        return null
      }

      case 'delay': {
        if (currentMandateAction && currentMandateAction.proposedAt && currentMandateAction.proposedAt != 0n && mandate.conditions?.timelock && mandate.conditions.timelock != 0n && blockNumber != null) {
          const parsedChainId = parseChainId(chainId)
          if (parsedChainId == null) return null
          
          const delayEndBlock = BigInt(currentMandateAction.proposedAt) + BigInt(mandate.conditions.timelock)
          return fromFutureBlockToDateTime(delayEndBlock, BigInt(blockNumber), parsedChainId)
        }
        return null
      }
      
      case 'requested': {
        if (currentMandateAction && currentMandateAction.requestedAt && currentMandateAction.requestedAt != 0n) {
          return formatBlockNumberOrTimestamp(currentMandateAction.requestedAt)
        }
        return null
      }
      
      case 'throttle':
        if (mandate.conditions?.throttleExecution && blockNumber != null) {  
          const latestFulfilledAction = mandate.actions ? Math.max(...mandate.actions.map(action => Number(action.fulfilledAt)), 1) : 0
          const parsedChainId = parseChainId(chainId)
          if (parsedChainId == null) return null

          const throttlePassBlock = BigInt(latestFulfilledAction + Number(mandate.conditions.throttleExecution))
          return fromFutureBlockToDateTime(throttlePassBlock, BigInt(blockNumber), parsedChainId)
        }
        return null
      
      case 'fulfilled':        
        if (currentMandateAction && currentMandateAction.fulfilledAt && currentMandateAction.fulfilledAt != 0n) {
          return formatBlockNumberOrTimestamp(currentMandateAction.fulfilledAt)
        }
        return null
      
      default:
        return null
    }
  }

  // Determine status for each check item
  const getCheckItemStatus = (itemKey: string): Status => {
    switch (itemKey) {
      case 'needFulfilled': {
        const dependentAction = chainActionData.get(String(mandate.conditions?.needFulfilled))
        return dependentAction?.fulfilledAt && dependentAction.fulfilledAt > 0n ? "success" : "pending"
      }
      case 'needNotFulfilled': {
        const dependentAction = chainActionData.get(String(mandate.conditions?.needNotFulfilled))
        return dependentAction?.fulfilledAt && dependentAction.fulfilledAt > 0n ? "error" : "success"
      }
      case 'throttle': {
        const latestFulfilledAction = mandate.actions ? Math.max(...mandate.actions.map(action => Number(action.fulfilledAt)), 1) : 0
        const throttledPassed = (latestFulfilledAction + Number(mandate.conditions?.throttleExecution || 0)) < Number(blockNumber || 0)
        return throttledPassed ? "success" : "error"
      }
      case 'proposalCreated': {
        return currentMandateAction?.proposedAt && currentMandateAction.proposedAt > 0n ? "success" : "pending"
      }
      case 'voteEnded': {
        return currentMandateAction?.state && currentMandateAction?.state == 4 ? "error" :
               currentMandateAction?.state && currentMandateAction?.state >= 5 ? "success" :
               "pending"
      }
      case 'delay': {
        return currentMandateAction?.proposedAt && mandate.conditions?.timelock ? 
               currentMandateAction?.proposedAt + mandate.conditions.timelock < BigInt(blockNumber || 0) ? "success" : "pending" : 
               "pending"
      }
      case 'requested': {
        return currentMandateAction?.requestedAt && currentMandateAction.requestedAt > 0n ? "success" : "pending"
      }
      case 'fulfilled': {
        return currentMandateAction?.fulfilledAt && currentMandateAction.fulfilledAt > 0n ? "success" : "pending"
      }
      default:
        return "pending"
    }
  }

  // Build check items based on mandate conditions
  const checkItems = useMemo(() => {
    const items: { key: string; label: string; icon: React.ElementType }[] = []

    if (needsFulfilled) {
      items.push({ key: 'needFulfilled', label: `#${cond!.needFulfilled.toString()} fulfilled`, icon: DocumentCheckIcon })
    }
    if (needsNotFulfilled) {
      items.push({ key: 'needNotFulfilled', label: `#${cond!.needNotFulfilled.toString()} not fulfilled`, icon: DocumentCheckIcon })
    }
    if (hasThrottle) {
      items.push({ key: 'throttle', label: 'Throttle passed', icon: QueueListIcon })
    }
    if (hasVote || hasTimelock) {
      items.push({ key: 'proposalCreated', label: 'Proposal created', icon: ClipboardDocumentCheckIcon })
    }
    if (hasVote) {
      items.push({ key: 'voteEnded', label: 'Vote ended', icon: FlagIcon })
    }
    if (hasTimelock) {
      items.push({ key: 'delay', label: 'Delay passed', icon: CalendarDaysIcon })
    }
    items.push({ key: 'requested', label: 'Requested', icon: CheckCircleIcon })
    items.push({ key: 'fulfilled', label: 'Fulfilled', icon: RocketLaunchIcon })

    return items
  }, [needsFulfilled, needsNotFulfilled, hasThrottle, hasVote, hasTimelock, cond])

  return (
    <div
      className={`bg-background border font-mono cursor-pointer hover:border-primary transition-all ${
        isHighlighted ? 'border-primary/60 border-2' : 'border-border'
      }`}
      style={{ width: NODE_WIDTH }}
      onClick={() => onNodeClick(String(mandate.index))}
    >
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-muted-foreground shrink-0">
            #{mandate.index.toString()}
          </span>
          <span className="text-xs font-semibold text-foreground truncate">{mandateName}</span>
        </div>
        {roleName && (
          <span className="text-[10px] text-muted-foreground">{roleName}</span>
        )}
      </div>

      <div className="px-3 py-2 space-y-1.5 text-[10px] text-muted-foreground">
        {checkItems.map((item) => {
          const status = getCheckItemStatus(item.key)
          const date = getCheckItemDate(item.key)
          const Icon = item.icon
          const iconColor = status === "success" ? 'text-foreground' : status === "error" ? 'text-red-600' : 'text-muted-foreground/70'

          return (
            <div key={item.key} className="relative flex flex-col gap-0.5">
              {date && (
                <div className="text-[9px] text-muted-foreground/70">{date}</div>
              )}
              <div className="flex items-center gap-1.5">
                {needsFulfilled && item.key === 'needFulfilled' && (
                  <Handle
                    type="source"
                    position={Position.Left}
                    id="needFulfilled-handle"
                    style={{ ...HANDLE_STYLE, left: -18, background: 'transparent', border: 'none' }}
                  />
                )}
                {needsNotFulfilled && item.key === 'needNotFulfilled' && (
                  <Handle
                    type="source"
                    position={Position.Left}
                    id="needNotFulfilled-handle"
                    style={{ ...HANDLE_STYLE, left: -18, background: 'transparent', border: 'none' }}
                  />
                )}
                <Icon className={`w-3 h-3 shrink-0 ${iconColor}`} />
                <span className={iconColor}>{item.label}</span>
                {item.key === 'fulfilled' && (
                  <Handle
                    type="target"
                    position={Position.Right}
                    id="fulfilled-target"
                    style={{ ...HANDLE_STYLE, right: -4 }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const nodeTypes = { mandateSchema: MandateSchemaNode }

// Helper function to find all nodes connected to a selected node through dependencies
export function findConnectedNodes(powers: Powers, selectedMandateId: string): Set<string> {
  const connected = new Set<string>()
  const visited = new Set<string>()

  const mandates = powers?.mandates || []

  // Build dependency maps
  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()
  
  mandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    dependencies.set(mandateId, new Set())
    dependents.set(mandateId, new Set())
  })
  
  // Populate dependency relationships
  mandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    if (mandate.conditions) {
      if (mandate.conditions.needFulfilled != null && mandate.conditions.needFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needFulfilled)
        if (dependencies.has(targetId)) {
          dependencies.get(mandateId)?.add(targetId)
          dependents.get(targetId)?.add(mandateId)
        }
      }
      if (mandate.conditions.needNotFulfilled != null && mandate.conditions.needNotFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needNotFulfilled)
        if (dependencies.has(targetId)) {
          dependencies.get(mandateId)?.add(targetId)
          dependents.get(targetId)?.add(mandateId)
        }
      }
    }
  })
  
  // Recursive function to find all connected nodes
  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    connected.add(nodeId)
    
    // Add all dependencies
    const deps = dependencies.get(nodeId) || new Set()
    deps.forEach(depId => traverse(depId))
    
    // Add all dependents  
    const dependentNodes = dependents.get(nodeId) || new Set()
    dependentNodes.forEach(depId => traverse(depId))
  }
  
  traverse(selectedMandateId)
  return connected
}

// Helper function to create a compact layered tree layout based on dependencies
export function createHierarchicalLayout(mandates: Mandate[], savedLayout?: Record<string, { x: number; y: number }>): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  // If we have saved layout, use it first
  if (savedLayout) {
    mandates.forEach(mandate => {
      const mandateId = String(mandate.index)
      if (savedLayout[mandateId]) {
        positions.set(mandateId, savedLayout[mandateId])
      }
    })
    if (positions.size === mandates.length) {
      return positions
    }
  }

  // Build dependency and dependent maps
  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()
  mandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    dependencies.set(mandateId, new Set())
    dependents.set(mandateId, new Set())
  })
  mandates.forEach(mandate => {
    const mandateId = String(mandate.index)
    if (mandate.conditions) {
      if (mandate.conditions.needFulfilled != null && mandate.conditions.needFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needFulfilled)
        if (dependencies.has(targetId)) {
          dependencies.get(mandateId)?.add(targetId)
          dependents.get(targetId)?.add(mandateId)
        }
      }
      if (mandate.conditions.needNotFulfilled != null && mandate.conditions.needNotFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needNotFulfilled)
        if (dependencies.has(targetId)) {
          dependencies.get(mandateId)?.add(targetId)
          dependents.get(targetId)?.add(mandateId)
        }
      }
    }
  })

  // Find root nodes (no dependencies)
  const allMandateIds = mandates.map(mandate => String(mandate.index))
  const rootNodes = allMandateIds.filter(mandateId => (dependencies.get(mandateId)?.size || 0) === 0)

  // Track placed nodes to avoid cycles
  const placed = new Set<string>()

  // Compute the size (number of rows) of each subtree
  const subtreeSize = new Map<string, number>()
  function computeSubtreeSize(mandateId: string, visiting: Set<string> = new Set()): number {
    if (visiting.has(mandateId)) return 0
    visiting.add(mandateId)
    const children = Array.from(dependents.get(mandateId) || [])
    if (children.length === 0) {
      subtreeSize.set(mandateId, 1)
      visiting.delete(mandateId)
      return 1
    }
    const sizes = children.map(childId => computeSubtreeSize(childId, visiting))
    const total = sizes.reduce((a, b) => a + b, 0)
    subtreeSize.set(mandateId, total)
    visiting.delete(mandateId)
    return total
  }
  rootNodes.forEach(rootId => computeSubtreeSize(rootId))

  let nextY = 0

  function placeNode(mandateId: string, x: number, y: number, visiting: Set<string> = new Set()) {
    if (placed.has(mandateId)) return
    if (visiting.has(mandateId)) return
    placed.add(mandateId)
    positions.set(mandateId, { x: x * NODE_SPACING_X, y: y * NODE_SPACING_Y })

    visiting.add(mandateId)
    const children = Array.from(dependents.get(mandateId) || [])
    if (children.length === 0) {
      visiting.delete(mandateId)
      return
    }
    children.sort((a, b) => (subtreeSize.get(b) || 1) - (subtreeSize.get(a) || 1))
    let childY = y
    for (let i = 0; i < children.length; i++) {
      const childId = children[i]
      placeNode(childId, x + 1, childY, visiting)
      childY += subtreeSize.get(childId) || 1
    }
    visiting.delete(mandateId)
  }

  let processingSingletons = false
  let singletonX = 0

  rootNodes.forEach(rootId => {
    const isSingleton = (dependents.get(rootId)?.size || 0) === 0

    if (isSingleton) {
      if (!processingSingletons) {
        processingSingletons = true
        singletonX = 0
      }
      placeNode(rootId, singletonX, nextY)
      singletonX++
    } else {
      if (processingSingletons) {
        nextY += 1
        processingSingletons = false
      }
      
      placeNode(rootId, 0, nextY)
      nextY += subtreeSize.get(rootId) || 1
    }
  })

  if (processingSingletons) {
    nextY += 1
  }

  allMandateIds.forEach(mandateId => {
    if (!placed.has(mandateId)) {
      positions.set(mandateId, { x: 0, y: nextY * NODE_SPACING_Y })
      nextY += 1
      placed.add(mandateId)
    }
  })

  const usedYRows = Array.from(new Set(Array.from(positions.values()).map(pos => pos.y / NODE_SPACING_Y))).sort((a, b) => a - b)
  const yRowMap = new Map<number, number>()
  usedYRows.forEach((row, idx) => yRowMap.set(row, idx))
  positions.forEach((pos, mandateId) => {
    const oldRow = pos.y / NODE_SPACING_Y
    const newRow = yRowMap.get(oldRow)
    if (newRow !== undefined) {
      positions.set(mandateId, { x: pos.x, y: newRow * NODE_SPACING_Y })
    }
  })

  return positions
}