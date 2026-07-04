import { type ChangeEvent, useState } from "react"
import {
  type CustomMapArea,
  type CustomPoint,
  type CustomScenarioDocument,
  type CustomScenarioEdge,
  type CustomScenarioNode,
  parseCustomScenarioText,
  serializeCustomScenario,
} from "../customScenario"
import {
  addMapArea,
  addParallelScenarioNode,
  addScenarioNode,
  insertScenarioNodeAfter,
  removeMapArea,
  removeScenarioEdge,
  removeScenarioNode,
  setScenarioEntryNode,
  upsertScenarioEdge,
  withMapArea,
  withMapName,
  withScenarioName,
  withScenarioNodeEvent,
  withScenarioNodePosition,
} from "../customScenarioMutations"
import { useMissionStore } from "../store"
import { ScenarioBuilderCommandBar } from "./ScenarioBuilderCommandBar"
import {
  type ScenarioBuilderMode,
  ScenarioEventsStage,
  ScenarioMapStage,
} from "./ScenarioBuilderStageViews"

export type { ScenarioBuilderMode }

export function ScenarioBuilderPanel({ mode }: { readonly mode: ScenarioBuilderMode }) {
  const scenario = useMissionStore((state) => state.customScenario)
  const dashboard = useMissionStore((state) => state.dashboard)
  const allocateMission = useMissionStore((state) => state.allocateMission)
  const configureCustomMission = useMissionStore((state) => state.configureCustomMission)
  const setCustomScenario = useMissionStore((state) => state.setCustomScenario)
  const runCustomScenario = useMissionStore((state) => state.runCustomScenario)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)
  const [selectedNodeId, setSelectedNodeId] = useState(scenario.scenario.entry_node_id)
  const [selectedAreaId, setSelectedAreaId] = useState(scenario.map.areas.at(0)?.id ?? "")
  const [importError, setImportError] = useState<string | null>(null)
  const [flowNotice, setFlowNotice] = useState<string | null>(null)
  const [connectFromNodeId, setConnectFromNodeId] = useState<string | null>(null)
  const selectedNode =
    scenario.scenario.nodes.find((node) => node.id === selectedNodeId) ??
    scenario.scenario.nodes.at(0)
  const selectedArea =
    scenario.map.areas.find((area) => area.id === selectedAreaId) ?? scenario.map.areas.at(0)
  const targetOptions = [
    ...new Set([
      ...scenario.map.areas.map((area) => area.id),
      ...(dashboard?.vehicles.map((vehicle) => vehicle.id) ?? []),
      "operator",
    ]),
  ]

  if (selectedNode === undefined || selectedArea === undefined) {
    return null
  }
  const activeNode = selectedNode
  const activeArea = selectedArea

  function updateScenario(document: CustomScenarioDocument): void {
    setCustomScenario(document)
    setFlowNotice(null)
  }

  function updateSelectedNode(event: Partial<CustomScenarioNode["event"]>): void {
    updateScenario(withScenarioNodeEvent(scenario, activeNode.id, event))
  }

  function updateSelectedArea(patch: Partial<Omit<CustomMapArea, "id">>): void {
    updateScenario(withMapArea(scenario, activeArea.id, patch))
  }

  function handleAddArea(points: readonly CustomPoint[]): void {
    const result = addMapArea(scenario, points)
    setSelectedAreaId(result.selectedAreaId)
    updateScenario(result.document)
  }

  function handleRemoveArea(): void {
    const result = removeMapArea(scenario, activeArea.id)
    setSelectedAreaId(result.selectedAreaId)
    updateScenario(result.document)
  }

  function handleExport(): void {
    const blob = new Blob([serializeCustomScenario(scenario)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = globalThis.document.createElement("a")
    link.href = url
    link.download = "d4d-custom-scenario.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  function applyNodeMutation(
    mutation: (
      document: CustomScenarioDocument,
      nodeId: string,
    ) => {
      readonly document: CustomScenarioDocument
      readonly selectedNodeId: string
    },
  ): void {
    const result = mutation(scenario, activeNode.id)
    setSelectedNodeId(result.selectedNodeId)
    updateScenario(result.document)
  }

  function handleAddNode(): void {
    const result = addScenarioNode(scenario)
    setSelectedNodeId(result.selectedNodeId)
    updateScenario(result.document)
  }

  function handleAddEdge(edge: CustomScenarioEdge): void {
    const next = upsertScenarioEdge(scenario, edge)
    if (next === scenario) {
      setFlowNotice("연결 거부: 중복 연결이거나 순환 구조입니다.")
      return
    }
    updateScenario(next)
  }

  function handleConnectNode(toNodeId: string): void {
    if (connectFromNodeId === null) {
      return
    }
    handleAddEdge({ from: connectFromNodeId, to: toNodeId })
    setConnectFromNodeId(null)
  }

  function handleRemoveEdge(edge: CustomScenarioEdge): void {
    updateScenario(removeScenarioEdge(scenario, edge))
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.item(0)
    event.currentTarget.value = ""
    if (file === null || file === undefined) {
      return
    }
    try {
      const imported = parseCustomScenarioText(await file.text())
      setImportError(null)
      setSelectedNodeId(imported.scenario.entry_node_id)
      setSelectedAreaId(imported.map.areas.at(0)?.id ?? "")
      updateScenario(imported)
    } catch (error) {
      if (error instanceof Error) {
        setImportError(error.message)
        return
      }
      throw error
    }
  }

  const title = mode === "map" ? "구역(지도) 커스텀" : "이벤트 플로우차트 편집"
  const caption =
    mode === "map"
      ? `${scenario.map.areas.length}개 구역`
      : `${scenario.scenario.nodes.length}개 이벤트`

  return (
    <section className={`panel scenario-builder-panel scenario-builder-${mode}`} aria-label={title}>
      <div className="panel-title">
        <span>{title}</span>
        <span className="caption">{caption}</span>
      </div>
      <ScenarioBuilderCommandBar
        disabled={isRunningDemo}
        onAllocate={allocateMission}
        onApplyMission={configureCustomMission}
        onExport={handleExport}
        onImport={handleImport}
        onRunFlow={runCustomScenario}
      />
      {importError || flowNotice ? (
        <div className="builder-message-row" role="alert">
          {importError ? <p className="builder-error">가져오기 실패: {importError}</p> : null}
          {flowNotice ? <p className="builder-error">{flowNotice}</p> : null}
        </div>
      ) : null}

      {mode === "map" ? (
        <ScenarioMapStage
          activeArea={activeArea}
          scenario={scenario}
          onAddArea={handleAddArea}
          onDeleteArea={handleRemoveArea}
          onSelectArea={setSelectedAreaId}
          onUpdateArea={updateSelectedArea}
          onUpdateMapName={(name) => updateScenario(withMapName(scenario, name))}
          onUpdateScenario={updateScenario}
          onUpdateScenarioName={(name) => updateScenario(withScenarioName(scenario, name))}
        />
      ) : (
        <ScenarioEventsStage
          activeNode={activeNode}
          connectFromNodeId={connectFromNodeId}
          scenario={scenario}
          selectedNodeId={activeNode.id}
          targetOptions={targetOptions}
          onAddEdge={handleAddEdge}
          onAddNode={handleAddNode}
          onAddParallelNode={() => applyNodeMutation(addParallelScenarioNode)}
          onCancelConnection={() => setConnectFromNodeId(null)}
          onConnectNode={handleConnectNode}
          onDeleteNode={() => applyNodeMutation(removeScenarioNode)}
          onInsertAfter={() => applyNodeMutation(insertScenarioNodeAfter)}
          onMoveNode={(nodeId, position) =>
            updateScenario(withScenarioNodePosition(scenario, nodeId, position))
          }
          onRemoveEdge={handleRemoveEdge}
          onSelectNode={setSelectedNodeId}
          onSetEntry={() => updateScenario(setScenarioEntryNode(scenario, activeNode.id))}
          onStartConnection={() => setConnectFromNodeId(activeNode.id)}
          onUpdateNode={updateSelectedNode}
        />
      )}
    </section>
  )
}
