import { MapIcon, SlidersHorizontal } from "lucide-react"
import { type CustomMapArea, type CustomScenarioNode, ScenarioTargets } from "../customScenario"
import { eventLabel, targetLabel } from "../format"
import { EventTypes } from "../types"
import { EditorHeader, RangeField } from "./ScenarioBuilderFields"

export function ScenarioNodeEditor({
  node,
  onChange,
}: {
  readonly node: CustomScenarioNode
  readonly onChange: (event: Partial<CustomScenarioNode["event"]>) => void
}) {
  return (
    <div className="builder-editor">
      <EditorHeader icon={<SlidersHorizontal size={14} />} label="노드 편집" />
      <label className="builder-field">
        <span>이벤트</span>
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
        <span>대상</span>
        <select
          value={node.event.target}
          onChange={(event) => {
            const target = ScenarioTargets.find((value) => value === event.currentTarget.value)
            if (target !== undefined) {
              onChange({ target })
            }
          }}
        >
          {ScenarioTargets.map((target) => (
            <option value={target} key={target}>
              {targetLabel(target)}
            </option>
          ))}
        </select>
      </label>
      <RangeField
        label="강도"
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
  onChange,
  onSelectArea,
  selectedArea,
}: {
  readonly areas: readonly CustomMapArea[]
  readonly onChange: (patch: Partial<Omit<CustomMapArea, "id">>) => void
  readonly onSelectArea: (areaId: string) => void
  readonly selectedArea: CustomMapArea
}) {
  return (
    <div className="builder-editor">
      <EditorHeader icon={<MapIcon size={14} />} label="맵 편집" />
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
        <span>라벨</span>
        <input
          value={selectedArea.label}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
        />
      </label>
      <RangeField
        label="중심 X"
        max={90}
        min={10}
        step={1}
        value={selectedArea.center.x}
        onChange={(value) => onChange({ center: { ...selectedArea.center, x: value } })}
      />
      <RangeField
        label="중심 Y"
        max={78}
        min={10}
        step={1}
        value={selectedArea.center.y}
        onChange={(value) => onChange({ center: { ...selectedArea.center, y: value } })}
      />
      <RangeField
        label="폭"
        max={68}
        min={12}
        step={1}
        value={selectedArea.size.width}
        onChange={(value) => onChange({ size: { ...selectedArea.size, width: value } })}
      />
      <RangeField
        label="높이"
        max={48}
        min={10}
        step={1}
        value={selectedArea.size.height}
        onChange={(value) => onChange({ size: { ...selectedArea.size, height: value } })}
      />
      <RangeField
        label="기울기"
        max={16}
        min={-16}
        step={1}
        value={selectedArea.skew}
        onChange={(value) => onChange({ skew: value })}
      />
    </div>
  )
}
