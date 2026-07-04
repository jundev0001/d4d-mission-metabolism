import {
  CornerDownRight,
  Flag,
  GitBranchPlus,
  Link,
  Plus,
  Split,
  Trash2,
  Unlink,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  type CustomScenarioDocument,
  type CustomScenarioEdge,
  MAX_SCENARIO_NODES,
} from "../customScenario"
import { eventLabel, targetLabel } from "../format"
import { EditorHeader } from "./ScenarioBuilderFields"

type ScenarioGraphEditorProps = {
  readonly connectFromNodeId: string | null
  readonly document: CustomScenarioDocument
  readonly selectedNodeId: string
  readonly onAddEdge: (edge: CustomScenarioEdge) => void
  readonly onAddNode: () => void
  readonly onAddParallelNode: () => void
  readonly onCancelConnection: () => void
  readonly onDeleteNode: () => void
  readonly onInsertAfter: () => void
  readonly onRemoveEdge: (edge: CustomScenarioEdge) => void
  readonly onSetEntry: () => void
  readonly onStartConnection: () => void
}

export function ScenarioGraphEditor({
  connectFromNodeId,
  document,
  onAddEdge,
  onAddNode,
  onAddParallelNode,
  onCancelConnection,
  onDeleteNode,
  onInsertAfter,
  onRemoveEdge,
  onSetEntry,
  onStartConnection,
  selectedNodeId,
}: ScenarioGraphEditorProps) {
  const [fromNodeId, setFromNodeId] = useState(selectedNodeId)
  const [toNodeId, setToNodeId] = useState(document.scenario.nodes.at(1)?.id ?? selectedNodeId)
  const selectedNode = document.scenario.nodes.find((node) => node.id === selectedNodeId)
  const canDelete = document.scenario.nodes.length > 1
  const canAddNode = document.scenario.nodes.length < MAX_SCENARIO_NODES
  const isEntry = document.scenario.entry_node_id === selectedNodeId

  useEffect(() => {
    const nodeIds = new Set(document.scenario.nodes.map((node) => node.id))
    if (!nodeIds.has(fromNodeId)) {
      setFromNodeId(selectedNodeId)
    }
    if (!nodeIds.has(toNodeId)) {
      setToNodeId(
        document.scenario.nodes.find((node) => node.id !== selectedNodeId)?.id ?? selectedNodeId,
      )
    }
  }, [document.scenario.nodes, fromNodeId, selectedNodeId, toNodeId])

  return (
    <div className="builder-editor graph-editor">
      <EditorHeader icon={<GitBranchPlus size={14} />} label="플로우 편집" />
      <div className="graph-action-grid">
        <button className="button" type="button" disabled={!canAddNode} onClick={onAddNode}>
          <Plus size={14} />
          이벤트 추가
        </button>
        <button className="button" type="button" disabled={!canAddNode} onClick={onInsertAfter}>
          <CornerDownRight size={14} />
          뒤에 삽입
        </button>
        <button className="button" type="button" disabled={!canAddNode} onClick={onAddParallelNode}>
          <Split size={14} />
          동시 추가
        </button>
        <button className="button" type="button" disabled={isEntry} onClick={onSetEntry}>
          <Flag size={14} />
          시작 지정
        </button>
        {connectFromNodeId === null ? (
          <button className="button" type="button" onClick={onStartConnection}>
            <Link size={14} />
            연결 시작
          </button>
        ) : (
          <button className="button" type="button" onClick={onCancelConnection}>
            <X size={14} />
            연결 취소
          </button>
        )}
        <button
          className="button danger"
          type="button"
          disabled={!canDelete}
          onClick={onDeleteNode}
        >
          <Trash2 size={14} />
          선택 삭제
        </button>
      </div>

      {connectFromNodeId === null ? null : (
        <p className="builder-hint">
          연결 모드: 대상 노드를 클릭하면 {nodeName(document, connectFromNodeId)}에서 연결됩니다.
        </p>
      )}

      <div className="edge-compose">
        <label className="builder-field">
          <span>출발</span>
          <select value={fromNodeId} onChange={(event) => setFromNodeId(event.currentTarget.value)}>
            {document.scenario.nodes.map((node) => (
              <option value={node.id} key={node.id}>
                {nodeName(document, node.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span>도착</span>
          <select value={toNodeId} onChange={(event) => setToNodeId(event.currentTarget.value)}>
            {document.scenario.nodes.map((node) => (
              <option value={node.id} key={node.id}>
                {nodeName(document, node.id)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          type="button"
          onClick={() => onAddEdge({ from: fromNodeId, to: toNodeId })}
        >
          <Link size={14} />
          연결 추가
        </button>
      </div>

      <ul className="edge-list" aria-label="연결 목록">
        {document.scenario.edges.length === 0 ? (
          <li className="caption">연결 없음</li>
        ) : (
          document.scenario.edges.map((edge) => (
            <li className="edge-row" key={`${edge.from}-${edge.to}`}>
              <span>
                {nodeName(document, edge.from)}
                {" -> "}
                {nodeName(document, edge.to)}
              </span>
              <button
                className="button"
                type="button"
                aria-label={`${nodeName(document, edge.from)} 연결 삭제`}
                onClick={() => onRemoveEdge(edge)}
              >
                <Unlink size={13} />
              </button>
            </li>
          ))
        )}
      </ul>

      {selectedNode === undefined ? null : (
        <p className="builder-hint">
          선택: {eventLabel(selectedNode.event.event_type)} /{" "}
          {targetLabel(selectedNode.event.target)}
        </p>
      )}
    </div>
  )
}

function nodeName(document: CustomScenarioDocument, nodeId: string): string {
  const node = document.scenario.nodes.find((item) => item.id === nodeId)
  if (node === undefined) {
    return nodeId
  }
  return `${eventLabel(node.event.event_type)}:${targetLabel(node.event.target)} · ${shortNodeId(node.id)}`
}

function shortNodeId(nodeId: string): string {
  return nodeId.replace(/^node-/, "#")
}
