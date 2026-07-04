import { GitBranch, Move, X } from "lucide-react"
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react"
import type {
  CustomScenarioDocument,
  CustomScenarioEdge,
  CustomScenarioNode,
} from "../customScenario"
import { scenarioNodeDepths } from "../customScenarioGraph"
import { eventLabel, targetLabel } from "../format"

const FLOW_MIN_X = 6
const FLOW_MAX_X = 84
const FLOW_MIN_Y = 18
const FLOW_MAX_Y = 72

export function ScenarioFlowCanvas({
  connectFromNodeId,
  document,
  onConnectNode,
  onMoveNode,
  onRemoveEdge,
  onSelectNode,
  selectedNodeId,
}: {
  readonly connectFromNodeId: string | null
  readonly document: CustomScenarioDocument
  readonly onConnectNode: (nodeId: string) => void
  readonly onMoveNode: (nodeId: string, position: CustomScenarioNode["position"]) => void
  readonly onRemoveEdge: (edge: CustomScenarioEdge) => void
  readonly onSelectNode: (nodeId: string) => void
  readonly selectedNodeId: string
}) {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const nodeDepths = scenarioNodeDepths(document)

  function handlePointerDown(nodeId: string, event: ReactPointerEvent<HTMLButtonElement>): void {
    if (connectFromNodeId !== null) {
      return
    }
    onSelectNode(nodeId)
    setDraggingNodeId(nodeId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleNodeClick(nodeId: string): void {
    if (connectFromNodeId !== null && connectFromNodeId !== nodeId) {
      onConnectNode(nodeId)
      return
    }
    onSelectNode(nodeId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (draggingNodeId === null || flowRef.current === null) {
      return
    }
    const rect = flowRef.current.getBoundingClientRect()
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, FLOW_MIN_X, FLOW_MAX_X)
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, FLOW_MIN_Y, FLOW_MAX_Y)
    onMoveNode(draggingNodeId, { x, y })
  }

  return (
    <div
      className="scenario-flow"
      ref={flowRef}
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDraggingNodeId(null)}
      onPointerLeave={() => setDraggingNodeId(null)}
    >
      <div className="flow-label">
        <GitBranch size={14} />
        이벤트 플로우
      </div>
      <svg className="flow-links" aria-hidden="true">
        <defs>
          <marker id="flow-arrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
            <path d="M0 0 L6 3 L0 6 Z" />
          </marker>
        </defs>
        {document.scenario.edges.map((edge) => (
          <FlowEdge edge={edge} key={`${edge.from}-${edge.to}`} nodes={document.scenario.nodes} />
        ))}
      </svg>
      {document.scenario.edges.map((edge) => (
        <FlowEdgeControl
          edge={edge}
          key={`control-${edge.from}-${edge.to}`}
          nodes={document.scenario.nodes}
          onRemoveEdge={onRemoveEdge}
        />
      ))}
      {document.scenario.nodes.map((node) => (
        <button
          className={`flow-node ${node.id === selectedNodeId ? "selected" : ""} ${
            node.id === connectFromNodeId ? "connect-source" : ""
          } ${connectFromNodeId !== null && node.id !== connectFromNodeId ? "connect-target" : ""}`}
          type="button"
          key={node.id}
          style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
          onPointerDown={(event) => handlePointerDown(node.id, event)}
          onClick={() => handleNodeClick(node.id)}
        >
          <Move size={13} />
          <span>{eventLabel(node.event.event_type)}</span>
          <small>{targetLabel(node.event.target)}</small>
          <b>T+{nodeDepths.get(node.id) ?? 0}</b>
        </button>
      ))}
    </div>
  )
}

function FlowEdge({
  edge,
  nodes,
}: {
  readonly edge: CustomScenarioDocument["scenario"]["edges"][number]
  readonly nodes: readonly CustomScenarioNode[]
}) {
  const from = nodes.find((node) => node.id === edge.from)
  const to = nodes.find((node) => node.id === edge.to)
  if (from === undefined || to === undefined) {
    return null
  }
  return (
    <line
      x1={`${from.position.x}%`}
      y1={`${from.position.y}%`}
      x2={`${to.position.x}%`}
      y2={`${to.position.y}%`}
      markerEnd="url(#flow-arrow)"
    />
  )
}

function FlowEdgeControl({
  edge,
  nodes,
  onRemoveEdge,
}: {
  readonly edge: CustomScenarioEdge
  readonly nodes: readonly CustomScenarioNode[]
  readonly onRemoveEdge: (edge: CustomScenarioEdge) => void
}) {
  const from = nodes.find((node) => node.id === edge.from)
  const to = nodes.find((node) => node.id === edge.to)
  if (from === undefined || to === undefined) {
    return null
  }
  const left = (from.position.x + to.position.x) / 2
  const top = (from.position.y + to.position.y) / 2
  return (
    <button
      className="flow-edge-control"
      type="button"
      aria-label={`${from.id}에서 ${to.id} 연결 삭제`}
      style={{ left: `${left}%`, top: `${top}%` }}
      onClick={() => onRemoveEdge(edge)}
    >
      <X size={11} />
    </button>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
