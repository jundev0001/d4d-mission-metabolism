import { describe, expect, it } from "vitest"
import { areaPath, parseCustomScenarioText, serializeCustomScenario } from "../src/customScenario"
import { customScenarioEventBatches, orderedCustomEvents } from "../src/customScenarioGraph"
import {
  addParallelScenarioNode,
  removeScenarioEdge,
  removeScenarioNode,
  upsertScenarioEdge,
  withMapArea,
  withScenarioNodeEvent,
} from "../src/customScenarioMutations"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"

describe("custom scenario document", () => {
  it("Given a scenario document When exported and imported Then the testable event order is preserved", () => {
    const serialized = serializeCustomScenario(DEFAULT_CUSTOM_SCENARIO)
    const imported = parseCustomScenarioText(serialized)

    expect(orderedCustomEvents(imported)).toEqual([
      { event_type: "comm_jam", target: "B", severity: 0.82 },
      { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
      { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
      { event_type: "gps_drop", target: "UxV-05", severity: 0.7 },
      { event_type: "no_go", target: "B", severity: 0.68 },
    ])
  })

  it("Given a branched scenario When deriving batches Then sibling events run in the same stage", () => {
    const batches = customScenarioEventBatches(DEFAULT_CUSTOM_SCENARIO)

    expect(batches).toEqual([
      [{ event_type: "comm_jam", target: "B", severity: 0.82 }],
      [
        { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
        { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
      ],
      [
        { event_type: "gps_drop", target: "UxV-05", severity: 0.7 },
        { event_type: "no_go", target: "B", severity: 0.68 },
      ],
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

  it("Given a selected branch node When adding a parallel event Then it shares the same parent", () => {
    const result = addParallelScenarioNode(DEFAULT_CUSTOM_SCENARIO, "node-battery")
    const newNodeId = result.selectedNodeId

    expect(result.document.scenario.edges).toContainEqual({
      from: "node-comm-jam",
      to: newNodeId,
    })
    expect(customScenarioEventBatches(result.document).at(1)).toHaveLength(3)
  })

  it("Given graph edits When removing a node or edge Then incident connections are removed", () => {
    const withoutNode = removeScenarioNode(DEFAULT_CUSTOM_SCENARIO, "node-battery").document
    const withoutEdge = removeScenarioEdge(DEFAULT_CUSTOM_SCENARIO, {
      from: "node-comm-jam",
      to: "node-link",
    })

    expect(withoutNode.scenario.nodes.some((node) => node.id === "node-battery")).toBe(false)
    expect(withoutNode.scenario.edges.some((edge) => edge.from === "node-battery")).toBe(false)
    expect(withoutNode.scenario.edges.some((edge) => edge.to === "node-battery")).toBe(false)
    expect(withoutEdge.scenario.edges).not.toContainEqual({
      from: "node-comm-jam",
      to: "node-link",
    })
  })

  it("Given a graph When adding an edge Then duplicate and cyclic edges are rejected", () => {
    const duplicate = upsertScenarioEdge(DEFAULT_CUSTOM_SCENARIO, {
      from: "node-comm-jam",
      to: "node-link",
    })
    const cyclic = upsertScenarioEdge(DEFAULT_CUSTOM_SCENARIO, {
      from: "node-gps",
      to: "node-comm-jam",
    })

    expect(duplicate).toBe(DEFAULT_CUSTOM_SCENARIO)
    expect(cyclic).toBe(DEFAULT_CUSTOM_SCENARIO)
  })
})
