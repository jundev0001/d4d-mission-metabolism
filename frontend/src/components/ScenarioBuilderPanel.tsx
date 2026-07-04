import { Download, Play, Upload } from "lucide-react"
import { type ChangeEvent, useRef, useState } from "react"
import {
  type CustomMapArea,
  type CustomScenarioDocument,
  type CustomScenarioNode,
  parseCustomScenarioText,
  serializeCustomScenario,
  withMapArea,
  withMapName,
  withScenarioName,
  withScenarioNodeEvent,
  withScenarioNodePosition,
} from "../customScenario"
import { useMissionStore } from "../store"
import { ScenarioMapEditor, ScenarioNodeEditor } from "./ScenarioBuilderEditors"
import { ScenarioFlowCanvas } from "./ScenarioFlowCanvas"

export function ScenarioBuilderPanel() {
  const scenario = useMissionStore((state) => state.customScenario)
  const setCustomScenario = useMissionStore((state) => state.setCustomScenario)
  const runCustomScenario = useMissionStore((state) => state.runCustomScenario)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)
  const [selectedNodeId, setSelectedNodeId] = useState(scenario.scenario.entry_node_id)
  const [selectedAreaId, setSelectedAreaId] = useState("A")
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedNode =
    scenario.scenario.nodes.find((node) => node.id === selectedNodeId) ??
    scenario.scenario.nodes.at(0)
  const selectedArea =
    scenario.map.areas.find((area) => area.id === selectedAreaId) ?? scenario.map.areas.at(0)

  if (selectedNode === undefined || selectedArea === undefined) {
    return null
  }
  const activeNode = selectedNode
  const activeArea = selectedArea

  function updateScenario(document: CustomScenarioDocument): void {
    setCustomScenario(document)
  }

  function updateSelectedNode(event: Partial<CustomScenarioNode["event"]>): void {
    updateScenario(withScenarioNodeEvent(scenario, activeNode.id, event))
  }

  function updateSelectedArea(patch: Partial<Omit<CustomMapArea, "id">>): void {
    updateScenario(withMapArea(scenario, activeArea.id, patch))
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
      setSelectedAreaId(imported.map.areas.at(0)?.id ?? "A")
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
    <section className="panel scenario-builder-panel" aria-label="커스텀 시나리오 빌더">
      <div className="panel-title">
        <span>커스텀 시나리오 빌더</span>
        <span className="caption">No-code JSON</span>
      </div>
      <div className="builder-command-row">
        <button className="button" type="button" onClick={handleExport}>
          <Download size={15} />
          내보내기
        </button>
        <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={15} />
          가져오기
        </button>
        <button
          className="button primary"
          type="button"
          disabled={isRunningDemo}
          onClick={() => void runCustomScenario()}
        >
          <Play size={15} />
          테스트
        </button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleImport(event)}
        />
      </div>
      {importError ? <p className="builder-error">가져오기 실패: {importError}</p> : null}

      <div className="builder-meta-grid">
        <label className="builder-field">
          <span>맵 이름</span>
          <input
            value={scenario.map.name}
            onChange={(event) => updateScenario(withMapName(scenario, event.currentTarget.value))}
          />
        </label>
        <label className="builder-field">
          <span>시나리오 이름</span>
          <input
            value={scenario.scenario.name}
            onChange={(event) =>
              updateScenario(withScenarioName(scenario, event.currentTarget.value))
            }
          />
        </label>
      </div>

      <ScenarioFlowCanvas
        document={scenario}
        selectedNodeId={activeNode.id}
        onSelectNode={setSelectedNodeId}
        onMoveNode={(nodeId, position) =>
          updateScenario(withScenarioNodePosition(scenario, nodeId, position))
        }
      />

      <div className="builder-side-stack">
        <ScenarioNodeEditor node={activeNode} onChange={updateSelectedNode} />
        <ScenarioMapEditor
          areas={scenario.map.areas}
          selectedArea={activeArea}
          onSelectArea={setSelectedAreaId}
          onChange={updateSelectedArea}
        />
      </div>
    </section>
  )
}
