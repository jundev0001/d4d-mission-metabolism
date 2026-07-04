import { MapIcon, Plus, SlidersHorizontal, Trash2, X } from "lucide-react"
import { type PointerEvent as ReactPointerEvent, useState } from "react"
import {
  areaCentroid,
  type CustomMapArea,
  type CustomPoint,
  type CustomScenarioNode,
  MAX_AREA_POINTS,
  pointsToPath,
  requirementsForMissionType,
} from "../customScenario"
import { capabilityLabel, eventLabel, targetLabel } from "../format"
import { CapabilityNames, EventTypes, type MissionType, MissionTypes } from "../types"
import { EditorHeader, RangeField } from "./ScenarioBuilderFields"

type AreaPatch = Partial<Omit<CustomMapArea, "id">>
type DrawMode = "add" | "replace"
type DraftPoint = {
  readonly key: string
  readonly point: CustomPoint
}

export function ScenarioNodeEditor({
  node,
  onChange,
  targetOptions,
}: {
  readonly node: CustomScenarioNode
  readonly onChange: (event: Partial<CustomScenarioNode["event"]>) => void
  readonly targetOptions: readonly string[]
}) {
  const options = targetOptions.includes(node.event.target)
    ? targetOptions
    : [node.event.target, ...targetOptions]
  return (
    <div className="builder-editor">
      <EditorHeader icon={<SlidersHorizontal size={14} />} label="Event node" />
      <label className="builder-field">
        <span>Event</span>
        <select
          value={node.event.event_type}
          onChange={(event) => {
            const eventType = EventTypes.find((value) => value === event.currentTarget.value)
            if (eventType !== undefined) {
              onChange({ event_type: eventType })
            }
          }}
        >
          {EventTypes.map((eventType) => (
            <option value={eventType} key={eventType}>
              {eventLabel(eventType)}
            </option>
          ))}
        </select>
      </label>
      <label className="builder-field">
        <span>Target</span>
        <select
          value={node.event.target}
          onChange={(event) => onChange({ target: event.currentTarget.value })}
        >
          {options.map((target) => (
            <option value={target} key={target}>
              {targetLabel(target)}
            </option>
          ))}
        </select>
      </label>
      <RangeField
        label="Severity"
        max={1}
        min={0}
        step={0.01}
        value={node.event.severity}
        onChange={(value) => onChange({ severity: value })}
      />
    </div>
  )
}

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
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null)
  const [draftPoints, setDraftPoints] = useState<readonly DraftPoint[]>([])

  function startDrawing(mode: DrawMode): void {
    setDrawMode(mode)
    setDraftPoints([])
  }

  function cancelDrawing(): void {
    setDrawMode(null)
    setDraftPoints([])
  }

  function finishDrawing(): void {
    if (draftPoints.length < 3 || drawMode === null) {
      return
    }
    const points = draftPoints.map((draftPoint) => draftPoint.point)
    if (drawMode === "add") {
      onAddArea(points)
    } else {
      const centroid = areaCentroid({ points })
      onChange({
        points,
        label_position: { x: clamp(centroid.x - 6, 0, 100), y: clamp(centroid.y - 3, 0, 86) },
        metric_position: { x: clamp(centroid.x - 6, 0, 100), y: clamp(centroid.y + 3, 0, 86) },
        threat_position: centroid,
      })
    }
    cancelDrawing()
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drawMode === null || draftPoints.length >= MAX_AREA_POINTS) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const point = {
      x: roundCoordinate(((event.clientX - rect.left) / rect.width) * 100),
      y: roundCoordinate(((event.clientY - rect.top) / rect.height) * 86),
    }
    setDraftPoints([...draftPoints, { key: `${point.x}-${point.y}-${draftPoints.length}`, point }])
  }

  return (
    <div className="builder-editor">
      <EditorHeader icon={<MapIcon size={14} />} label="Area mission" />
      <label className="builder-field">
        <span>Area</span>
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
        <span>Label</span>
        <input
          value={selectedArea.label}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
        />
      </label>
      <label className="builder-field">
        <span>Mission</span>
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
              {missionType.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <RangeField
        label="Priority"
        max={1}
        min={0}
        step={0.01}
        value={selectedArea.priority}
        onChange={(value) => onChange({ priority: value })}
      />
      <RangeField
        label="Threat"
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
      <div className="area-draw-toolbar">
        <button className="button" type="button" onClick={() => startDrawing("add")}>
          <Plus size={14} />
          New area
        </button>
        <button className="button" type="button" onClick={() => startDrawing("replace")}>
          <MapIcon size={14} />
          Redraw
        </button>
        <button
          className="button danger"
          type="button"
          disabled={areas.length <= 1}
          onClick={onDeleteArea}
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
      <svg
        className={`area-draw-canvas ${drawMode === null ? "" : "is-drawing"}`}
        viewBox="0 0 100 86"
        role="img"
        aria-label="Area polygon editor"
        onPointerDown={handleCanvasPointerDown}
      >
        <rect className="area-draw-bg" x="0" y="0" width="100" height="86" />
        {areas.map((area) => (
          <path
            className={`area-draw-shape ${area.id === selectedArea.id ? "selected" : ""}`}
            d={pointsToPath(area.points)}
            key={area.id}
          />
        ))}
        {draftPoints.length > 0 ? (
          <>
            <polyline
              className="area-draw-draft"
              points={draftPoints
                .map((draftPoint) => `${draftPoint.point.x},${draftPoint.point.y}`)
                .join(" ")}
            />
            {draftPoints.map((draftPoint) => (
              <circle
                cx={draftPoint.point.x}
                cy={draftPoint.point.y}
                r="1.4"
                key={draftPoint.key}
              />
            ))}
          </>
        ) : null}
      </svg>
      {drawMode !== null ? (
        <div className="area-draw-actions">
          <span className="caption">
            {drawMode === "add" ? "New polygon" : "Replacement"}: {draftPoints.length}/
            {MAX_AREA_POINTS}
          </span>
          <button
            className="button primary"
            type="button"
            disabled={draftPoints.length < 3}
            onClick={finishDrawing}
          >
            Save shape
          </button>
          <button className="button" type="button" onClick={cancelDrawing}>
            <X size={14} />
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(2))
}
