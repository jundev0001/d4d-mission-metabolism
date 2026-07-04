import { GitBranch, Move } from "lucide-react"
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react"
import type { CustomScenarioDocument, CustomScenarioNode } from "../customScenario"
import { eventLabel, targetLabel } from "../format"

const FLOW_MIN_X = 6
const FLOW_MAX_X = 84
const FLOW_MIN_Y = 18
const FLOW_MAX_Y = 72

export function ScenarioFlowCanvas({
  document,
  onMoveNode,
  onSelectNode,
  selectedNodeId,
}: {
  readonly document: CustomScenarioDocument
  readonly onMoveNode: (nodeId: string, position: CustomScenarioNode["position"]) => void
  readonly onSelectNode: (nodeId: string) => void
  readonly selectedNodeId: string
}) {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const flowRef = useRef<HTMLDivElement>(null)

  function handlePointerDown(nodeId: string, event: ReactPointerEvent<HTMLButtonElement>): void {
    onSelectNode(nodeId)
    setDraggingNodeId(nodeId)
    event.currentTarget.setPointerCapture(event.pointerId)
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
    >
      <div className="flow-label">
        <GitBranch size={14} />
        이벤트 플로우
      </div>
      <svg className="flow-links" aria-hidden="true">
        {document.scenario.edges.map((edge) => (
          <FlowEdge edge={edge} key={`${edge.from}-${edge.to}`} nodes={document.scenario.nodes} />
        ))}
      </svg>
      {document.scenario.nodes.map((node) => (
        <button
          className={`flow-node ${node.id === selectedNodeId ? "selected" : ""}`}
          type="button"
          key={node.id}
          style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
          onPointerDown={(event) => handlePointerDown(node.id, event)}
          onClick={() => onSelectNode(node.id)}
        >
          <Move size={13} />
          <span>{eventLabel(node.event.event_type)}</span>
          <small>{targetLabel(node.event.target)}</small>
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
    />
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
