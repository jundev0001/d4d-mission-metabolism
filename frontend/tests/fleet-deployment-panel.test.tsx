import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FleetDeploymentPanel } from "../src/components/FleetDeploymentPanel"
import { mapAssetIconHref } from "../src/mapAssetIcons"
import { useMissionStore } from "../src/store"
import { DashboardStateSchema } from "../src/types"
import type { VehicleTypeProfile } from "../src/vehicleDeployment"
import { makeDashboardState } from "./fixtures"

const apiMocks = vi.hoisted(() => ({
  deployFleet: vi.fn(),
  fetchReplay: vi.fn(),
}))

vi.mock("../src/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/api")>()),
  deployFleet: apiMocks.deployFleet,
  fetchReplay: apiMocks.fetchReplay,
}))

describe("fleet deployment panel", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    apiMocks.fetchReplay.mockResolvedValue({ entries: [] })
    const dashboard = makeDeploymentDashboard()
    apiMocks.deployFleet.mockResolvedValue(dashboard)
    useMissionStore.setState({
      dashboard,
      isRunningDemo: false,
      lastError: null,
      replay: [],
      selectedReplayIndex: 0,
      vehicleTypeProfiles: vehicleProfiles,
    })
  })

  it("Given deployed UxVs When removing a map asset Then the fleet is redeployed without that type", async () => {
    render(<FleetDeploymentPanel />)

    fireEvent.click(screen.getByRole("button", { name: "UxV-04 삭제" }))

    await waitFor(() => {
      expect(apiMocks.deployFleet).toHaveBeenCalledWith([
        { vehicle_type: "fixedwing_survey_uav", count: 1 },
        { vehicle_type: "micro_scout_uav", count: 1 },
        { vehicle_type: "overwatch_uav", count: 1 },
        { vehicle_type: "scout_rover", count: 1 },
        { vehicle_type: "sensor_rover", count: 1 },
      ])
    })
  })

  it("Given deployment options and map assets When the panel renders Then vehicle-type icons are shown in both lists", () => {
    render(<FleetDeploymentPanel />)

    const deploymentIcons = screen.getAllByTestId("deployment-vehicle-type-icon")
    const deployedAssetIcons = screen.getAllByTestId("deployed-asset-type-icon")

    expect(deploymentIcons).toHaveLength(vehicleProfiles.length)
    expect(deployedAssetIcons).toHaveLength(6)
    expect(deploymentIcons[0]).toHaveAttribute("src", mapAssetIconHref("fixedwing_survey_uav"))
    expect(deployedAssetIcons[3]).toHaveAttribute("src", mapAssetIconHref("relay_uav"))
  })
})

const vehicleProfiles: readonly VehicleTypeProfile[] = [
  profile("fixedwing_survey_uav", "visual_recon"),
  profile("micro_scout_uav", "visual_recon"),
  profile("overwatch_uav", "overwatch"),
  profile("relay_uav", "relay"),
  profile("scout_rover", "reserve"),
  profile("sensor_rover", "overwatch"),
]

function makeDeploymentDashboard() {
  const base = makeDashboardState()
  const vehicles = [
    vehicle("UxV-01", "fixedwing_survey_uav", "visual_recon", "A"),
    vehicle("UxV-02", "micro_scout_uav", "visual_recon", "B"),
    vehicle("UxV-03", "overwatch_uav", "overwatch", "B"),
    vehicle("UxV-04", "relay_uav", "relay", "B"),
    vehicle("UxV-05", "sensor_rover", "overwatch", "C"),
    vehicle("UxV-06", "scout_rover", "reserve", "A"),
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

function vehicle(id: string, type: string, role: string, area: string) {
  return {
    area,
    capabilities: {
      gps_denied_nav: 0.7,
      overwatch: 0.7,
      relay: 0.7,
      reserve: 0.7,
      visual_recon: 0.7,
    },
    health: {
      battery: 0.86,
      comm: 0.9,
      confidence: 0.9,
      degradation_reason: "",
      health: 0.94,
      nav: 0.82,
      sensor: 0.88,
    },
    id,
    label: id,
    position: { x: 40, y: 40 },
    role,
    status: "active",
    synthetic: false,
    type,
    velocity: { x: 0, y: 0 },
  }
}

function profile(
  vehicle_type: VehicleTypeProfile["vehicle_type"],
  primary_role: VehicleTypeProfile["primary_role"],
) {
  return {
    capabilities: {
      gps_denied_nav: 0.7,
      overwatch: 0.7,
      relay: 0.7,
      reserve: 0.7,
      visual_recon: 0.7,
    },
    endurance: 0.7,
    label: vehicle_type,
    platform: "UxV",
    primary_role,
    terrain_notes: [],
    vehicle_type,
  }
}
