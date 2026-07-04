import { MapIcon } from "lucide-react"
import {
  areaCentroid,
  type CustomMapArea,
  type CustomPoint,
  requirementsForMissionType,
} from "../customScenario"
import { capabilityLabel, missionTypeLabel } from "../format"
import { CapabilityNames, type MissionType, MissionTypes } from "../types"
import { ScenarioAreaDrawControl } from "./ScenarioAreaDrawControl"
import { EditorHeader, RangeField } from "./ScenarioBuilderFields"

type AreaPatch = Partial<Omit<CustomMapArea, "id">>

export function ScenarioMapEditor({
  areas,
  onAddArea,
  onChange,
  onDeleteArea,
  onSelectArea,
  selectedArea,
}: {
  readonly areas: readonly CustomMapArea[]
  readonly onAddArea: (points: readonly CustomPoint[]) => void
  readonly onChange: (patch: AreaPatch) => void
  readonly onDeleteArea: () => void
  readonly onSelectArea: (areaId: string) => void
  readonly selectedArea: CustomMapArea
}) {
  function replaceAreaShape(points: readonly CustomPoint[]): void {
    const areaPoints = points.map((point) => ({ x: point.x, y: point.y }))
    const centroid = areaCentroid({ points: areaPoints })
    onChange({
      points: areaPoints,
      label_position: { x: clamp(centroid.x - 6, 0, 100), y: clamp(centroid.y - 3, 0, 86) },
      metric_position: { x: clamp(centroid.x - 6, 0, 100), y: clamp(centroid.y + 3, 0, 86) },
      threat_position: centroid,
    })
  }

  return (
    <div className="builder-editor scenario-map-editor">
      <EditorHeader icon={<MapIcon size={14} />} label="구역 임무" />
      <div className="scenario-map-settings">
        <label className="builder-field">
          <span>구역</span>
          <select
            value={selectedArea.id}
            onChange={(event) => onSelectArea(event.currentTarget.value)}
          >
            {areas.map((area) => (
              <option value={area.id} key={area.id}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span>구역명</span>
          <input
            value={selectedArea.label}
            onChange={(event) => onChange({ label: event.currentTarget.value })}
          />
        </label>
        <label className="builder-field">
          <span>임무</span>
          <select
            value={selectedArea.mission_type}
            onChange={(event) => {
              const missionType = MissionTypes.find(
                (value): value is MissionType => value === event.currentTarget.value,
              )
              if (missionType !== undefined) {
                onChange({
                  mission_type: missionType,
                  requirements: requirementsForMissionType(missionType),
                })
              }
            }}
          >
            {MissionTypes.map((missionType) => (
              <option value={missionType} key={missionType}>
                {missionTypeLabel(missionType)}
              </option>
            ))}
          </select>
        </label>
        <RangeField
          label="우선순위"
          max={1}
          min={0}
          step={0.01}
          value={selectedArea.priority}
          onChange={(value) => onChange({ priority: value })}
        />
        <RangeField
          label="위협도"
          max={1}
          min={0}
          step={0.01}
          value={selectedArea.threat}
          onChange={(value) => onChange({ threat: value })}
        />
        {CapabilityNames.map((capability) => (
          <RangeField
            key={capability}
            label={capabilityLabel(capability)}
            max={2}
            min={0}
            step={0.05}
            value={selectedArea.requirements[capability]}
            onChange={(value) =>
              onChange({
                requirements: { ...selectedArea.requirements, [capability]: value },
              })
            }
          />
        ))}
      </div>
      <div className="scenario-map-canvas-panel">
        <ScenarioAreaDrawControl
          areas={areas}
          selectedArea={selectedArea}
          onAddArea={onAddArea}
          onDeleteArea={onDeleteArea}
          onReplaceArea={replaceAreaShape}
        />
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
