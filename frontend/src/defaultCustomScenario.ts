import { type CustomScenarioDocument, CustomScenarioDocumentSchema } from "./customScenario"

export const DEFAULT_CUSTOM_SCENARIO: CustomScenarioDocument = CustomScenarioDocumentSchema.parse({
  version: 1,
  map: {
    name: "A/B/C ISR 복원 맵",
    areas: [
      {
        id: "A",
        label: "구역 A",
        center: { x: 25, y: 30 },
        size: { width: 34, height: 30 },
        skew: 5,
        label_position: { x: 16, y: 21 },
        metric_position: { x: 16, y: 27 },
        threat_position: { x: 26, y: 30 },
      },
      {
        id: "B",
        label: "구역 B",
        center: { x: 63, y: 39 },
        size: { width: 43, height: 34 },
        skew: 8,
        label_position: { x: 52, y: 30 },
        metric_position: { x: 52, y: 36 },
        threat_position: { x: 64, y: 39 },
      },
      {
        id: "C",
        label: "구역 C",
        center: { x: 52, y: 67 },
        size: { width: 64, height: 25 },
        skew: -5,
        label_position: { x: 63, y: 70 },
        metric_position: { x: 63, y: 76 },
        threat_position: { x: 65, y: 67 },
      },
    ],
  },
  scenario: {
    name: "전자전-배터리 회복 테스트",
    entry_node_id: "node-comm-jam",
    nodes: [
      {
        id: "node-comm-jam",
        event: { event_type: "comm_jam", target: "B", severity: 0.82 },
        position: { x: 10, y: 38 },
      },
      {
        id: "node-battery",
        event: { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
        position: { x: 38, y: 26 },
      },
      {
        id: "node-link",
        event: { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
        position: { x: 38, y: 50 },
      },
      {
        id: "node-gps",
        event: { event_type: "gps_drop", target: "UxV-05", severity: 0.7 },
        position: { x: 66, y: 26 },
      },
      {
        id: "node-no-go",
        event: { event_type: "no_go", target: "B", severity: 0.68 },
        position: { x: 66, y: 50 },
      },
    ],
    edges: [
      { from: "node-comm-jam", to: "node-battery" },
      { from: "node-comm-jam", to: "node-link" },
      { from: "node-battery", to: "node-gps" },
      { from: "node-link", to: "node-no-go" },
    ],
  },
})
