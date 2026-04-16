'use client'

import React, { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  ConnectionMode,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Mandate, Powers, Action, Status } from '@/context/types'
import { useParams, useRouter } from 'next/navigation'
import { usePowersStore } from '@/context/store'
import { bigintToRole } from '@/utils/bigintTo'
import { hashAction } from '@/utils/hashAction'
import { useBlocks } from '@/hooks/useBlocks'
import { parseChainId } from '@/utils/parsers'
import { toFullDateFormat, toEurTimeFormat } from '@/utils/toDates'
import { fromFutureBlockToDateTime } from '@/public/organisations/helpers'
import { useBlockNumber } from 'wagmi'
import {
  CalendarDaysIcon,
  QueueListIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
  FlagIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'

// Store for forum flow viewport state persistence using localStorage
const FORUM_VIEWPORT_STORAGE_KEY = 'powersflow-forum'

interface ForumViewportData {
  [flowKey: string]: {
    viewport: { x: number; y: number; zoom: number }
    layout: Record<string, { x: number; y: number }>
  }
}

const getStoredForumViewport = (chainId: string, powersAddress: string, mandateId: string) => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(FORUM_VIEWPORT_STORAGE_KEY)
    if (!stored) return null
    
    const data: ForumViewportData = JSON.parse(stored)
    const flowKey = `${chainId}-${powersAddress}-${mandateId}`
    return data[flowKey] || null
  } catch {
    return null
  }
}

const setStoredForumViewport = (
  chainId: string,
  powersAddress: string,
  mandateId: string,
  viewport: { x: number; y: number; zoom: number },
  layout: Record<string, { x: number; y: number }>
) => {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(FORUM_VIEWPORT_STORAGE_KEY)
    const data: ForumViewportData = stored ? JSON.parse(stored) : {}
    
    const flowKey = `${chainId}-${powersAddress}-${mandateId}`
    data[flowKey] = { viewport, layout }
    
    localStorage.setItem(FORUM_VIEWPORT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore localStorage errors
  }
}

const NODE_WIDTH = 220
const NODE_SPACING_X = 280
const NODE_SPACING_Y = 160

const HANDLE_STYLE = {
  width: 7,
  height: 7,
  background: 'hsl(var(--muted-foreground))',
  border: 'none',
}

