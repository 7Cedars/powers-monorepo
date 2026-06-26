'use client'

import React, { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Powers } from '@/context/types'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { setAction, useActionStore, usePowersStore, useUIStateStore } from '@/context/store'
import {
  nodeTypes,
  NODE_WIDTH,
  NODE_HEIGHT,
  FLOW_PADDING,
  FLOW_HEADER_HEIGHT,
  getActionDataForChain,
  createAllFlowsLayout,
  FlowGroupLayoutData,
} from './FlowNodes'

const VIEWPORT_STORAGE_KEY = 'powersflow-viewport'

const getStoredViewport = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const setStoredViewport = (viewport: { x: number; y: number; zoom: number }) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport))
  } catch {
    // Ignore localStorage errors
  }
}

const DEFAULT_NODE_COLOR = 'hsl(var(--muted-foreground))'

const FlowContent: React.FC = () => {
  const { getNodes, getViewport, setViewport, setNodes: rfSetNodes } = useReactFlow()
  const { mandateId: selectedMandateId } = useParams<{ mandateId: string }>()
  const router = useRouter()
  const action = useActionStore()
  const [userHasInteracted, setUserHasInteracted] = React.useState(false)
  const pathname = usePathname()
  const powers = usePowersStore()
  const { highlightMode } = useUIStateStore()

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const loadSavedLayout = React.useCallback((): Record<string, { x: number; y: number }> | undefined => {
    if (typeof window === 'undefined') return undefined
    try {
      const localStore = localStorage.getItem("powersProtocols")
      if (!localStore || localStore === "undefined") return undefined

      const saved: Powers[] = JSON.parse(localStore)
      const existing = saved.find(item => item.contractAddress === powers?.contractAddress)
      return existing?.layout ?? undefined
    } catch {
      return undefined
    }
  }, [powers?.contractAddress])

  const savePowersToLocalStorage = React.useCallback((updatedPowers: Powers) => {
    if (typeof window === 'undefined') return
    try {
      const localStore = localStorage.getItem("powersProtocols")
      const saved: Powers[] = localStore && localStore !== "undefined" ? JSON.parse(localStore) : []
      const existing = saved.find(item => item.contractAddress === updatedPowers.contractAddress)
      if (existing) saved.splice(saved.indexOf(existing), 1)
      saved.push(updatedPowers)
      localStorage.setItem("powersProtocols", JSON.stringify(saved, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      ))
    } catch (error) {
      console.error('Failed to save layout to localStorage:', error)
    }
  }, [])

  const extractCurrentLayout = React.useCallback(() => {
    const nodes = getNodes()
    const layout: Record<string, { x: number; y: number }> = {}
    nodes.forEach(node => {
      layout[node.id] = { x: node.position.x, y: node.position.y }
    })
    return layout
  }, [getNodes])

  const saveLayout = React.useCallback(() => {
    const currentLayout = extractCurrentLayout()
    savePowersToLocalStorage({ ...powers as Powers, layout: currentLayout })
  }, [powers, extractCurrentLayout, savePowersToLocalStorage])

  const debouncedSaveLayout = React.useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(saveLayout, 250)
  }, [saveLayout])

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const fitViewWithPanel = useCallback(() => {
    // Use only top-level nodes (flow group nodes) for bounds calculation
    const allNodes = getNodes()
    const topLevel = allNodes.filter(n => !n.parentId)
    if (topLevel.length === 0) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const expandedPanelWidth = Math.min(640, viewportWidth - 40)
    const isSmallScreen = viewportWidth <= 2 * expandedPanelWidth
    const availableWidth = isSmallScreen ? viewportWidth : viewportWidth - expandedPanelWidth
    const availableHeight = viewportHeight

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    topLevel.forEach(node => {
      const w = typeof node.style?.width === 'number' ? node.style.width : NODE_WIDTH
      const h = typeof node.style?.height === 'number' ? node.style.height : NODE_HEIGHT
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + w)
      maxY = Math.max(maxY, node.position.y + h)
    })

    const padding = 80
    const contentWidth = maxX - minX + 2 * padding
    const contentHeight = maxY - minY + 2 * padding
    const zoom = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1.2)
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2

    const x = isSmallScreen
      ? -contentCenterX * zoom + viewportWidth / 2
      : -contentCenterX * zoom + expandedPanelWidth + availableWidth / 2
    const y = -contentCenterY * zoom + availableHeight / 2

    setViewport({ x, y, zoom }, { duration: 800 })
  }, [getNodes, setViewport])

  const handleNodeClick = useCallback((mandateId: string) => {
    const currentViewport = getViewport()
    setStoredViewport(currentViewport)
    setAction({ ...action, mandateId: BigInt(mandateId), upToDate: false })
    router.push(`/overview/${powers?.chainId}/${powers?.contractAddress}/mandates/${mandateId}`)
  }, [router, powers?.contractAddress, powers?.chainId, action, getViewport])

  const onInit = useCallback(() => {
    const storedViewport = getStoredViewport()
    if (!action.mandateId && !selectedMandateId && !storedViewport) {
      setTimeout(() => {
        fitViewWithPanel()
        setTimeout(() => setStoredViewport(getViewport()), 900)
      }, 100)
    } else if (storedViewport) {
      setTimeout(() => setViewport(storedViewport, { duration: 0 }), 100)
    }
  }, [setViewport, getViewport, action.mandateId, selectedMandateId, fitViewWithPanel])

  React.useEffect(() => {
    const isHomePage = !pathname.includes('/mandates/')
    if (isHomePage) setUserHasInteracted(false)
  }, [pathname])

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!powers?.mandates) return { initialNodes: [], initialEdges: [] }

    const activeMandates = powers.mandates.filter(mandate =>
      mandate.active || powers.flows?.some(flow => flow.mandateIds.includes(mandate.index))
    )
    if (activeMandates.length === 0) return { initialNodes: [], initialEdges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []
    const edgeColor = 'hsl(var(--muted-foreground))'
    const flows = powers.flows ?? []

    const selectedAction = action.actionId !== "0" ? action : undefined
    const chainActionData = getActionDataForChain(selectedAction, activeMandates, powers)
    const highlightedMandateId = selectedAction?.mandateId !== 0n ? selectedAction?.mandateId : undefined

    // Compute which mandate IDs are highlighted (full opacity) based on highlightMode
    const getIsDimmed = (mandate: typeof activeMandates[0]): boolean => {
      const idStr = String(mandate.index)
      switch (highlightMode.type) {
        case 'none': return false
        case 'action': return !highlightMode.mandateIds.has(idStr)
        case 'mandate': return idStr !== highlightMode.mandateId
        case 'flow': return !highlightMode.mandateIds.has(idStr)
        case 'role': return mandate.conditions?.allowedRole !== highlightMode.roleId
        default: return false
      }
    }

    // Compute which flow group IDs are dimmed
    const getIsGroupDimmed = (gId: string, groupMandateIds: string[]): boolean => {
      if (highlightMode.type === 'none') return false
      return groupMandateIds.every(mId => getIsDimmed(activeMandates.find(m => String(m.index) === mId)!))
    }

    // Build mandate → group mapping
    const mandateToGroupId = new Map<string, string>()
    const assignedIds = new Set<string>()
    flows.forEach((flow, idx) => {
      flow.mandateIds.forEach(mId => {
        const idStr = String(mId)
        if (activeMandates.some(m => String(m.index) === idStr)) {
          mandateToGroupId.set(idStr, `flow-${idx}`)
          assignedIds.add(idStr)
        }
      })
    })
    activeMandates.forEach(m => {
      const idStr = String(m.index)
      if (!assignedIds.has(idStr)) mandateToGroupId.set(idStr, 'flow-orphan')
    })

    const allGroupIds = [...new Set(mandateToGroupId.values())]

    // Group names
    const groupNames = new Map<string, string>()
    flows.forEach((flow, idx) => groupNames.set(`flow-${idx}`, flow.nameDescription))
    groupNames.set('flow-orphan', 'Other')

    // Determine layout — restore from saved if complete, else compute fresh
    const savedLayout = loadSavedLayout()
    const hasSavedLayout = savedLayout != null &&
      activeMandates.every(m => savedLayout[String(m.index)] != null) &&
      allGroupIds.every(gId => savedLayout[gId] != null)

    let mandatePositions: Map<string, { x: number; y: number }>
    let groupRects: Map<string, { x: number; y: number; width: number; height: number }>

    if (hasSavedLayout) {
      // Restore mandate relative positions from saved layout
      mandatePositions = new Map(
        activeMandates.map(m => [String(m.index), savedLayout![String(m.index)]])
      )

      // Recompute group sizes from saved mandate positions; restore group x/y
      groupRects = new Map()
      allGroupIds.forEach(gId => {
        const groupMandates = activeMandates.filter(m => mandateToGroupId.get(String(m.index)) === gId)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

        groupMandates.forEach(m => {
          const pos = savedLayout![String(m.index)]
          minX = Math.min(minX, pos.x)
          minY = Math.min(minY, pos.y)
          maxX = Math.max(maxX, pos.x + NODE_WIDTH)
          maxY = Math.max(maxY, pos.y + NODE_HEIGHT)
        })

        const savedGroupPos = savedLayout![gId]
        groupRects.set(gId, {
          x: savedGroupPos.x,
          y: savedGroupPos.y,
          width: (maxX - minX) + 2 * FLOW_PADDING,
          height: (maxY - minY) + FLOW_HEADER_HEIGHT + 2 * FLOW_PADDING,
        })
      })
    } else {
      const { mandatePositions: mp, flowGroupData } = createAllFlowsLayout(activeMandates, flows)
      mandatePositions = mp
      groupRects = new Map(flowGroupData.map(fg => [
        fg.id,
        { x: fg.x, y: fg.y, width: fg.width, height: fg.height },
      ]))
    }

    // Build a map from groupId → mandate IDs it contains (for dimming calculation)
    const groupMandateIdsMap = new Map<string, string[]>()
    allGroupIds.forEach(gId => {
      groupMandateIdsMap.set(gId, activeMandates.filter(m => mandateToGroupId.get(String(m.index)) === gId).map(m => String(m.index)))
    })

    // Create flow group nodes first (ReactFlow requires parents before children)
    allGroupIds.forEach(gId => {
      const rect = groupRects.get(gId)
      if (!rect) return
      const isDimmedGroup = getIsGroupDimmed(gId, groupMandateIdsMap.get(gId) ?? [])
      nodes.push({
        id: gId,
        type: 'flowGroup',
        position: { x: rect.x, y: rect.y },
        style: { width: rect.width, height: rect.height },
        data: { nameDescription: groupNames.get(gId) ?? '', isDimmedGroup },
        draggable: true,
        selectable: false,
        zIndex: 0,
      })
    })

    // Create mandate nodes as children of their flow group
    activeMandates.forEach(mandate => {
      const mandateId = String(mandate.index)
      const groupId = mandateToGroupId.get(mandateId)!
      const position = mandatePositions.get(mandateId) ?? { x: FLOW_PADDING, y: FLOW_HEADER_HEIGHT + FLOW_PADDING }
      const isHighlighted = highlightedMandateId !== undefined && mandate.index === highlightedMandateId
      const isDimmed = getIsDimmed(mandate)

      nodes.push({
        id: mandateId,
        type: 'mandateSchema',
        position,
        parentId: groupId,
        data: {
          powers,
          mandate,
          roleColor: DEFAULT_NODE_COLOR,
          onNodeClick: handleNodeClick,
          chainActionData,
          chainId: String(powers.chainId || 0),
          isHighlighted,
          isDimmed,
        },
        zIndex: 10,
      })

      if (mandate.conditions?.needFulfilled && mandate.conditions.needFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needFulfilled)
        edges.push({
          id: `${mandateId}-needFulfilled-${targetId}`,
          source: mandateId,
          sourceHandle: 'needFulfilled-handle',
          target: targetId,
          targetHandle: 'fulfilled-target',
          type: 'smoothstep',
          style: { stroke: edgeColor, strokeWidth: 1.5, opacity: isDimmed ? 0.2 : 1 },
          labelStyle: { fontSize: '9px', fill: edgeColor },
          labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 },
          markerStart: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
          zIndex: 20,
        })
      }

      if (mandate.conditions?.needNotFulfilled && mandate.conditions.needNotFulfilled !== 0n) {
        const targetId = String(mandate.conditions.needNotFulfilled)
        edges.push({
          id: `${mandateId}-needNotFulfilled-${targetId}`,
          source: mandateId,
          sourceHandle: 'needNotFulfilled-handle',
          target: targetId,
          targetHandle: 'fulfilled-target',
          type: 'smoothstep',
          style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '5,3', opacity: isDimmed ? 0.2 : 1 },
          labelStyle: { fontSize: '9px', fill: edgeColor },
          labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 },
          markerStart: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
          zIndex: 20,
        })
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [
    powers,
    handleNodeClick,
    selectedMandateId,
    action.mandateId,
    action.actionId,
    loadSavedLayout,
    highlightMode,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  useEffect(() => { setEdges(initialEdges) }, [initialEdges, setEdges])

  const onMoveEnd = useCallback(() => {
    setStoredViewport(getViewport())
    setUserHasInteracted(true)
    debouncedSaveLayout()
  }, [getViewport, debouncedSaveLayout])

  const onMoveStart = useCallback(() => {
    setUserHasInteracted(true)
  }, [])

  React.useEffect(() => {
    if (userHasInteracted) {
      const timer = setTimeout(() => setUserHasInteracted(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [userHasInteracted])

  const onNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    setUserHasInteracted(true)

    // If a mandate child was dragged, resize the parent flow group bounding box
    if (draggedNode.parentId) {
      setNodes(currentNodes => {
        const parentId = draggedNode.parentId!
        const children = currentNodes.filter(n => n.parentId === parentId)
        if (children.length === 0) return currentNodes

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        children.forEach(child => {
          minX = Math.min(minX, child.position.x)
          minY = Math.min(minY, child.position.y)
          maxX = Math.max(maxX, child.position.x + NODE_WIDTH)
          maxY = Math.max(maxY, child.position.y + NODE_HEIGHT)
        })

        // Delta: how far the parent origin needs to shift so minX=FLOW_PADDING, minY=FLOW_HEADER_HEIGHT+FLOW_PADDING
        const deltaX = minX - FLOW_PADDING
        const deltaY = minY - (FLOW_HEADER_HEIGHT + FLOW_PADDING)
        const newWidth = (maxX - minX) + 2 * FLOW_PADDING
        const newHeight = (maxY - minY) + FLOW_HEADER_HEIGHT + 2 * FLOW_PADDING

        return currentNodes.map(node => {
          if (node.id === parentId) {
            return {
              ...node,
              position: { x: node.position.x + deltaX, y: node.position.y + deltaY },
              style: { ...node.style, width: newWidth, height: newHeight },
            }
          }
          if (node.parentId === parentId) {
            return {
              ...node,
              position: { x: node.position.x - deltaX, y: node.position.y - deltaY },
            }
          }
          return node
        })
      })
    }

    debouncedSaveLayout()
  }, [debouncedSaveLayout, setNodes])

  const activeMandates = powers?.mandates?.filter(mandate =>
    mandate.active || powers.flows?.some(flow => flow.mandateIds.includes(mandate.index))
  )
  if (!activeMandates || activeMandates.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background border border-border">
        <span className="text-xs font-mono text-muted-foreground">No active mandates found</span>
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
        attributionPosition="bottom-left"
        nodesDraggable={true}
        nodesConnectable={false}
        maxZoom={2}
        minZoom={0.2}
        panOnDrag
        zoomOnScroll
        panOnScroll={false}
        selectionOnDrag={false}
        multiSelectionKeyCode={null}
        preventScrolling={true}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onInit={onInit}
        onNodeDragStop={onNodeDragStop}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--border))"
        />
        <Controls showZoom={false} showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  )
}

export const AllFlows: React.FC = React.memo(() => {
  const powers = usePowersStore()
  console.log('@AllFlows rendered with powers:', powers)

  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  )
})

export default AllFlows
