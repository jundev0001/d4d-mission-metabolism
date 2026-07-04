import type {
  CustomMapArea,
  CustomPoint,
  CustomScenarioDocument,
  CustomScenarioEdge,
  CustomScenarioNode,
} from "../customScenario"
import { MAX_SCENARIO_NODES } from "../customScenario"
import { missionTypeLabel } from "../format"
import { MissionIntentControls } from "./MissionIntentControls"
import { ScenarioNodeEditor } from "./ScenarioBuilderEditors"
import { ScenarioFlowCanvas } from "./ScenarioFlowCanvas"
import { ScenarioGraphEditor } from "./ScenarioGraphEditor"
import { ScenarioMapEditor } from "./ScenarioMapEditor"

export type ScenarioBuilderMode = "map" | "events"

type ScenarioMapStageProps = {
  readonly activeArea: CustomMapArea
  readonly scenario: CustomScenarioDocument
  readonly onAddArea: (points: readonly CustomPoint[]) => void
  readonly onDeleteArea: () => void
  readonly onSelectArea: (areaId: string) => void
  readonly onUpdateArea: (patch: Partial<Omit<CustomMapArea, "id">>) => void
  readonly onUpdateScenario: (document: CustomScenarioDocument) => void
  readonly onUpdateMapName: (name: string) => void
  readonly onUpdateScenarioName: (name: string) => void
}

type ScenarioEventsStageProps = {
  readonly activeNode: CustomScenarioNode
  readonly connectFromNodeId: string | null
  readonly scenario: CustomScenarioDocument
  readonly selectedNodeId: string
  readonly targetOptions: readonly string[]
  readonly onAddEdge: (edge: CustomScenarioEdge) => void
  readonly onAddNode: () => void
  readonly onAddParallelNode: () => void
  readonly onCancelConnection: () => void
  readonly onConnectNode: (nodeId: string) => void
  readonly onDeleteNode: () => void
  readonly onInsertAfter: () => void
  readonly onMoveNode: (nodeId: string, position: CustomScenarioNode["position"]) => void
  readonly onRemoveEdge: (edge: CustomScenarioEdge) => void
  readonly onSelectNode: (nodeId: string) => void
  readonly onSetEntry: () => void
  readonly onStartConnection: () => void
  readonly onUpdateNode: (event: Partial<CustomScenarioNode["event"]>) => void
}

export function ScenarioMapStage({
  activeArea,
  onAddArea,
  onDeleteArea,
  onSelectArea,
  onUpdateArea,
  onUpdateMapName,
  onUpdateScenario,
  onUpdateScenarioName,
  scenario,
}: ScenarioMapStageProps) {
  return (
    <>
      <div className="builder-meta-grid">
        <label className="builder-field">
          <span>지도명</span>
          <input
            value={scenario.map.name}
            onChange={(event) => onUpdateMapName(event.currentTarget.value)}
          />
        </label>
        <label className="builder-field">
          <span>시나리오명</span>
          <input
            value={scenario.scenario.name}
            onChange={(event) => onUpdateScenarioName(event.currentTarget.value)}
          />
        </label>
      </div>
      <MissionIntentControls
        intent={scenario.intent}
        onChange={(intent) => onUpdateScenario({ ...scenario, intent })}
      />
      <div className="scenario-map-stage-grid">
        <ScenarioMapEditor
          areas={scenario.map.areas}
          selectedArea={activeArea}
          onAddArea={onAddArea}
          onChange={onUpdateArea}
          onDeleteArea={onDeleteArea}
          onSelectArea={onSelectArea}
        />
        <ScenarioAreaSummary
          areas={scenario.map.areas}
          selectedAreaId={activeArea.id}
          onSelectArea={onSelectArea}
        />
      </div>
    </>
  )
}

export function ScenarioEventsStage({
  activeNode,
  connectFromNodeId,
  onAddEdge,
  onAddNode,
  onAddParallelNode,
  onCancelConnection,
  onConnectNode,
  onDeleteNode,
  onInsertAfter,
  onMoveNode,
  onRemoveEdge,
  onSelectNode,
  onSetEntry,
  onStartConnection,
  onUpdateNode,
  scenario,
  selectedNodeId,
  targetOptions,
}: ScenarioEventsStageProps) {
  return (
    <>
      <ScenarioFlowCanvas
        connectFromNodeId={connectFromNodeId}
        document={scenario}
        selectedNodeId={selectedNodeId}
        onConnectNode={onConnectNode}
        onRemoveEdge={onRemoveEdge}
        onSelectNode={onSelectNode}
        onMoveNode={onMoveNode}
      />
      <div className="builder-side-stack events-side-stack">
        <ScenarioNodeEditor
          node={activeNode}
          targetOptions={targetOptions}
          onChange={onUpdateNode}
        />
        <ScenarioGraphEditor
          connectFromNodeId={connectFromNodeId}
          document={scenario}
          selectedNodeId={selectedNodeId}
          onAddEdge={onAddEdge}
          onAddNode={onAddNode}
          onAddParallelNode={onAddParallelNode}
          onCancelConnection={onCancelConnection}
          onDeleteNode={onDeleteNode}
          onInsertAfter={onInsertAfter}
          onRemoveEdge={onRemoveEdge}
          onSetEntry={onSetEntry}
          onStartConnection={onStartConnection}
        />
        <p className="builder-hint">
          Nodes {scenario.scenario.nodes.length}/{MAX_SCENARIO_NODES} | Links{" "}
          {scenario.scenario.edges.length}
        </p>
      </div>
    </>
  )
}

function ScenarioAreaSummary({
  areas,
  onSelectArea,
  selectedAreaId,
}: {
  readonly areas: readonly CustomMapArea[]
  readonly onSelectArea: (areaId: string) => void
  readonly selectedAreaId: string
}) {
  return (
    <div className="builder-editor scenario-area-summary">
      <div className="builder-editor-title">
        <span>구역 임무 목록</span>
      </div>
      <div className="scenario-area-list">
        {areas.map((area) => (
          <button
            className={`scenario-area-row ${area.id === selectedAreaId ? "active" : ""}`}
            type="button"
            key={area.id}
            onClick={() => onSelectArea(area.id)}
          >
            <span>{area.label}</span>
            <small>{missionTypeLabel(area.mission_type)}</small>
            <b>P {Math.round(area.priority * 100)}%</b>
          </button>
        ))}
      </div>
    </div>
  )
}
