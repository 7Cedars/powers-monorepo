'use client'

import React, { useCallback } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
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
  FLOW_PADDING,
  FLOW_HEADER_HEIGHT,
  createAllFlowsLayout,
} from './overview/[chainId]/[powers]/FlowNodes'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`
const EDGE_COLOR = 'hsl(var(--muted-foreground))'

const cond = (partial: {
  allowedRole: bigint
  needFulfilled?: bigint
  needNotFulfilled?: bigint
}) => ({
  allowedRole: partial.allowedRole,
  timelock: 0n,
  needFulfilled: partial.needFulfilled ?? 0n,
  needNotFulfilled: partial.needNotFulfilled ?? 0n,
  quorum: 0n,
  succeedAt: 0n,
  throttleExecution: 0n,
  votingPeriod: 0n,
})

const DEMO_MANDATES: Mandate[] = [
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'02'.padStart(64, '0')}` as `0x${string}`,
    index: 2n,
    nameDescription: 'Propose Split Payment: Executive proposes new split. Role 1 = Artist, Role 2 = Intermediary, Role 3 = Platform.',
    conditions: cond({ allowedRole: 5n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'03'.padStart(64, '0')}` as `0x${string}`,
    index: 3n,
    nameDescription: 'Veto Split (Minter): Minter can veto split change.',
    conditions: cond({ allowedRole: 1n, needFulfilled: 2n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'04'.padStart(64, '0')}` as `0x${string}`,
    index: 4n,
    nameDescription: 'Veto Split (Owner): Owner can veto split change.',
    conditions: cond({ allowedRole: 2n, needFulfilled: 2n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'05'.padStart(64, '0')}` as `0x${string}`,
    index: 5n,
    nameDescription: 'Veto Split (Intermediary): Intermediary can veto split change.',
    conditions: cond({ allowedRole: 3n, needFulfilled: 2n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'06'.padStart(64, '0')}` as `0x${string}`,
    index: 6n,
    nameDescription: 'Split Checkpoint 1: Confirm no Minter veto.',
    conditions: cond({ allowedRole: 5n, needFulfilled: 2n, needNotFulfilled: 3n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'07'.padStart(64, '0')}` as `0x${string}`,
    index: 7n,
    nameDescription: 'Split Checkpoint 2: Confirm no Owner veto.',
    conditions: cond({ allowedRole: 5n, needFulfilled: 6n, needNotFulfilled: 4n }),
    active: true,
  },
  {
    powers: ZERO_ADDR, mandateAddress: ZERO_ADDR,
    mandateHash: `0x${'08'.padStart(64, '0')}` as `0x${string}`,
    index: 8n,
    nameDescription: 'Execute Split Payment: Set new split payment.',
    conditions: cond({ allowedRole: 5n, needFulfilled: 7n, needNotFulfilled: 5n }),
    active: true,
  },
]

const DEMO_FLOWS: Flow[] = [
  {
    nameDescription: 'Set a Split Payment: Executives can propose a new split, minter, owner and intermediary can veto, and if no vetoes, executives can execute the new split after a time lock.',
    mandateIds: [2n, 3n, 4n, 5n, 6n, 7n, 8n],
  },
]

const DEMO_POWERS: Powers = {
  contractAddress: ZERO_ADDR,
  chainId: 11155111n,
  roles: [
    { roleId: 1n, label: 'Minter' },
    { roleId: 2n, label: 'Owner' },
    { roleId: 3n, label: 'Intermediary' },
    { roleId: 5n, label: 'Executive' },
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
      draggable: false,
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
      draggable: false,
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
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES)

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.04, duration: 0 }), 200)
  }, [fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      connectionMode={ConnectionMode.Loose}
      fitView={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      maxZoom={2}
      minZoom={0.1}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      panOnScroll={false}
      preventScrolling={true}
      selectionOnDrag={false}
      multiSelectionKeyCode={null}
      onInit={onInit}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="hsl(var(--border))"
      />
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