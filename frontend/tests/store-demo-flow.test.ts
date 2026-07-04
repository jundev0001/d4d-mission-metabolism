import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CustomScenarioDocument } from "../src/customScenario"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"
import { useMissionStore } from "../src/store"
import { makeDashboardState, makeRecommendationCard } from "./fixtures"

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

describe("custom scenario demo flow gate", () => {
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
      customScenario: DEFAULT_CUSTOM_SCENARIO,
      customScenarioRun: null,
    })
  })

  it("Given a custom scenario run When the first judgment card is pending Then later events wait", async () => {
    vi.useFakeTimers()
    const pendingDashboard = makeDashboardState()
    apiMocks.resetMission.mockResolvedValue({
      ...makeDashboardState(),
      assignments: [],
      recommendations: [],
    })
    apiMocks.configureMission.mockResolvedValue({ ...makeDashboardState(), recommendations: [] })
    apiMocks.allocateMission.mockResolvedValue({ ...makeDashboardState(), recommendations: [] })
    apiMocks.injectEvent
      .mockResolvedValueOnce(pendingDashboard)
      .mockResolvedValueOnce(pendingDashboard)
    apiMocks.sendDecision.mockResolvedValue(approvedDashboard())
    useMissionStore.setState({ customScenario: makeTwoStepScenario() })

    const run = useMissionStore.getState().runCustomScenario()
    await vi.runOnlyPendingTimersAsync()
    await run

    expect(apiMocks.injectEvent).toHaveBeenCalledTimes(1)
    expect(useMissionStore.getState().isRunningDemo).toBe(true)

    const decision = useMissionStore.getState().decide({
      recommendation_id: "rec-001",
      action: "approve",
    })
    await vi.runOnlyPendingTimersAsync()
    await decision

    expect(apiMocks.sendDecision).toHaveBeenCalledWith({
      recommendation_id: "rec-001",
      action: "approve",
    })
    expect(apiMocks.injectEvent).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("Given parallel custom scenario nodes When the gate opens Then same-depth events fire together", async () => {
    vi.useFakeTimers()
    const pendingDashboard = makeDashboardState()
    apiMocks.resetMission.mockResolvedValue({
      ...makeDashboardState(),
      assignments: [],
      recommendations: [],
    })
    apiMocks.configureMission.mockResolvedValue({ ...makeDashboardState(), recommendations: [] })
    apiMocks.allocateMission.mockResolvedValue({ ...makeDashboardState(), recommendations: [] })
    apiMocks.injectEvent.mockResolvedValue(pendingDashboard)
    apiMocks.sendDecision.mockResolvedValue(approvedDashboard())
    useMissionStore.setState({ customScenario: makeParallelScenario() })

    const run = useMissionStore.getState().runCustomScenario()
    await vi.runOnlyPendingTimersAsync()
    await run

    expect(apiMocks.injectEvent).toHaveBeenCalledTimes(1)

    const decision = useMissionStore.getState().decide({
      recommendation_id: "rec-001",
      action: "approve",
    })
    await vi.runOnlyPendingTimersAsync()
    await decision

    expect(apiMocks.injectEvent).toHaveBeenCalledTimes(3)
    expect(apiMocks.injectEvent).toHaveBeenNthCalledWith(2, {
      event_type: "battery_drop",
      target: "UxV-02",
      severity: 0.9,
    })
    expect(apiMocks.injectEvent).toHaveBeenNthCalledWith(3, {
      event_type: "comm_degraded",
      target: "UxV-03",
      severity: 0.74,
    })
    vi.useRealTimers()
  })
})

function approvedDashboard() {
  return {
    ...makeDashboardState(),
    recommendations: [{ ...makeRecommendationCard(), status: "approved" }],
  }
}

function makeParallelScenario(): CustomScenarioDocument {
  return {
    ...DEFAULT_CUSTOM_SCENARIO,
    scenario: {
      name: "Parallel gate flow",
      entry_node_id: "entry",
      nodes: [
        node({ id: "entry", eventType: "comm_jam", target: "B", severity: 0.82, x: 12, y: 12 }),
        node({
          id: "left",
          eventType: "battery_drop",
          target: "UxV-02",
          severity: 0.9,
          x: 28,
          y: 28,
        }),
        node({
          id: "right",
          eventType: "comm_degraded",
          target: "UxV-03",
          severity: 0.74,
          x: 34,
          y: 28,
        }),
      ],
      edges: [
        { from: "entry", to: "left" },
        { from: "entry", to: "right" },
      ],
    },
  }
}

function makeTwoStepScenario(): CustomScenarioDocument {
  return {
    ...DEFAULT_CUSTOM_SCENARIO,
    scenario: {
      name: "Two step gate flow",
      entry_node_id: "entry",
      nodes: [
        node({ id: "entry", eventType: "comm_jam", target: "B", severity: 0.82, x: 12, y: 12 }),
        node({
          id: "next",
          eventType: "battery_drop",
          target: "UxV-02",
          severity: 0.9,
          x: 28,
          y: 28,
        }),
      ],
      edges: [{ from: "entry", to: "next" }],
    },
  }
}

type TestNode = {
  readonly id: string
  readonly eventType: CustomScenarioDocument["scenario"]["nodes"][number]["event"]["event_type"]
  readonly target: string
  readonly severity: number
  readonly x: number
  readonly y: number
}

function node(testNode: TestNode): CustomScenarioDocument["scenario"]["nodes"][number] {
  return {
    id: testNode.id,
    event: {
      event_type: testNode.eventType,
      target: testNode.target,
      severity: testNode.severity,
    },
    position: { x: testNode.x, y: testNode.y },
  }
}
