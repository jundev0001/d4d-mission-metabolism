import { SlidersHorizontal } from "lucide-react"
import type { CustomScenarioNode } from "../customScenario"
import { eventLabel, targetLabel } from "../format"
import { EventTypes } from "../types"
import { EditorHeader, RangeField } from "./ScenarioBuilderFields"

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
      <EditorHeader icon={<SlidersHorizontal size={14} />} label="이벤트 노드" />
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
