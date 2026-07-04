import { beforeEach, describe, expect, it, vi } from "vitest"
import { withScenarioName } from "../src/customScenarioMutations"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"
import { useMissionStore } from "../src/store"
import { makeDashboardState } from "./fixtures"

type MessageHandler = (event: { readonly data: string }) => void
type SocketEventType = "open" | "message" | "error" | "close"
type SocketHandler = MessageHandler | (() => void)

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  readonly url: string
  closed = false
  private readonly handlers: Record<SocketEventType, SocketHandler[]> = {
    close: [],
    error: [],
    message: [],
    open: [],
  }

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: SocketEventType, handler: SocketHandler): void {
    this.handlers[type].push(handler)
  }

  close(): void {
    this.closed = true
  }

  sendMessage(data: string): void {
    for (const handler of this.handlers.message) {
      ;(handler as MessageHandler)({ data })
    }
  }

  emit(type: Exclude<SocketEventType, "message">): void {
    for (const handler of this.handlers[type]) {
      ;(handler as () => void)()
    }
  }
}

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
    FakeWebSocket.instances = []
    vi.stubGlobal("WebSocket", FakeWebSocket)
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
      customScenario: DEFAULT_CUSTOM_SCENARIO,
      customScenarioRun: null,
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

  it("Given mission intent settings When configuring a custom mission Then governance fields are sent", async () => {
    const dashboard = makeDashboardState()
    apiMocks.configureMission.mockResolvedValue(dashboard)

    await useMissionStore.getState().configureCustomMission()

    expect(apiMocks.configureMission).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: "Custom event flow",
        mission_type: "area_recon",
        constraints: {
          return_battery_threshold: 0.2,
          min_relay_redundancy: 1,
          human_approval_for_replan: true,
          target_mcc: 0.8,
        },
        autonomy_level: 0.62,
      }),
    )
  })

  it("Given no approved allocation When injecting an event Then the store blocks the event", async () => {
    const dashboard = { ...makeDashboardState(), assignments: [] }
    useMissionStore.setState({ dashboard })

    await useMissionStore.getState().injectEvent({
      event_type: "comm_jam",
      target: "B",
      severity: 0.82,
    })

    expect(apiMocks.injectEvent).not.toHaveBeenCalled()
    expect(useMissionStore.getState().dashboard).toBe(dashboard)
    expect(useMissionStore.getState().lastError).toBe("편성 승인 후 이벤트 주입이 가능합니다.")
  })

  it("Given a scripted demo When it starts Then allocation is approved before events", async () => {
    vi.useFakeTimers()
    const resetDashboard = { ...makeDashboardState(), assignments: [] }
    const allocatedDashboard = makeDashboardState()
    apiMocks.resetMission.mockResolvedValue(resetDashboard)
    apiMocks.allocateMission.mockResolvedValue(allocatedDashboard)
    apiMocks.injectEvent.mockResolvedValue(allocatedDashboard)

    const run = useMissionStore.getState().runScriptedDemo()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2200)
    await run

    expect(apiMocks.resetMission).toHaveBeenCalledWith(42)
    expect(apiMocks.allocateMission).toHaveBeenCalledTimes(1)
    expect(apiMocks.injectEvent).toHaveBeenCalledTimes(4)
    expect(apiMocks.resetMission.mock.invocationCallOrder[0]).toBeLessThan(
      apiMocks.allocateMission.mock.invocationCallOrder[0] ?? 0,
    )
    expect(apiMocks.allocateMission.mock.invocationCallOrder[0]).toBeLessThan(
      apiMocks.injectEvent.mock.invocationCallOrder[0] ?? 0,
    )
    vi.useRealTimers()
  })

  it("Given a custom scenario run When scenario edits happen during reset Then the original scenario drives the run", async () => {
    vi.useFakeTimers()
    const originalScenario = withScenarioName(DEFAULT_CUSTOM_SCENARIO, "Original custom flow")
    const lateEditScenario = withScenarioName(DEFAULT_CUSTOM_SCENARIO, "Late edit flow")
    const resetDashboard = { ...makeDashboardState(), assignments: [] }
    const configuredDashboard = makeDashboardState()
    const allocatedDashboard = makeDashboardState()
    apiMocks.resetMission.mockImplementation(() => {
      useMissionStore.getState().setCustomScenario(lateEditScenario)
      return Promise.resolve(resetDashboard)
    })
    apiMocks.configureMission.mockResolvedValue(configuredDashboard)
    apiMocks.allocateMission.mockResolvedValue(allocatedDashboard)
    apiMocks.injectEvent.mockResolvedValue(allocatedDashboard)
    useMissionStore.setState({ customScenario: originalScenario })

    const run = useMissionStore.getState().runCustomScenario()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2200)
    await run

    expect(apiMocks.configureMission).toHaveBeenCalledWith(
      expect.objectContaining({ objective: "Original custom flow" }),
    )
    expect(apiMocks.injectEvent).toHaveBeenCalledWith({
      event_type: "comm_jam",
      target: "B",
      severity: 0.82,
    })
    vi.useRealTimers()
  })

  it("Given live websocket state When a valid snapshot arrives Then the dashboard updates and closes cleanly", () => {
    const dashboard = makeDashboardState()

    const cleanup = useMissionStore.getState().connectLive()

    const socket = FakeWebSocket.instances.at(0)
    expect(socket?.url).toBe("ws://127.0.0.1:8000/ws/state")
    socket?.sendMessage("{")
    expect(useMissionStore.getState().dashboard).toBeNull()
    socket?.sendMessage(JSON.stringify(dashboard))

    expect(useMissionStore.getState().dashboard?.mission.id).toBe("mission-seoul-isr")
    cleanup()
    expect(socket?.closed).toBe(true)
  })

  it("Given a custom scenario run When stale live state arrives Then scenario-owned judgment state is preserved", () => {
    const scenarioDashboard = {
      ...makeDashboardState(),
      mission: {
        ...makeDashboardState().mission,
        objective: "Custom event flow",
      },
    }
    const staleDashboard = makeDashboardState()
    useMissionStore.setState({ dashboard: scenarioDashboard, isRunningDemo: true })

    const cleanup = useMissionStore.getState().connectLive()
    const socket = FakeWebSocket.instances.at(0)
    socket?.sendMessage(JSON.stringify(staleDashboard))

    expect(useMissionStore.getState().dashboard?.mission.objective).toBe("Custom event flow")
    cleanup()
  })

  it("Given live websocket failure When the stream errors Then REST polling keeps state fresh", async () => {
    vi.useFakeTimers()
    const dashboard = makeDashboardState()
    apiMocks.fetchDashboardState.mockResolvedValue(dashboard)

    const cleanup = useMissionStore.getState().connectLive()
    const socket = FakeWebSocket.instances.at(0)
    socket?.emit("error")
    await vi.runOnlyPendingTimersAsync()

    expect(apiMocks.fetchDashboardState).toHaveBeenCalled()
    expect(useMissionStore.getState().dashboard?.mission.id).toBe("mission-seoul-isr")
    expect(useMissionStore.getState().lastError).toBeNull()
    cleanup()
    vi.useRealTimers()
  })
})
