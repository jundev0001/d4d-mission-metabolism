import { type DashboardState, DashboardStateSchema, type RecommendationCard } from "../src/types"

export function makeRecommendationCard(): RecommendationCard {
  return {
    id: "rec-001",
    severity: "high",
    title: "B area mission instability",
    causes: ["comm_jam", "relay_redundancy"],
    actions: [
      {
        vehicle_id: "UxV-04",
        action: "reposition_relay",
        area: "B",
        rationale: "restore relay margin",
      },
    ],
    expected_effect: {
      mcc_delta: 0.14,
      collapse_probability_delta: -0.32,
      autonomy_debt_delta: -24,
      operator_actions_delta: -6,
    },
    status: "pending",
    event_id: "evt-001",
  }
}

export function makeDashboardState(): DashboardState {
  return DashboardStateSchema.parse({
    mission: {
      id: "mission-seoul-isr",
      mission_type: "area_recon",
      objective: "Maintain A/B/C ISR continuity",
      areas: ["A", "B", "C"],
      requirements: {
        A: vector(1),
        B: vector(1),
        C: vector(1),
      },
      constraints: {
        return_battery_threshold: 0.2,
        min_relay_redundancy: 1,
        human_approval_for_replan: true,
        target_mcc: 0.8,
      },
      autonomy_level: 0.62,
      area_threats: { A: 0.1, B: 0.1, C: 0.1 },
      area_priorities: { A: 0.7, B: 1, C: 0.6 },
      area_centers: { A: { x: 25, y: 30 }, B: { x: 63, y: 39 }, C: { x: 52, y: 67 } },
      area_mission_types: {
        A: "area_recon",
        B: "comm_relay",
        C: "persistent_watch",
      },
      no_go_areas: [],
    },
    vehicles: [
      {
        id: "UxV-04",
        type: "relay_uav",
        label: "Relay reserve",
        area: "B",
        role: "relay",
        position: { x: 52, y: 44 },
        velocity: { x: 0, y: 0 },
        health: {
          battery: 0.9,
          comm: 0.95,
          nav: 0.88,
          sensor: 0.8,
          health: 0.96,
          confidence: 0.9,
          degradation_reason: "",
        },
        capabilities: vector(0.8),
        status: "active",
        synthetic: false,
      },
    ],
    assignments: [{ vehicle_id: "UxV-04", area: "B", role: "relay", weight: 1 }],
    metrics: {
      mcc: 0.88,
      strain: 0.2,
      collapse_probability: 0.24,
      autonomy_debt: 22,
      operator_actions: 2,
      alert_backlog: 1,
      approval_count: 0,
      replan_time_seconds: 11,
      ccr_external: 7,
      ccr_internal: 3,
    },
    capability_report: {
      effective_capabilities: { "UxV-04": vector(0.8) },
      area_reports: {
        B: {
          area: "B",
          coverage: vector(0.9),
          deficit: vector(0),
        },
      },
      overall_mcc: 0.88,
      deficit_score: 0.05,
    },
    recommendations: [makeRecommendationCard()],
    events: [],
    scenario_time: 90,
    baseline_operator_actions: 28,
    assisted_operator_actions: 4,
    system_micro_actions: 12,
    human_intents: 4,
    recovery_actions: 3,
  })
}

function vector(value: number) {
  return {
    visual_recon: value,
    relay: value,
    overwatch: value,
    gps_denied_nav: value,
    reserve: value,
  }
}
