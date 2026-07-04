import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MapView } from "../src/components/MapView"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"
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

describe("map view", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    apiMocks.fetchReplay.mockResolvedValue({ entries: [] })
    apiMocks.deployFleet.mockResolvedValue(makeMapDashboard())
    useMissionStore.setState({
      customScenario: DEFAULT_CUSTOM_SCENARIO,
      dashboard: makeDashboardState(),
      isRunningDemo: false,
      lastError: null,
      replay: [],
      selectedReplayIndex: 0,
      vehicleTypeProfiles,
    })
  })

  it("Given a UxV on the COP When the map renders Then hover details are available on the asset glyph", () => {
    render(<MapView />)

    const assetGlyph = screen.getByLabelText("UxV-04 자산 정보")
    fireEvent.mouseEnter(assetGlyph)

    const map = screen.getByTestId("map-view")
    const svg = map.querySelector(".cop-map")
    const infoLayer = svg?.querySelector(".asset-info-layer")
    const visibleInfo = infoLayer?.querySelector(".asset-info.visible")

    expect(assetGlyph).toBeInTheDocument()
    expect(infoLayer).toBeInTheDocument()
    expect(svg?.lastElementChild).toBe(infoLayer)
    expect(visibleInfo).toHaveTextContent("UxV-04 · 중계 UAV")
    expect(visibleInfo).toHaveTextContent("가용 80% · 배터리 90%")
  })

  it("Given the COP is visible When the operator wheels and drags Then the map viewBox changes", () => {
    render(<MapView />)
    const svg = copSvg()
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 860, width: 1000, x: 0, y: 0 }),
    )

    fireEvent.wheel(svg, { clientX: 500, clientY: 430, deltaY: -120 })
    const zoomedViewBox = svg.getAttribute("viewBox")
    fireEvent.pointerDown(svg, { button: 0, clientX: 500, clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 560, clientY: 480, pointerId: 1 })

    expect(zoomedViewBox).not.toBe("0 0 100 86")
    expect(svg.getAttribute("viewBox")).not.toBe(zoomedViewBox)
  })

  it("Given deployed UxVs When an asset is removed from the COP menu Then fleet deployment is updated", async () => {
    useMissionStore.setState({ dashboard: makeMapDashboard() })
    render(<MapView />)

    fireEvent.contextMenu(screen.getByLabelText("UxV-04 자산 정보"), { clientX: 500, clientY: 300 })
    fireEvent.click(screen.getByRole("button", { name: "UxV-04 제거" }))

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
})

const vehicleTypeProfiles: readonly VehicleTypeProfile[] = [
  profile("fixedwing_survey_uav", "visual_recon"),
  profile("micro_scout_uav", "visual_recon"),
  profile("overwatch_uav", "overwatch"),
  profile("relay_uav", "relay"),
  profile("scout_rover", "reserve"),
  profile("sensor_rover", "overwatch"),
]

function copSvg(): SVGSVGElement {
  const svg = screen.getByTestId("map-view").querySelector(".cop-map")
  if (svg instanceof SVGSVGElement) {
    return svg
  }
  throw new TypeError("COP SVG not found")
}

function makeMapDashboard() {
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
