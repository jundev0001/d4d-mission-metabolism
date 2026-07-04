import { DashboardStateSchema } from "../src/types"
import type { VehicleTypeProfile } from "../src/vehicleDeployment"
import { makeDashboardState } from "./fixtures"

export const mapVehicleTypeProfiles: readonly VehicleTypeProfile[] = [
  profile("fixedwing_survey_uav", "visual_recon"),
  profile("micro_scout_uav", "visual_recon"),
  profile("overwatch_uav", "overwatch"),
  profile("relay_uav", "relay"),
  profile("scout_rover", "reserve"),
  profile("sensor_rover", "overwatch"),
]

export function makeMapDashboard() {
  const base = makeDashboardState()
  const vehicles = [
    vehicle({
      area: "A",
      id: "UxV-01",
      role: "visual_recon",
      type: "fixedwing_survey_uav",
      x: 18,
      y: 28,
    }),
    vehicle({
      area: "B",
      id: "UxV-02",
      role: "visual_recon",
      type: "micro_scout_uav",
      x: 48,
      y: 41,
    }),
    vehicle({ area: "B", id: "UxV-03", role: "overwatch", type: "overwatch_uav", x: 51, y: 42 }),
    vehicle({ area: "B", id: "UxV-04", role: "relay", type: "relay_uav", x: 54, y: 44 }),
    vehicle({ area: "C", id: "UxV-05", role: "overwatch", type: "sensor_rover", x: 72, y: 62 }),
    vehicle({ area: "A", id: "UxV-06", role: "reserve", type: "scout_rover", x: 22, y: 34 }),
  ]
  return DashboardStateSchema.parse({
    ...base,
    assignments: vehicles.map((item) => ({
      area: item.area,
      role: item.role,
      vehicle_id: item.id,
      weight: 1,
    })),
    vehicles,
  })
}

type TestVehicleRequest = {
  readonly area: string
  readonly id: string
  readonly role: string
  readonly type: string
  readonly x: number
  readonly y: number
}

function vehicle(request: TestVehicleRequest) {
  return {
    area: request.area,
    capabilities: vector(0.7),
    health: {
      battery: 0.86,
      comm: 0.9,
      confidence: 0.9,
      degradation_reason: "",
      health: 0.94,
      nav: 0.82,
      sensor: 0.88,
    },
    id: request.id,
    label: request.id,
    position: { x: request.x, y: request.y },
    role: request.role,
    status: "active",
    synthetic: false,
    type: request.type,
    velocity: { x: 0, y: 0 },
  }
}

function profile(
  vehicle_type: VehicleTypeProfile["vehicle_type"],
  primary_role: VehicleTypeProfile["primary_role"],
): VehicleTypeProfile {
  return {
    capabilities: vector(0.7),
    endurance: 0.7,
    label: vehicle_type,
    platform: "UxV",
    primary_role,
    terrain_notes: [],
    vehicle_type,
  }
}

function vector(value: number) {
  return {
    gps_denied_nav: value,
    overwatch: value,
    relay: value,
    reserve: value,
    visual_recon: value,
  }
}