// Helper function to get action data for all mandates in the dependency chain
function getActionDataForChain(
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

// Helper to place a single flow on one row
function createSingleFlowLayout(mandates: Mandate[], flowMandateIds: bigint[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  
  // Arrange them in order of flowMandateIds
  flowMandateIds.forEach((id, index) => {
     positions.set(String(id), { x: index * NODE_SPACING_X, y: 0 })
  })

  // For any mandates not in flowMandateIds, put them at the end
  let currentX = flowMandateIds.length * NODE_SPACING_X
  mandates.forEach(m => {
    if (!flowMandateIds.includes(m.index)) {
       positions.set(String(m.index), { x: currentX, y: 0 })
       currentX += NODE_SPACING_X
    }
  })

  return positions
}

interface MandateNodeData {
  mandate: Mandate
  powers: Powers
  onNodeClick: (mandateId: string) => void
  chainActionData: Map<string, Action>
  chainId: string
  isHighlighted?: boolean
}

const MandateNode: React.FC<NodeProps<MandateNodeData>> = ({ data }) => {
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
        {checkItems.map((item, index) => {
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

const nodeTypes = { mandateNode: MandateNode }

interface SingleFlowProps {
  mandateId: bigint
  actionId?: bigint
}

const SingleFlowContent: React.FC<SingleFlowProps> = ({ mandateId, actionId }) => {
  const { fitView, getViewport, setViewport, getNodes } = useReactFlow()
  const powers = usePowersStore()
  const router = useRouter()
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const flowMandates = useMemo((): Mandate[] => {
    if (!powers || !powers.mandates) return []
    const activeMandates = powers.mandates.filter(m => m.active)
    const targetFlow = powers.flows?.find(flow => flow.mandateIds.includes(mandateId))
    if (!targetFlow) return activeMandates.filter(m => m.index === mandateId)
    return activeMandates.filter(m => targetFlow.mandateIds.includes(m.index))
  }, [powers, mandateId])

  const targetFlowIds = useMemo((): bigint[] => {
    if (!powers || !powers.mandates) return []
    const targetFlow = powers.flows?.find(flow => flow.mandateIds.includes(mandateId))
    if (!targetFlow) return [mandateId]
    return targetFlow.mandateIds
  }, [powers, mandateId])

  // Load saved layout from localStorage
  const savedFlowData = React.useMemo(() => {
    if (!chainId || !powersAddress) return null
    return getStoredForumViewport(chainId, powersAddress, String(mandateId))
  }, [chainId, powersAddress, mandateId])

  const layout = useMemo(() => {
    // If we have saved layout for this flow, use it
    if (savedFlowData?.layout) {
      const layoutMap = new Map<string, { x: number; y: number }>()
      Object.entries(savedFlowData.layout).forEach(([key, value]) => {
        layoutMap.set(key, value)
      })
      // Check if all mandates in current flow have saved positions
      const allMandatesHavePositions = flowMandates.every(m => 
        savedFlowData.layout[String(m.index)]
      )
      if (allMandatesHavePositions) {
        return layoutMap
      }
    }
    // Otherwise, create new layout
    return createSingleFlowLayout(flowMandates, targetFlowIds)
  }, [flowMandates, savedFlowData, targetFlowIds])

  // Get the selected action and chain action data
  const { selectedAction, chainActionData, highlightedMandateId } = useMemo(() => {
    if (!actionId || !powers || flowMandates.length === 0) {
      return { selectedAction: undefined, chainActionData: new Map(), highlightedMandateId: undefined }
    }

    // Find the action in the mandates
    let foundAction: Action | undefined
    let foundMandateId: bigint | undefined

    for (const mandate of flowMandates) {
      const action = mandate.actions?.find(a => a.actionId === String(actionId))
      if (action) {
        foundAction = action
        foundMandateId = mandate.index
        break
      }
    }

    if (!foundAction) {
      return { selectedAction: undefined, chainActionData: new Map(), highlightedMandateId: undefined }
    }

    const chainData = getActionDataForChain(foundAction, flowMandates, powers)
    
    return { 
      selectedAction: foundAction, 
      chainActionData: chainData,
      highlightedMandateId: foundMandateId
    }
  }, [actionId, powers, flowMandates])

  const handleNodeClick = useCallback((id: string) => {
    // Check if this mandate has an associated action in chainActionData
    const action = chainActionData.get(id)
    
    if (action && action.actionId) {
      // Navigate to action page when action exists
      router.push(`/forum/${chainId}/${powersAddress}/action/${action.actionId}`)
    } else {
      // Navigate to mandate page when no action exists
      router.push(`/forum/${chainId}/${powersAddress}/mandate/${id}`)
    }
  }, [router, chainId, powersAddress, chainActionData])

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!powers || flowMandates.length === 0) return { initialNodes: [], initialEdges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []
    const edgeColor = 'hsl(var(--muted-foreground))'

    flowMandates.forEach(mandate => {
      const id = String(mandate.index)
      const isHighlighted = highlightedMandateId !== undefined && mandate.index === highlightedMandateId

      nodes.push({
        id,
        type: 'mandateNode',
        position: layout.get(id) ?? { x: 0, y: 0 },
        data: { 
          mandate, 
          powers, 
          onNodeClick: handleNodeClick,
          chainActionData,
          chainId,
          isHighlighted
        },
      })

      if (mandate.conditions?.needFulfilled && mandate.conditions.needFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needFulfilled)
        edges.push({
          id: `${id}-needFulfilled-${targetId}`,
          source: id,
          sourceHandle: 'needFulfilled-handle',
          target: targetId,
          targetHandle: 'fulfilled-target',
          type: 'smoothstep',
          label: '',
          style: { stroke: edgeColor, strokeWidth: 1.5 },
          labelStyle: { fontSize: '9px', fill: edgeColor },
          labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 },
          markerStart: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
          zIndex: 10,
        })
      }

      if (mandate.conditions?.needNotFulfilled && mandate.conditions.needNotFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needNotFulfilled)
        edges.push({
          id: `${id}-needNotFulfilled-${targetId}`,
          source: id,
          sourceHandle: 'needNotFulfilled-handle',
          target: targetId,
          targetHandle: 'fulfilled-target',
          type: 'smoothstep',
          label: '',
          style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '5,3' },
          labelStyle: { fontSize: '9px', fill: edgeColor },
          labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 },
          markerStart: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
          zIndex: 10,
        })
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [powers, flowMandates, layout, handleNodeClick, chainActionData, chainId, highlightedMandateId])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  React.useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  React.useEffect(() => { setEdges(initialEdges) }, [initialEdges, setEdges])

  // Function to extract current layout from ReactFlow nodes
  const extractCurrentLayout = React.useCallback(() => {
    const nodes = getNodes()
    const layout: Record<string, { x: number; y: number }> = {}
    
    nodes.forEach(node => {
      layout[node.id] = {
        x: node.position.x,
        y: node.position.y
      }
    })
    
    return layout
  }, [getNodes])

  // Function to save layout and viewport
  const saveLayoutAndViewport = React.useCallback(() => {
    if (!chainId || !powersAddress) return
    
    const currentLayout = extractCurrentLayout()
    const currentViewport = getViewport()
    
    setStoredForumViewport(
      chainId,
      powersAddress,
      String(mandateId),
      currentViewport,
      currentLayout
    )
  }, [chainId, powersAddress, mandateId, extractCurrentLayout, getViewport])

  // Debounced save function
  const debouncedSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveLayoutAndViewport()
    }, 500)
  }, [saveLayoutAndViewport])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Save viewport when it changes
  const onMoveEnd = React.useCallback(() => {
    debouncedSave()
  }, [debouncedSave])

  // Save layout when nodes are dragged
  const onNodeDragStop = React.useCallback(() => {
    debouncedSave()
  }, [debouncedSave])

  const onInit = useCallback(() => {
    // Try to restore saved viewport
    if (savedFlowData?.viewport) {
      setTimeout(() => {
        setViewport(savedFlowData.viewport, { duration: 0 })
      }, 50)
    } else {
      // Otherwise fit view
      setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50)
    }
  }, [fitView, setViewport, savedFlowData])

  if (!powers || flowMandates.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs font-mono text-muted-foreground">No flow data available</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView={false}
        fitViewOptions={{ padding: 0.25 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
        onInit={onInit}
        onMoveEnd={onMoveEnd}
        onNodeDragStop={onNodeDragStop}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />
      </ReactFlow>
    </div>
  )
}

export function SingleFlow({ mandateId, actionId }: SingleFlowProps) {
  return (
    <ReactFlowProvider>
      <SingleFlowContent mandateId={mandateId} actionId={actionId} />
    </ReactFlowProvider>
  )
}

export default SingleFlow