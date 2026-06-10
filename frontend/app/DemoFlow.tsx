'use client'

import React, { useCallback } from 'react'
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
import { Mandate, Powers, Flow } from '@/context/types'
import {
  nodeTypes,
  NODE_WIDTH,
  NODE_HEIGHT,
  FLOW_PADDING,
  FLOW_HEADER_HEIGHT,
  createAllFlowsLayout,
} from './overview/[chainId]/[powers]/FlowNodes'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`
const EDGE_COLOR = 'hsl(var(--muted-foreground))'
const PUBLIC_ROLE = 2n ** 256n - 1n

const cond = (partial: {
  allowedRole: bigint
  needFulfilled?: bigint
  needNotFulfilled?: bigint
  votingPeriod?: bigint
  succeedAt?: bigint
  quorum?: bigint
}) => ({
  allowedRole: partial.allowedRole,
  timelock: 0n,
  needFulfilled: partial.needFulfilled ?? 0n,
  needNotFulfilled: partial.needNotFulfilled ?? 0n,
  quorum: partial.quorum ?? 0n,
  succeedAt: partial.succeedAt ?? 0n,
  throttleExecution: 0n,
  votingPeriod: partial.votingPeriod ?? 0n,
})

const DEMO_MANDATES: Mandate[] = [
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'01'.padStart(64, '0')}` as `0x${string}`,
    index: 1n,
    nameDescription: 'Initial Setup: Assign role labels (Admin, Public, Delegate). Self-revokes after first execution.',
    conditions: cond({ allowedRole: PUBLIC_ROLE }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'02'.padStart(64, '0')}` as `0x${string}`,
    index: 2n,
    nameDescription: 'Propose to Mint: Anyone can propose to mint tokens to an address.',
    conditions: cond({ allowedRole: PUBLIC_ROLE }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'03'.padStart(64, '0')}` as `0x${string}`,
    index: 3n,
    nameDescription: 'Veto a Mint: Admin can veto a proposed token mint.',
    conditions: cond({ allowedRole: 0n, needFulfilled: 2n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'04'.padStart(64, '0')}` as `0x${string}`,
    index: 4n,
    nameDescription: 'Execute a Mint: Delegates vote (66% threshold, 20% quorum) to execute a mint. Requires a proposal and no admin veto.',
    conditions: cond({ allowedRole: 1n, needFulfilled: 2n, needNotFulfilled: 3n, votingPeriod: 25n, succeedAt: 66n, quorum: 20n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'05'.padStart(64, '0')}` as `0x${string}`,
    index: 5n,
    nameDescription: 'Nominate Me: Anyone can nominate themselves for a delegate election. Set nominateMe to false to revoke.',
    conditions: cond({ allowedRole: PUBLIC_ROLE }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'06'.padStart(64, '0')}` as `0x${string}`,
    index: 6n,
    nameDescription: 'Call a Delegate Election: Anyone can call at any time. Top nominees by delegated token weight are elected (max 3 delegates).',
    conditions: cond({ allowedRole: PUBLIC_ROLE }),
    active: true,
  },
]

const DEMO_FLOWS: Flow[] = [
  {
    nameDescription: 'Setup: Assign role labels. Self-revokes after first execution.',
    mandateIds: [1n],
  },
  {
    nameDescription: 'Minting Flow: Anyone proposes, admin can veto, delegates vote to execute.',
    mandateIds: [2n, 3n, 4n],
  },
  {
    nameDescription: 'Elect Delegates: Nominate yourself and call a token-weighted delegate election.',
    mandateIds: [5n, 6n],
  },
]

const DEMO_POWERS: Powers = {
  contractAddress: ZERO_ADDR,
  chainId: 11155111n,
  roles: [
    { roleId: 0n, label: 'Admin' },
    { roleId: 1n, label: 'Delegate' },
    { roleId: PUBLIC_ROLE, label: 'Public' },
  ],
}

function buildGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const { mandatePositions, flowGroupData } = createAllFlowsLayout(DEMO_MANDATES, DEMO_FLOWS)

  const mandateToGroupId = new Map<string, string>()
  DEMO_FLOWS.forEach((flow, idx) => {
    flow.mandateIds.forEach(mId => mandateToGroupId.set(String(mId), `flow-${idx}`))
  })

  flowGroupData.forEach(fg => {
    nodes.push({
      id: fg.id,
      type: 'flowGroup',
      position: { x: fg.x, y: fg.y },
      style: { width: fg.width, height: fg.height },
      data: { nameDescription: fg.nameDescription },
      draggable: true,
      selectable: false,
      zIndex: 0,
    })
  })

  DEMO_MANDATES.forEach(mandate => {
    const mandateId = String(mandate.index)
    const groupId = mandateToGroupId.get(mandateId) ?? 'flow-orphan'
    const position = mandatePositions.get(mandateId) ?? { x: FLOW_PADDING, y: FLOW_HEADER_HEIGHT + FLOW_PADDING }

    nodes.push({
      id: mandateId,
      type: 'mandateSchema',
      position,
      parentId: groupId,
      data: {
        powers: DEMO_POWERS,
        mandate,
        onNodeClick: () => {},
        chainActionData: new Map(),
        chainId: '11155111',
        isHighlighted: false,
        isDimmed: false,
      },
      draggable: true,
      zIndex: 10,
    })

    if (mandate.conditions?.needFulfilled && mandate.conditions.needFulfilled !== 0n) {
      const targetId = String(mandate.conditions.needFulfilled)
      edges.push({
        id: `${mandateId}-fulfilled-${targetId}`,
        source: mandateId,
        sourceHandle: 'needFulfilled-handle',
        target: targetId,
        targetHandle: 'fulfilled-target',
        type: 'smoothstep',
        style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
        markerStart: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 14, height: 14 },
        zIndex: 20,
      })
    }

    if (mandate.conditions?.needNotFulfilled && mandate.conditions.needNotFulfilled !== 0n) {
      const targetId = String(mandate.conditions.needNotFulfilled)
      edges.push({
        id: `${mandateId}-notFulfilled-${targetId}`,
        source: mandateId,
        sourceHandle: 'needNotFulfilled-handle',
        target: targetId,
        targetHandle: 'fulfilled-target',
        type: 'smoothstep',
        style: { stroke: EDGE_COLOR, strokeWidth: 1.5, strokeDasharray: '5,3' },
        markerStart: { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 14, height: 14 },
        zIndex: 20,
      })
    }
  })

  return { nodes, edges }
}

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = buildGraph()

const DemoFlowContent: React.FC = () => {
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES)

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.04, duration: 0 }), 200)
  }, [fitView])

  const onNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    if (!draggedNode.parentId) return
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
  }, [setNodes])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      connectionMode={ConnectionMode.Loose}
      fitView={false}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={false}
      maxZoom={2}
      minZoom={0.1}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      panOnScroll={false}
      preventScrolling={false}
      selectionOnDrag={false}
      multiSelectionKeyCode={null}
      onInit={onInit}
      onNodeDragStop={onNodeDragStop}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="hsl(var(--border))"
      />
      <Controls showZoom={false} showInteractive={false} position="bottom-left" />
    </ReactFlow>
  )
}

export function DemoFlow() {
  return (
    <div className="w-full h-full" style={{ background: 'hsl(var(--background))' }}>
      <ReactFlowProvider>
        <DemoFlowContent />
      </ReactFlowProvider>
    </div>
  )
}