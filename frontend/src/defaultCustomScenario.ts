import {
  type CustomScenarioDocument,
  CustomScenarioDocumentSchema,
  requirementsForMissionType,
} from "./customScenario"

export const DEFAULT_CUSTOM_SCENARIO: CustomScenarioDocument = CustomScenarioDocumentSchema.parse({
  version: 1,
  intent: {
    constraints: {
      return_battery_threshold: 0.2,
      min_relay_redundancy: 1,
      human_approval_for_replan: true,
      target_mcc: 0.8,
    },
    autonomy_level: 0.62,
  },
  map: {
    name: "Custom ISR map",
    areas: [
      {
        id: "A",
        label: "Area A",
        points: [
          { x: 13, y: 15 },
          { x: 47, y: 15 },
          { x: 37, y: 45 },
          { x: 3, y: 45 },
        ],
        label_position: { x: 16, y: 21 },
        metric_position: { x: 16, y: 27 },
        threat_position: { x: 26, y: 30 },
        mission_type: "area_recon",
        priority: 0.72,
        threat: 0.08,
        requirements: requirementsForMissionType("area_recon"),
      },
      {
        id: "B",
        label: "Area B",
        points: [
          { x: 50, y: 22 },
          { x: 92, y: 22 },
          { x: 77, y: 56 },
          { x: 34, y: 56 },
        ],
        label_position: { x: 52, y: 30 },
        metric_position: { x: 52, y: 36 },
        threat_position: { x: 64, y: 39 },
        mission_type: "comm_relay",
        priority: 1,
        threat: 0.12,
        requirements: {
          ...requirementsForMissionType("comm_relay"),
          visual_recon: 1.2,
          overwatch: 0.8,
        },
      },
      {
        id: "C",
        label: "Area C",
        points: [
          { x: 15, y: 55 },
          { x: 79, y: 55 },
          { x: 89, y: 80 },
          { x: 25, y: 80 },
        ],
        label_position: { x: 28, y: 62 },
        metric_position: { x: 28, y: 68 },
        threat_position: { x: 65, y: 67 },
        mission_type: "persistent_watch",
        priority: 0.58,
        threat: 0.06,
        requirements: requirementsForMissionType("persistent_watch"),
      },
    ],
  },
  scenario: {
    name: "Custom event flow",
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
