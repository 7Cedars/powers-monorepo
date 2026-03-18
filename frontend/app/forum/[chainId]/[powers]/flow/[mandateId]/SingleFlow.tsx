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
import { Mandate, Powers } from '@/context/types'
import { useParams, useRouter } from 'next/navigation'
import { usePowersStore } from '@/context/store'
import { bigintToRole } from '@/utils/bigintTo'
import { identifyFlows } from '@/utils/identifyFlows'
import {
  CalendarDaysIcon,
  QueueListIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
  FlagIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'

const NODE_WIDTH = 220
const NODE_SPACING_X = 280
const NODE_SPACING_Y = 160

const HANDLE_STYLE = {
  width: 7,
  height: 7,
  background: 'hsl(var(--muted-foreground))',
  border: 'none',
}

// Compact hierarchical layout for a small set of mandates
function createFlowLayout(mandates: Mandate[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  if (mandates.length === 0) return positions

  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()

  mandates.forEach(m => {
    const id = String(m.index)
    dependencies.set(id, new Set())
    dependents.set(id, new Set())
  })

  mandates.forEach(m => {
    const id = String(m.index)
    if (m.conditions?.needFulfilled && m.conditions.needFulfilled !== 0n) {
      const dep = String(m.conditions.needFulfilled)
      if (dependencies.has(dep)) {
        dependencies.get(id)?.add(dep)
        dependents.get(dep)?.add(id)
      }
    }
    if (m.conditions?.needNotFulfilled && m.conditions.needNotFulfilled !== 0n) {
      const dep = String(m.conditions.needNotFulfilled)
      if (dependencies.has(dep)) {
        dependencies.get(id)?.add(dep)
        dependents.get(dep)?.add(id)
      }
    }
  })

  const allIds = mandates.map(m => String(m.index))
  const roots = allIds.filter(id => (dependencies.get(id)?.size ?? 0) === 0)
  const placed = new Set<string>()

  const subtreeSize = new Map<string, number>()
  function calcSize(id: string, visiting = new Set<string>()): number {
    if (visiting.has(id)) return 0
    visiting.add(id)
    const children = Array.from(dependents.get(id) ?? [])
    const size = children.length === 0
      ? 1
      : children.reduce((sum, c) => sum + calcSize(c, visiting), 0)
    subtreeSize.set(id, size)
    visiting.delete(id)
    return size
  }
  roots.forEach(r => calcSize(r))

  let nextRow = 0
  function place(id: string, col: number, row: number, visiting = new Set<string>()) {
    if (placed.has(id) || visiting.has(id)) return
    placed.add(id)
    visiting.add(id)
    positions.set(id, { x: col * NODE_SPACING_X, y: row * NODE_SPACING_Y })
    const children = Array.from(dependents.get(id) ?? [])
      .sort((a, b) => (subtreeSize.get(b) ?? 1) - (subtreeSize.get(a) ?? 1))
    let childRow = row
    for (const child of children) {
      place(child, col + 1, childRow, visiting)
      childRow += subtreeSize.get(child) ?? 1
    }
    visiting.delete(id)
  }

  roots.forEach(rootId => {
    place(rootId, 0, nextRow)
    nextRow += subtreeSize.get(rootId) ?? 1
  })

  // Place any nodes not reached by roots (e.g. disconnected cycles)
  allIds.forEach(id => {
    if (!placed.has(id)) {
      positions.set(id, { x: 0, y: nextRow * NODE_SPACING_Y })
      nextRow++
      placed.add(id)
    }
  })

  return positions
}

interface MandateNodeData {
  mandate: Mandate
  powers: Powers
  onNodeClick: (mandateId: string) => void
}

const MandateNode: React.FC<NodeProps<MandateNodeData>> = ({ data }) => {
  const { mandate, powers, onNodeClick } = data
  const cond = mandate.conditions

  const mandateName = mandate.nameDescription?.split(':')[0] ?? `Mandate ${mandate.index}`
  const roleName = cond ? bigintToRole(cond.allowedRole, powers) : ''

  const hasVote = cond?.quorum != null && cond.quorum > 0n
  const hasTimelock = cond?.timelock != null && cond.timelock > 0n
  const hasThrottle = cond?.throttleExecution != null && cond.throttleExecution > 0n
  const needsFulfilled = !!(cond?.needFulfilled && cond.needFulfilled !== 0n)
  const needsNotFulfilled = !!(cond?.needNotFulfilled && cond.needNotFulfilled !== 0n)

  return (
    <div
      className="bg-background border border-border font-mono cursor-pointer hover:border-primary/70 transition-colors"
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
        {needsFulfilled && (
          <div className="relative flex items-center gap-1.5">
            <Handle
              type="source"
              position={Position.Left}
              id="needFulfilled-handle"
              style={{ ...HANDLE_STYLE, left: -18, background: 'transparent', border: 'none' }}
            />
            <DocumentCheckIcon className="w-3 h-3 shrink-0" />
            <span>#{cond!.needFulfilled.toString()} fulfilled</span>
          </div>
        )}
        {needsNotFulfilled && (
          <div className="relative flex items-center gap-1.5">
            <Handle
              type="source"
              position={Position.Left}
              id="needNotFulfilled-handle"
              style={{ ...HANDLE_STYLE, left: -18, background: 'transparent', border: 'none' }}
            />
            <DocumentCheckIcon className="w-3 h-3 shrink-0" />
            <span>#{cond!.needNotFulfilled.toString()} not fulfilled</span>
          </div>
        )}
        {hasThrottle && (
          <div className="flex items-center gap-1.5">
            <QueueListIcon className="w-3 h-3 shrink-0" />
            <span>Throttle passed</span>
          </div>
        )}
        {(hasVote || hasTimelock) && (
          <div className="flex items-center gap-1.5">
            <ClipboardDocumentCheckIcon className="w-3 h-3 shrink-0" />
            <span>Proposal created</span>
          </div>
        )}
        {hasVote && (
          <div className="flex items-center gap-1.5">
            <FlagIcon className="w-3 h-3 shrink-0" />
            <span>Vote ended</span>
          </div>
        )}
        {hasTimelock && (
          <div className="flex items-center gap-1.5">
            <CalendarDaysIcon className="w-3 h-3 shrink-0" />
            <span>Delay passed</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <CheckCircleIcon className="w-3 h-3 shrink-0" />
          <span>Requested</span>
        </div>
        <div className="relative flex items-center gap-1.5">
          <RocketLaunchIcon className="w-3 h-3 shrink-0" />
          <span>Fulfilled</span>
          <Handle
            type="target"
            position={Position.Right}
            id="fulfilled-target"
            style={{ ...HANDLE_STYLE, right: -4 }}
          />
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { mandateNode: MandateNode }

interface SingleFlowProps {
  mandateId: bigint
  actionId?: bigint
}

const SingleFlowContent: React.FC<SingleFlowProps> = ({ mandateId }) => {
  const { fitView } = useReactFlow()
  const powers = usePowersStore()
  const router = useRouter()
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()

  const flowMandates = useMemo((): Mandate[] => {
    if (!powers || !powers.mandates) return []
    const activeMandates = powers.mandates.filter(m => m.active)
    const flows = identifyFlows(powers)
    const targetFlow = flows.find(flow => flow.some(id => id === mandateId))
    if (!targetFlow) return activeMandates.filter(m => m.index === mandateId)
    return activeMandates.filter(m => targetFlow.includes(m.index))
  }, [powers, mandateId])

  const layout = useMemo(() => createFlowLayout(flowMandates), [flowMandates])

  const handleNodeClick = useCallback((id: string) => {
    router.push(`/forum/${chainId}/${powersAddress}/mandate/${id}`)
  }, [router, chainId, powersAddress])

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!powers || flowMandates.length === 0) return { initialNodes: [], initialEdges: [] }

    const nodes: Node[] = []
    const edges: Edge[] = []
    const edgeColor = 'hsl(var(--muted-foreground))'

    flowMandates.forEach(mandate => {
      const id = String(mandate.index)
      nodes.push({
        id,
        type: 'mandateNode',
        position: layout.get(id) ?? { x: 0, y: 0 },
        data: { mandate, powers, onNodeClick: handleNodeClick },
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
          label: '', // needs fulfilled
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
          label: '', // needs not fulfilled
          style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: '5,3' },
          labelStyle: { fontSize: '9px', fill: edgeColor },
          labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.85 },
          markerStart: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
          zIndex: 10,
        })
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [powers, flowMandates, layout, handleNodeClick])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  React.useEffect(() => { setNodes(initialNodes) }, [initialNodes, setNodes])
  React.useEffect(() => { setEdges(initialEdges) }, [initialEdges, setEdges])

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50)
  }, [fitView])

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
        fitView
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

export function SingleFlow({ mandateId }: SingleFlowProps) {
  return (
    <ReactFlowProvider>
      <SingleFlowContent mandateId={mandateId} />
    </ReactFlowProvider>
  )
}

export default SingleFlow
