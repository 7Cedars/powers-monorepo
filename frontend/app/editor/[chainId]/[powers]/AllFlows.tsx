'use client'

import React, { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Mandate, Powers } from '@/context/types'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { setAction, useActionStore, usePowersStore } from '@/context/store'
import {
  nodeTypes,
  NODE_WIDTH,
  NODE_SPACING_Y,
  getActionDataForChain,
  findConnectedNodes,
  createHierarchicalLayout,
} from '../../../../components/FlowNodes'

// Store for viewport state persistence using localStorage
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

// Default node color
const DEFAULT_NODE_COLOR = 'hsl(var(--muted-foreground))'

const FlowContent: React.FC = () => {
  const { getNodes, getViewport, setViewport } = useReactFlow()
  const { mandateId: selectedMandateId } = useParams<{mandateId: string }>()  
  const router = useRouter()
  const action = useActionStore()
  const [userHasInteracted, setUserHasInteracted] = React.useState(false)
  const reactFlowInstanceRef = React.useRef<ReturnType<typeof useReactFlow> | null>(null)
  const pathname = usePathname()
  const powers = usePowersStore()
  
  // Debounced layout saving
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Function to load saved layout from localStorage
  const loadSavedLayout = React.useCallback((): Record<string, { x: number; y: number }> | undefined => {
    if (typeof window === 'undefined') return undefined
    try {
      const localStore = localStorage.getItem("powersProtocols")
      if (!localStore || localStore === "undefined") return undefined
      
      const saved: Powers[] = JSON.parse(localStore)
      const existing = saved.find(item => item.contractAddress === powers?.contractAddress as `0x${string}`)
      
      if (existing && existing.layout) {
        return existing.layout
      }
      
      return undefined
    } catch (error) {
      console.error('Failed to load layout from localStorage:', error)
      return undefined
    }
  }, [powers?.contractAddress])

  // Function to save powers object to localStorage (similar to usePowers.ts)
  const savePowersToLocalStorage = React.useCallback((updatedPowers: Powers) => {
    if (typeof window === 'undefined') return
    try {
      const localStore = localStorage.getItem("powersProtocols")
      const saved: Powers[] = localStore && localStore != "undefined" ? JSON.parse(localStore) : []
      const existing = saved.find(item => item.contractAddress === updatedPowers.contractAddress)
      if (existing) {
        saved.splice(saved.indexOf(existing), 1)
      }
      saved.push(updatedPowers)
      localStorage.setItem("powersProtocols", JSON.stringify(saved, (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ))
    } catch (error) {
      console.error('Failed to save layout to localStorage:', error)
    }
  }, [])

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

  // Function to save layout to powers object and localStorage
  const saveLayout = React.useCallback(() => {
    const currentLayout = extractCurrentLayout()
    
    // Create updated powers object with layout data
    const updatedPowers: Powers = {
      ...powers as Powers,
      layout: currentLayout
    }
    
    // Save to localStorage
    savePowersToLocalStorage(updatedPowers)
  }, [powers, extractCurrentLayout, savePowersToLocalStorage])

  // Debounced save function
  const debouncedSaveLayout = React.useCallback(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Set new timeout for 0.5 seconds
    saveTimeoutRef.current = setTimeout(() => {
      saveLayout()
    }, 500)
  }, [saveLayout])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])


  // Helper function to calculate fitView options accounting for panel width
  const calculateFitViewOptions = useCallback(() => {
    return {
      padding: 0.2,
      duration: 800,
      includeHiddenNodes: false,
      minZoom: 0.1,
      maxZoom: 1.2,
    }
  }, [])

  // Custom fitView function that accounts for the side panel
  const fitViewWithPanel = useCallback(() => {
    const nodes = getNodes()
    if (nodes.length === 0) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const expandedPanelWidth = Math.min(640, viewportWidth - 40)
    const isSmallScreen = viewportWidth <= 2 * expandedPanelWidth
    // Calculate the available area for the flow chart (excluding panel)
    const availableWidth = isSmallScreen ? viewportWidth : viewportWidth - expandedPanelWidth
    const availableHeight = viewportHeight

    // Find the bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(node => {
      const nodeWidth = NODE_WIDTH
      const nodeHeight = 250 // Approximate node height
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + nodeWidth)
      maxY = Math.max(maxY, node.position.y + nodeHeight)
    })
    // Add padding
    const padding = 100
    const contentWidth = maxX - minX + 2 * padding
    const contentHeight = maxY - minY + 2 * padding
    // Calculate zoom to fit content in available area
    const zoomX = availableWidth / contentWidth
    const zoomY = availableHeight / contentHeight
    const zoom = Math.min(zoomX, zoomY, 1.2) // Cap at max zoom
    // Calculate center position
    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    let x, y
    if (isSmallScreen) {
      // Center in the middle of the viewport
      x = -contentCenterX * zoom + viewportWidth / 2
      y = -contentCenterY * zoom + availableHeight / 2
    } else {
      // Offset for the panel as before
      const availableAreaCenterX = expandedPanelWidth + availableWidth / 2
      x = -contentCenterX * zoom + availableAreaCenterX
      y = -contentCenterY * zoom + availableHeight / 2
    }
    setViewport({ x, y, zoom }, { duration: 800 })
  }, [getNodes, setViewport])

  const handleNodeClick = useCallback((mandateId: string) => {
    // Store current viewport before navigation
    const currentViewport = getViewport()
    setStoredViewport(currentViewport)
    // console.log("@handleNodeClick: waypoint 0", {mandateId, action})
    // Navigate to the mandate page within the flow layout
    setAction({
      ...action,
      mandateId: BigInt(mandateId),
      upToDate: false
    })
    router.push(`/protocol/${powers?.chainId}/${powers?.contractAddress}/mandates/${mandateId}`)
    // console.log("@handleNodeClick: waypoint 1", {action})
  }, [router, powers?.contractAddress, action, getViewport])

  // Handle ReactFlow initialization
  const onInit = useCallback((reactFlowInstance: ReturnType<typeof useReactFlow>) => {
    reactFlowInstanceRef.current = reactFlowInstance
    
    const storedViewport = getStoredViewport()
    
    // Only fit view on initial page load (no selected mandate and no stored viewport)
    if (!action.mandateId && !selectedMandateId && !storedViewport) {
      setTimeout(() => {
        fitViewWithPanel()
        // Save the fitted viewport
        setTimeout(() => {
          const currentViewport = getViewport()
          setStoredViewport(currentViewport)
        }, 900)
      }, 100)
    } else if (storedViewport) {
      // Restore stored viewport
      setTimeout(() => {
        setViewport(storedViewport, { duration: 0 })
      }, 100)
    }
  }, [setViewport, getViewport, action.mandateId, selectedMandateId, fitViewWithPanel])


  // Reset user interaction flag when navigating to home page
  React.useEffect(() => {
    const isHomePage = !pathname.includes('/mandates/')
    if (isHomePage) {
      setUserHasInteracted(false)
    }
  }, [pathname])



  // Create nodes and edges from mandates
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!powers?.mandates) return { initialNodes: [], initialEdges: [] }
    const ActiveMandates = powers?.mandates.filter(mandate => mandate.active)
    if (!ActiveMandates) return { initialNodes: [], initialEdges: [] }
    
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    // Use hierarchical layout instead of simple grid
    const savedLayout = loadSavedLayout()
    const positions = createHierarchicalLayout(ActiveMandates || [], savedLayout)
    
    // Find connected nodes if a mandate is selected
    const selectedMandateIdFromStore = action.mandateId !== 0n ? String(action.mandateId) : undefined
    const connectedNodes = selectedMandateIdFromStore 
      ? findConnectedNodes(powers as Powers, selectedMandateIdFromStore as string)
      : undefined
    
    // Get the selected action from the store
    const selectedAction = action.actionId !== "0" ? action : undefined
    
    // Get action data for all mandates in the chain
    const chainActionData = getActionDataForChain(
      selectedAction,
      ActiveMandates || [],
      powers
    )
    
    ActiveMandates?.forEach((mandate) => {
      const roleColor = DEFAULT_NODE_COLOR
      const mandateId = String(mandate.index)
      const position = positions.get(mandateId) || { x: 0, y: 0 }
      
      // Create mandate schema node
      nodes.push({
        id: mandateId,
        type: 'mandateSchema',  
        position,
        data: {
          powers,
          mandate,
          roleColor,
          onNodeClick: handleNodeClick,
          selectedMandateId: selectedMandateIdFromStore,
          connectedNodes,
          actionDataTimestamp: Date.now(),
          selectedAction,
          chainActionData,
          chainId: String(powers?.chainId || 0), 
        },
      })
      
      // Create edges from dependency checks to target mandates
      if (mandate.conditions) {
        const sourceId = mandateId
        
        const edgeColor = 'hsl(var(--muted-foreground))'
        
        // Edge from needFulfilled check to target mandate
        if (mandate.conditions.needFulfilled != null && mandate.conditions.needFulfilled !== 0n) {
          const targetId = String(mandate.conditions.needFulfilled)
          const isEdgeConnected = !connectedNodes || connectedNodes.has(sourceId) || connectedNodes.has(targetId)
          const edgeOpacity = isEdgeConnected ? 1 : 0.5
          
          edges.push({
            id: `${sourceId}-needFulfilled-${targetId}`,
            source: sourceId,
            sourceHandle: 'needFulfilled-handle',
            target: targetId,
            targetHandle: 'fulfilled-target',
            type: 'smoothstep',
            label: '',
            style: { stroke: edgeColor, strokeWidth: 1.5, opacity: edgeOpacity },
            labelStyle: { fontSize: '9px', fill: edgeColor, opacity: edgeOpacity },
            labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 * edgeOpacity },
            markerStart: {
              type: MarkerType.ArrowClosed,
              color: edgeColor,
              width: 14,
              height: 14,
            },
            zIndex: 10,
          })
        }
        
        // Edge from needNotFulfilled check to target mandate
        if (mandate.conditions.needNotFulfilled != null && mandate.conditions.needNotFulfilled != 0n) {
          const targetId = String(mandate.conditions.needNotFulfilled)
          const isEdgeConnected = !connectedNodes || connectedNodes.has(sourceId) || connectedNodes.has(targetId)
          const edgeOpacity = isEdgeConnected ? 1 : 0.5
          
          edges.push({
            id: `${sourceId}-needNotFulfilled-${targetId}`,
            source: sourceId,
            sourceHandle: 'needNotFulfilled-handle',
            target: targetId,
            targetHandle: 'fulfilled-target',
            type: 'smoothstep',
            label: '',
            style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '5,3', opacity: edgeOpacity },
            labelStyle: { fontSize: '9px', fill: edgeColor, opacity: edgeOpacity },
            labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 * edgeOpacity },
            markerStart: {
              type: MarkerType.ArrowClosed,
              color: edgeColor,
              width: 14,
              height: 14,
            },
            zIndex: 10,
          })
        }
        
      
      }
    })
    
    return { initialNodes: nodes, initialEdges: edges }
  }, [
    powers,
    handleNodeClick, 
    selectedMandateId, 
    action.mandateId, 
    loadSavedLayout
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  )

  // Save viewport state when user manually pans/zooms
  const onMoveEnd = useCallback(() => {
    const currentViewport = getViewport()
    setStoredViewport(currentViewport)
    // Mark that user has interacted with viewport
    setUserHasInteracted(true)
    // Trigger debounced layout save when viewport changes
    debouncedSaveLayout()
  }, [getViewport, debouncedSaveLayout])

  // Track user interactions with viewport
  const onMoveStart = useCallback(() => {
    setUserHasInteracted(true)
  }, [])

  // Reset user interaction flag after a period of inactivity
  React.useEffect(() => {
    if (userHasInteracted) {
      const timer = setTimeout(() => {
        setUserHasInteracted(false)
      }, 3000) // Reset after 3 seconds of no interaction
      
      return () => clearTimeout(timer)
    }
  }, [userHasInteracted])

  // Node drag handlers to trigger layout saving
  const onNodeDragStop = useCallback(() => {
    setUserHasInteracted(true) // Mark interaction when dragging nodes
    debouncedSaveLayout()
  }, [debouncedSaveLayout])

  const onNodesChangeWithSave = useCallback((changes: { type: string; dragging?: boolean; id?: string }[]) => {
    onNodesChange(changes as any[])
    // Check if any node was dragged
    const hasDragChange = changes.some((change) => change.type === 'position' && change.dragging === false)
    if (hasDragChange) {
      setUserHasInteracted(true) // Mark interaction when dragging nodes
      debouncedSaveLayout()
    }
  }, [onNodesChange, debouncedSaveLayout])
  
  const ActiveMandates = powers?.mandates?.filter(mandate => mandate.active)
  if (!ActiveMandates || ActiveMandates.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs font-mono text-muted-foreground">No active mandates found</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSave}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView={false}
        fitViewOptions={calculateFitViewOptions()}
        attributionPosition="bottom-left"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={false}
        maxZoom={2}
        minZoom={0.2}
        panOnDrag
        zoomOnScroll
        panOnScroll={false}
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
        <MiniMap 
          nodeColor={() => 'hsl(var(--muted-foreground))'}
          nodeStrokeWidth={2}
          nodeStrokeColor="hsl(var(--border))"
          nodeBorderRadius={4}
          maskColor="hsl(var(--background) / 0.6)"
          position="bottom-right"
          pannable={true}
          zoomable={true}
          ariaLabel="Flow diagram minimap"
        />
      </ReactFlow>
    </div>
  )
}

export const AllFlows: React.FC = React.memo(() => {
  const powers = usePowersStore();

  console.log('@AllFlows rendered with powers:', powers)


  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  )
})

export default AllFlows