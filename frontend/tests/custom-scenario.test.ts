import { describe, expect, it } from "vitest"
import { areaPath, parseCustomScenarioText, serializeCustomScenario } from "../src/customScenario"
import { customScenarioEventBatches, orderedCustomEvents } from "../src/customScenarioGraph"
import {
  addMapArea,
  addParallelScenarioNode,
  removeMapArea,
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

    expect(imported.intent.constraints.target_mcc).toBe(0.8)
    expect(orderedCustomEvents(imported)).toEqual([
      { event_type: "comm_jam", target: "B", severity: 0.82 },
      { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
      { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
      { event_type: "gps_drop", target: "UxV-05", severity: 0.7 },
      { event_type: "no_go", target: "B", severity: 0.68 },
    ])
  })

  it("Given an older scenario JSON When imported Then mission intent defaults are added", () => {
    const legacy = JSON.parse(serializeCustomScenario(DEFAULT_CUSTOM_SCENARIO))
    delete legacy.intent

    const imported = parseCustomScenarioText(JSON.stringify(legacy))

    expect(imported.intent).toEqual({
      constraints: {
        return_battery_threshold: 0.2,
        min_relay_redundancy: 1,
        human_approval_for_replan: true,
        target_mcc: 0.8,
      },
      autonomy_level: 0.62,
    })
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
      points: [
        { x: 44, y: 24 },
        { x: 84, y: 26 },
        { x: 80, y: 58 },
        { x: 40, y: 56 },
      ],
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

  it("Given drawn areas When adding and removing a map area Then event targets stay valid", () => {
    const added = addMapArea(DEFAULT_CUSTOM_SCENARIO, [
      { x: 10, y: 10 },
      { x: 30, y: 12 },
      { x: 28, y: 30 },
      { x: 12, y: 28 },
    ])
    const withEvent = withScenarioNodeEvent(added.document, "node-comm-jam", {
      target: added.selectedAreaId,
    })
    const removed = removeMapArea(withEvent, added.selectedAreaId)
    const imported = parseCustomScenarioText(serializeCustomScenario(removed.document))

    expect(added.document.map.areas).toHaveLength(4)
    expect(added.document.map.areas.at(-1)?.label).toBe("Area D")
    expect(imported.map.areas.some((area) => area.id === added.selectedAreaId)).toBe(false)
    expect(imported.scenario.nodes[0]?.event.target).toBe(imported.map.areas[0]?.id)
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
