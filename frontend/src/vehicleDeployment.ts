import { z } from "zod"
import { CapabilityNames } from "./types"

export const VehicleTypes = [
  "micro_scout_uav",
  "quad_recon_uav",
  "fixedwing_survey_uav",
  "relay_uav",
  "overwatch_uav",
  "gps_denied_uav",
  "scout_rover",
  "sensor_rover",
] as const

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  fixedwing_survey_uav: "고정익 조사 UAV",
  gps_denied_uav: "GPS 거부 UAV",
  micro_scout_uav: "초소형 정찰 UAV",
  overwatch_uav: "감시 UAV",
  quad_recon_uav: "쿼드 정찰 UAV",
  relay_uav: "중계 UAV",
  scout_rover: "정찰 로버",
  sensor_rover: "센서 로버",
}

const Percent = z.number().min(0).max(1)
const CapabilityNameSchema = z.enum(CapabilityNames)
const VehicleTypeSchema = z.enum(VehicleTypes)

const CapabilityVectorSchema = z.object({
  visual_recon: Percent,
  relay: Percent,
  overwatch: Percent,
  gps_denied_nav: Percent,
  reserve: Percent,
})

const VehicleTypeProfileSchema = z.object({
  vehicle_type: VehicleTypeSchema,
  label: z.string(),
  platform: z.string(),
  primary_role: CapabilityNameSchema,
  capabilities: CapabilityVectorSchema,
  endurance: Percent,
  speed: Percent,
  terrain_notes: z.array(z.string()),
})

export const VehicleTypeCatalogResponseSchema = z.object({
  profiles: z.array(VehicleTypeProfileSchema),
})

export type VehicleType = z.infer<typeof VehicleTypeSchema>
export type VehicleTypeProfile = z.infer<typeof VehicleTypeProfileSchema>
export type VehicleTypeCatalogResponse = z.infer<typeof VehicleTypeCatalogResponseSchema>

export type FleetDeploymentItem = {
  readonly vehicle_type: VehicleType
  readonly count: number
}

export type FleetDeploymentPayload = readonly FleetDeploymentItem[]

export function isDeployableVehicleType(vehicleType: string): vehicleType is VehicleType {
  return VehicleTypes.some((item) => item === vehicleType)
}

export function vehicleTypeLabel(vehicleType: string): string {
  if (vehicleType === "synthetic_wingman") {
    return "합성 윙맨"
  }
  const deployableType = VehicleTypes.find((item) => item === vehicleType)
  if (deployableType === undefined) {
    return vehicleType
  }
  return VEHICLE_TYPE_LABELS[deployableType]
}
