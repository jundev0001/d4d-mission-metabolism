import { z } from "zod"
import { EventTypes, type MissionConstraints, type MissionType, MissionTypes } from "./types"

const VIEWBOX_HEIGHT = 86
export const MAX_SCENARIO_AREAS = 12
export const MAX_AREA_POINTS = 16
export const MAX_SCENARIO_NODES = 12
export const MAX_SCENARIO_EDGES = 24

const Percent = z.number().min(0).max(1)
const CoordinateX = z.number().min(0).max(100)
const CoordinateY = z.number().min(0).max(VIEWBOX_HEIGHT)
const PointSchema = z.object({ x: CoordinateX, y: CoordinateY })
const CapabilityDemandSchema = z.object({
  visual_recon: z.number().min(0),
  relay: z.number().min(0),
  overwatch: z.number().min(0),
  gps_denied_nav: z.number().min(0),
  reserve: z.number().min(0),
})

const MissionIntentSchema = z
  .object({
    constraints: z
      .object({
        return_battery_threshold: Percent.default(0.2),
        min_relay_redundancy: z.number().int().min(0).default(1),
        human_approval_for_replan: z.boolean().default(true),
        target_mcc: Percent.default(0.8),
      })
      .default({
        return_battery_threshold: 0.2,
        min_relay_redundancy: 1,
        human_approval_for_replan: true,
        target_mcc: 0.8,
      }),
    autonomy_level: Percent.default(0.62),
  })
  .default({
    constraints: {
      return_battery_threshold: 0.2,
      min_relay_redundancy: 1,
      human_approval_for_replan: true,
      target_mcc: 0.8,
    },
    autonomy_level: 0.62,
  })

export const CustomMapAreaSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  label: z.string().min(1).max(24),
  points: z.array(PointSchema).min(3).max(MAX_AREA_POINTS),
  label_position: PointSchema,
  metric_position: PointSchema,
  threat_position: PointSchema,
  mission_type: z.enum(MissionTypes),
  priority: Percent,
  threat: Percent,
  requirements: CapabilityDemandSchema,
})

const CustomScenarioNodeSchema = z.object({
  id: z.string().min(1).max(40),
  event: z.object({
    event_type: z.enum(EventTypes),
    target: z.string().min(1).max(64),
    severity: Percent,
  }),
  position: PointSchema,
})

const CustomScenarioEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

export const CustomScenarioDocumentSchema = z.object({
  version: z.literal(1),
  intent: MissionIntentSchema,
  map: z.object({
    name: z.string().min(1).max(48),
    areas: z.array(CustomMapAreaSchema).min(1).max(MAX_SCENARIO_AREAS),
  }),
  scenario: z.object({
    name: z.string().min(1).max(48),
    entry_node_id: z.string().min(1),
    nodes: z.array(CustomScenarioNodeSchema).min(1).max(MAX_SCENARIO_NODES),
    edges: z.array(CustomScenarioEdgeSchema).max(MAX_SCENARIO_EDGES),
  }),
})

export type CustomPoint = z.infer<typeof PointSchema>
export type CustomCapabilityDemand = z.infer<typeof CapabilityDemandSchema>
export type CustomMissionIntent = {
  readonly constraints: MissionConstraints
  readonly autonomy_level: number
}
export type CustomMapArea = z.infer<typeof CustomMapAreaSchema>
export type CustomScenarioDocument = z.infer<typeof CustomScenarioDocumentSchema>
export type CustomScenarioNode = CustomScenarioDocument["scenario"]["nodes"][number]
export type CustomScenarioEvent = CustomScenarioNode["event"]
export type CustomScenarioEdge = CustomScenarioDocument["scenario"]["edges"][number]

const MISSION_REQUIREMENTS: Record<MissionType, CustomCapabilityDemand> = {
  area_recon: {
    visual_recon: 1.25,
    relay: 0.45,
    overwatch: 0.55,
    gps_denied_nav: 0.25,
    reserve: 0.2,
  },
  route_recon: {
    visual_recon: 1.0,
    relay: 0.35,
    overwatch: 0.35,
    gps_denied_nav: 0.65,
    reserve: 0.2,
  },
  persistent_watch: {
    visual_recon: 0.75,
    relay: 0.55,
    overwatch: 1.15,
    gps_denied_nav: 0.25,
    reserve: 0.3,
  },
  perimeter_security: {
    visual_recon: 0.85,
    relay: 0.45,
    overwatch: 0.95,
    gps_denied_nav: 0.45,
    reserve: 0.35,
  },
  comm_relay: {
    visual_recon: 0.35,
    relay: 1.25,
    overwatch: 0.35,
    gps_denied_nav: 0.2,
    reserve: 0.35,
  },
  gps_denied_scout: {
    visual_recon: 0.85,
    relay: 0.35,
    overwatch: 0.35,
    gps_denied_nav: 1.1,
    reserve: 0.25,
  },
  damage_assessment: {
    visual_recon: 1.15,
    relay: 0.35,
    overwatch: 0.55,
    gps_denied_nav: 0.35,
    reserve: 0.3,
  },
}

export function areaPath(area: CustomMapArea): string {
  return pointsToPath(area.points)
}

export function pointsToPath(points: readonly CustomPoint[]): string {
  const [first, ...rest] = points
  if (first === undefined) {
    return ""
  }
  const segments = rest.map((point) => `L${formatPathNumber(point.x)} ${formatPathNumber(point.y)}`)
  return `M${formatPathNumber(first.x)} ${formatPathNumber(first.y)} ${segments.join(" ")} Z`
}

export function areaCentroid(area: { readonly points: readonly CustomPoint[] }): CustomPoint {
  const total = area.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
    x: 0,
    y: 0,
  })
  return {
    x: roundCoordinate(total.x / area.points.length),
    y: roundCoordinate(total.y / area.points.length),
  }
}

export function requirementsForMissionType(missionType: MissionType): CustomCapabilityDemand {
  return { ...MISSION_REQUIREMENTS[missionType] }
}

export function serializeCustomScenario(document: CustomScenarioDocument): string {
  return JSON.stringify(document, null, 2)
}

export function parseCustomScenarioText(text: string): CustomScenarioDocument {
  return CustomScenarioDocumentSchema.parse(JSON.parse(text))
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(2))
}

function formatPathNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "")
}
