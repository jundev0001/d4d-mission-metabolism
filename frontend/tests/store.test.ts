import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMissionStore } from "../src/store"
import { makeDashboardState } from "./fixtures"

const apiMocks = vi.hoisted(() => ({
  allocateMission: vi.fn(),
  configureMission: vi.fn(),
  deployFleet: vi.fn(),
  fetchDashboardState: vi.fn(),
  fetchReplay: vi.fn(),
  fetchVehicleTypes: vi.fn(),
  injectEvent: vi.fn(),
  resetMission: vi.fn(),
  sendDecision: vi.fn(),
  websocketUrl: vi.fn(),
}))

vi.mock("../src/api", () => ({
  allocateMission: apiMocks.allocateMission,
  configureMission: apiMocks.configureMission,
  deployFleet: apiMocks.deployFleet,
  fetchDashboardState: apiMocks.fetchDashboardState,
  fetchReplay: apiMocks.fetchReplay,
  fetchVehicleTypes: apiMocks.fetchVehicleTypes,
  injectEvent: apiMocks.injectEvent,
  resetMission: apiMocks.resetMission,
  sendDecision: apiMocks.sendDecision,
  websocketUrl: apiMocks.websocketUrl,
}))

describe("mission store", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    apiMocks.fetchReplay.mockResolvedValue({ entries: [] })
    apiMocks.fetchVehicleTypes.mockResolvedValue({ profiles: [] })
    apiMocks.websocketUrl.mockReturnValue("ws://127.0.0.1:8000/ws/state")
    useMissionStore.setState({
      dashboard: null,
      replay: [],
      vehicleTypeProfiles: [],
      isLoading: false,
      isRunningDemo: false,
      selectedReplayIndex: 0,
      lastError: null,
    })
  })

  it("Given a parsed dashboard When accepting a snapshot Then the state updates without mutation", () => {
    const dashboard = makeDashboardState()

    useMissionStore.getState().acceptSnapshot(dashboard)

    const stored = useMissionStore.getState().dashboard
    expect(stored?.mission.id).toBe("mission-seoul-isr")
    expect(stored?.metrics.mcc).toBe(0.88)
    expect(dashboard.recommendations[0]?.status).toBe("pending")
  })

  it("Given replay entries When selecting replay index Then the selected point is stored", () => {
    useMissionStore.getState().selectReplayIndex(3)

    expect(useMissionStore.getState().selectedReplayIndex).toBe(3)
  })

  it("Given a deployment payload When deploying fleet Then dashboard and replay update", async () => {
    const dashboard = makeDashboardState()
    const items = [{ vehicle_type: "relay_uav", count: 3 }] as const
    apiMocks.deployFleet.mockResolvedValue(dashboard)

    await useMissionStore.getState().deployFleet(items)

    expect(apiMocks.deployFleet).toHaveBeenCalledWith(items)
    expect(useMissionStore.getState().dashboard?.vehicles[0]?.type).toBe("relay_uav")
    expect(useMissionStore.getState().lastError).toBeNull()
  })
})
