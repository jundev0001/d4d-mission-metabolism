import { describe, expect, it } from "vitest"
import {
  areaPath,
  orderedCustomEvents,
  parseCustomScenarioText,
  serializeCustomScenario,
  withMapArea,
  withScenarioNodeEvent,
} from "../src/customScenario"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"

describe("custom scenario document", () => {
  it("Given a scenario document When exported and imported Then the testable event order is preserved", () => {
    const serialized = serializeCustomScenario(DEFAULT_CUSTOM_SCENARIO)
    const imported = parseCustomScenarioText(serialized)

    expect(orderedCustomEvents(imported)).toEqual([
      { event_type: "comm_jam", target: "B", severity: 0.82 },
      { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
      { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
    ])
  })

  it("Given no-code edits When applying node and map changes Then JSON remains schema-valid", () => {
    const changedNode = withScenarioNodeEvent(DEFAULT_CUSTOM_SCENARIO, "node-comm-jam", {
      event_type: "gps_drop",
      target: "UxV-05",
      severity: 0.7,
    })
    const changedMap = withMapArea(changedNode, "B", {
      center: { x: 58, y: 42 },
      size: { width: 50, height: 30 },
      skew: 4,
    })
    const imported = parseCustomScenarioText(serializeCustomScenario(changedMap))

    expect(orderedCustomEvents(imported)[0]).toEqual({
      event_type: "gps_drop",
      target: "UxV-05",
      severity: 0.7,
    })
    const area = imported.map.areas.at(1)
    expect(area).toBeDefined()
    if (area !== undefined) {
      expect(areaPath(area)).toContain("M")
    }
  })
})
