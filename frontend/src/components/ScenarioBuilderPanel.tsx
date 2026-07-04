import { CheckCircle2, Download, Play, Route, Upload } from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import {
  type CustomMapArea,
  type CustomPoint,
  type CustomScenarioDocument,
  type CustomScenarioEdge,
  type CustomScenarioNode,
  MAX_SCENARIO_NODES,
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
import { ScenarioMapEditor, ScenarioNodeEditor } from "./ScenarioBuilderEditors"
import { ScenarioFlowCanvas } from "./ScenarioFlowCanvas"
import { ScenarioGraphEditor } from "./ScenarioGraphEditor"

export function ScenarioBuilderPanel() {
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
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      setFlowNotice("Connection rejected: duplicate or cyclic edge")
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

  return (
    <section className="panel scenario-builder-panel" aria-label="Custom scenario builder">
      <div className="panel-title">
        <span>Custom scenario builder</span>
        <span className="caption">No-code JSON</span>
      </div>
      <div className="builder-command-row">
        <button className="button" type="button" onClick={handleExport}>
          <Download size={15} />
          Export
        </button>
        <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={15} />
          Import
        </button>
        <button
          className="button"
          type="button"
          disabled={isRunningDemo}
          onClick={() => void configureCustomMission()}
        >
          <CheckCircle2 size={15} />
          Apply mission
        </button>
        <button
          className="button"
          type="button"
          disabled={isRunningDemo}
          onClick={() => void allocateMission()}
        >
          <Route size={15} />
          Allocate
        </button>
        <button
          className="button primary"
          type="button"
          disabled={isRunningDemo}
          onClick={() => void runCustomScenario()}
        >
          <Play size={15} />
          Run flow
        </button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleImport(event)}
        />
      </div>
      {importError || flowNotice ? (
        <div className="builder-message-row">
          {importError ? <p className="builder-error">Import failed: {importError}</p> : null}
          {flowNotice ? <p className="builder-error">{flowNotice}</p> : null}
        </div>
      ) : null}

      <div className="builder-meta-grid">
        <label className="builder-field">
          <span>Map</span>
          <input
            value={scenario.map.name}
            onChange={(event) => updateScenario(withMapName(scenario, event.currentTarget.value))}
          />
        </label>
        <label className="builder-field">
          <span>Scenario</span>
          <input
            value={scenario.scenario.name}
            onChange={(event) =>
              updateScenario(withScenarioName(scenario, event.currentTarget.value))
            }
          />
        </label>
      </div>

      <ScenarioFlowCanvas
        connectFromNodeId={connectFromNodeId}
        document={scenario}
        selectedNodeId={activeNode.id}
        onConnectNode={handleConnectNode}
        onRemoveEdge={handleRemoveEdge}
        onSelectNode={setSelectedNodeId}
        onMoveNode={(nodeId, position) =>
          updateScenario(withScenarioNodePosition(scenario, nodeId, position))
        }
      />

      <div className="builder-side-stack">
        <ScenarioNodeEditor
          node={activeNode}
          targetOptions={targetOptions}
          onChange={updateSelectedNode}
        />
        <ScenarioGraphEditor
          connectFromNodeId={connectFromNodeId}
          document={scenario}
          selectedNodeId={activeNode.id}
          onAddEdge={handleAddEdge}
          onAddNode={handleAddNode}
          onAddParallelNode={() => applyNodeMutation(addParallelScenarioNode)}
          onCancelConnection={() => setConnectFromNodeId(null)}
          onDeleteNode={() => applyNodeMutation(removeScenarioNode)}
          onInsertAfter={() => applyNodeMutation(insertScenarioNodeAfter)}
          onRemoveEdge={handleRemoveEdge}
          onSetEntry={() => updateScenario(setScenarioEntryNode(scenario, activeNode.id))}
          onStartConnection={() => setConnectFromNodeId(activeNode.id)}
        />
        <ScenarioMapEditor
          areas={scenario.map.areas}
          selectedArea={activeArea}
          onAddArea={handleAddArea}
          onChange={updateSelectedArea}
          onDeleteArea={handleRemoveArea}
          onSelectArea={setSelectedAreaId}
        />
        <p className="builder-hint">
          Nodes {scenario.scenario.nodes.length}/{MAX_SCENARIO_NODES} | Links{" "}
          {scenario.scenario.edges.length}
        </p>
      </div>
    </section>
  )
}
