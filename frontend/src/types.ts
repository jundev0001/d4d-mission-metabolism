import { z } from "zod"

export const CapabilityNames = [
  "visual_recon",
  "relay",
  "overwatch",
  "gps_denied_nav",
  "reserve",
] as const

export const MissionTypes = [
  "area_recon",
  "route_recon",
  "persistent_watch",
  "perimeter_security",
  "comm_relay",
  "gps_denied_scout",
  "damage_assessment",
] as const

export const EventTypes = [
  "comm_jam",
  "gps_drop",
  "battery_drop",
  "sensor_fail",
  "vehicle_lost",
  "alert_flood",
  "comm_degraded",
  "no_go",
  "priority_shift",
  "data_stale",
  "target_detected",
  "mobility_blocked",
  "weather_degraded",
  "collision_risk",
  "sensor_confidence_drop",
  "asset_added",
  "reserve_depleted",
] as const

const DecisionActions = ["approve", "reject", "manual"] as const
const MicroActionTypes = [
  "return",
  "replace",
  "reposition_relay",
  "low_bandwidth",
  "hold",
  "suppress_alerts",
  "redistribute_coverage",
  "reroute",
  "deconflict_paths",
  "reassign_role",
  "handoff_target",
  "switch_sensor_mode",
  "sync_data",
  "mark_area_stale",
  "launch_reserve",
  "downgrade_objective",
  "request_human_confirm",
] as const

const Percent = z.number().min(0).max(1)
const NonNegative = z.number().min(0)

const MissionTypeSchema = z.enum(MissionTypes)
const CapabilityNameSchema = z.enum(CapabilityNames)
const EventTypeSchema = z.enum(EventTypes)
const DecisionActionSchema = z.enum(DecisionActions)
const MicroActionTypeSchema = z.enum(MicroActionTypes)

const HealthStateSchema = z.object({
  battery: Percent,
  comm: Percent,
  nav: Percent,
  sensor: Percent,
  health: Percent,
  confidence: Percent,
  degradation_reason: z.string(),
})

const CapabilityVectorSchema = z.object({
  visual_recon: Percent,
  relay: Percent,
  overwatch: Percent,
  gps_denied_nav: Percent,
  reserve: Percent,
})

const PointSchema = z.object({ x: z.number(), y: z.number() })

const VehicleSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  area: z.string(),
  role: CapabilityNameSchema,
  position: PointSchema,
  velocity: PointSchema,
  health: HealthStateSchema,
  capabilities: CapabilityVectorSchema,
  status: z.enum(["active", "returning", "lost", "standby"]),
  synthetic: z.boolean(),
})

const CapabilityDemandSchema = z.object({
  visual_recon: NonNegative,
  relay: NonNegative,
  overwatch: NonNegative,
  gps_denied_nav: NonNegative,
  reserve: NonNegative,
})

const MissionSchema = z.object({
  id: z.string(),
  mission_type: MissionTypeSchema,
  objective: z.string(),
  areas: z.array(z.string()),
  requirements: z.record(z.string(), CapabilityDemandSchema),
  constraints: z.object({
    return_battery_threshold: Percent,
    min_relay_redundancy: z.number().int().min(0),
    human_approval_for_replan: z.boolean(),
    target_mcc: Percent,
  }),
  autonomy_level: Percent,
  area_threats: z.record(z.string(), Percent),
  area_priorities: z.record(z.string(), Percent),
  area_centers: z.record(z.string(), PointSchema),
  area_mission_types: z.record(z.string(), MissionTypeSchema),
  no_go_areas: z.array(z.string()),
})

const AssignmentSchema = z.object({
  vehicle_id: z.string(),
  area: z.string(),
  role: CapabilityNameSchema,
  weight: Percent,
})

const AreaCoverageSchema = z.object({
  area: z.string(),
  coverage: z.record(z.string(), Percent),
  deficit: z.record(z.string(), Percent),
})

const CapabilityReportSchema = z.object({
  effective_capabilities: z.record(z.string(), CapabilityVectorSchema),
  area_reports: z.record(z.string(), AreaCoverageSchema),
  overall_mcc: Percent,
  deficit_score: Percent,
})

const MetricSnapshotSchema = z.object({
  mcc: Percent,
  strain: Percent,
  collapse_probability: Percent,
  autonomy_debt: z.number().min(0).max(100),
  operator_actions: z.number().int().min(0),
  alert_backlog: z.number().int().min(0),
  approval_count: z.number().int().min(0),
  replan_time_seconds: z.number().min(0),
  ccr_external: z.number().min(0),
  ccr_internal: z.number().min(0),
})

const KpiDeltaSchema = z.object({
  mcc_delta: z.number(),
  collapse_probability_delta: z.number(),
  autonomy_debt_delta: z.number(),
  operator_actions_delta: z.number().int(),
})

const MicroActionSchema = z.object({
  vehicle_id: z.string(),
  action: MicroActionTypeSchema,
  area: z.string().nullable(),
  rationale: z.string(),
})

const RecommendationCardSchema = z.object({
  id: z.string(),
  severity: z.string(),
  title: z.string(),
  causes: z.array(z.string()),
  actions: z.array(MicroActionSchema),
  expected_effect: KpiDeltaSchema,
  status: z.enum(["pending", "approved", "rejected", "manual"]),
  event_id: z.string().nullable(),
})

const EventRecordSchema = z.object({
  id: z.string(),
  event_type: EventTypeSchema,
  target: z.string(),
  severity: Percent,
  scenario_time: z.number().int().min(0),
  summary: z.string(),
})

const BlackBoxEntrySchema = z.object({
  id: z.string(),
  scenario_time: z.number().int().min(0),
  kind: z.string(),
  summary: z.string(),
  payload_json: z.string(),
})

export const DashboardStateSchema = z.object({
  mission: MissionSchema,
  vehicles: z.array(VehicleSchema),
  assignments: z.array(AssignmentSchema),
  metrics: MetricSnapshotSchema,
  capability_report: CapabilityReportSchema,
  recommendations: z.array(RecommendationCardSchema),
  events: z.array(EventRecordSchema),
  scenario_time: z.number().int().min(0),
  baseline_operator_actions: z.number().int().min(0),
  assisted_operator_actions: z.number().int().min(0),
  system_micro_actions: z.number().int().min(0),
  human_intents: z.number().int().min(0),
  recovery_actions: z.number().int().min(0),
})

export const ReplayResponseSchema = z.object({
  entries: z.array(BlackBoxEntrySchema),
})

export type MissionType = z.infer<typeof MissionTypeSchema>
export type CapabilityName = z.infer<typeof CapabilityNameSchema>
export type EventType = z.infer<typeof EventTypeSchema>
export type DecisionAction = z.infer<typeof DecisionActionSchema>
export type MicroActionType = z.infer<typeof MicroActionTypeSchema>
export type Point = z.infer<typeof PointSchema>
export type CapabilityDemand = z.infer<typeof CapabilityDemandSchema>
export type Vehicle = z.infer<typeof VehicleSchema>
export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>
export type RecommendationCard = z.infer<typeof RecommendationCardSchema>
export type BlackBoxEntry = z.infer<typeof BlackBoxEntrySchema>
export type DashboardState = z.infer<typeof DashboardStateSchema>
export type ReplayResponse = z.infer<typeof ReplayResponseSchema>

export type EventPayload = {
  readonly event_type: EventType
  readonly target: string
  readonly severity: number
}

export type DecisionPayload = {
  readonly recommendation_id: string
  readonly action: DecisionAction
  readonly manual_action?: MicroActionType
  readonly vehicle_id?: string
}
