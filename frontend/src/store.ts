import { create } from "zustand"
import {
  fetchDashboardState,
  fetchReplay,
  fetchVehicleTypes,
  allocateMission as postAllocation,
  injectEvent as postEvent,
  deployFleet as postFleetDeployment,
  configureMission as postMissionConfiguration,
  tuneVehicle as postVehicleTune,
  resetMission,
  sendDecision,
  websocketUrl,
} from "./api"
import { missionPayloadFromCustomScenario } from "./customMissionPayload"
import type { CustomScenarioDocument } from "./customScenario"
import { customScenarioEventBatches } from "./customScenarioGraph"
import { DEFAULT_CUSTOM_SCENARIO } from "./defaultCustomScenario"
import { connectLiveDashboard } from "./liveDashboard"
import type {
  BlackBoxEntry,
  DashboardState,
  DecisionPayload,
  EventPayload,
  VehicleTunePayload,
} from "./types"
import type { FleetDeploymentPayload, VehicleTypeProfile } from "./vehicleDeployment"

const SCRIPTED_EVENTS: readonly EventPayload[] = [
  { event_type: "comm_jam", target: "B", severity: 0.82 },
  { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
  { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
  { event_type: "no_go", target: "B", severity: 0.68 },
] as const

type MissionStore = {
  readonly dashboard: DashboardState | null
  readonly replay: readonly BlackBoxEntry[]
  readonly vehicleTypeProfiles: readonly VehicleTypeProfile[]
  readonly isLoading: boolean
  readonly isRunningDemo: boolean
  readonly selectedReplayIndex: number
  readonly lastError: string | null
  readonly customScenario: CustomScenarioDocument
  readonly hydrate: () => Promise<void>
  readonly acceptSnapshot: (dashboard: DashboardState) => void
  readonly reset: () => Promise<void>
  readonly deployFleet: (items: FleetDeploymentPayload) => Promise<void>
  readonly tuneVehicle: (payload: VehicleTunePayload) => Promise<void>
  readonly configureCustomMission: (customScenario?: CustomScenarioDocument) => Promise<void>
  readonly allocateMission: () => Promise<void>
  readonly injectEvent: (event: EventPayload) => Promise<void>
  readonly decide: (decision: DecisionPayload) => Promise<void>
  readonly runScriptedDemo: () => Promise<void>
  readonly runCustomScenario: () => Promise<void>
  readonly setCustomScenario: (customScenario: CustomScenarioDocument) => void
  readonly selectReplayIndex: (index: number) => void
  readonly connectLive: () => () => void
}

export const useMissionStore = create<MissionStore>()((set, get) => ({
  dashboard: null,
  replay: [],
  vehicleTypeProfiles: [],
  isLoading: true,
  isRunningDemo: false,
  selectedReplayIndex: 0,
  lastError: null,
  customScenario: DEFAULT_CUSTOM_SCENARIO,

  hydrate: async () => {
    try {
      const [dashboard, replay, vehicleTypes] = await Promise.all([
        fetchDashboardState(),
        fetchReplay(),
        fetchVehicleTypes(),
      ])
      set({
        dashboard,
        replay: replay.entries,
        vehicleTypeProfiles: vehicleTypes.profiles,
        isLoading: false,
        lastError: null,
      })
    } catch (error) {
      set({ isLoading: false, lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  acceptSnapshot: (dashboard) => {
    set({ dashboard, lastError: null })
  },

  reset: async () => {
    try {
      const dashboard = await resetMission(42)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, selectedReplayIndex: 0, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  deployFleet: async (items) => {
    try {
      const dashboard = await postFleetDeployment(items)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, selectedReplayIndex: 0, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  tuneVehicle: async (payload) => {
    try {
      const dashboard = await postVehicleTune(payload)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  configureCustomMission: async (customScenario) => {
    try {
      const dashboard = await postMissionConfiguration(
        missionPayloadFromCustomScenario(customScenario ?? get().customScenario),
      )
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, selectedReplayIndex: 0, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  allocateMission: async () => {
    try {
      const dashboard = await postAllocation()
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, selectedReplayIndex: 0, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  injectEvent: async (event) => {
    if ((get().dashboard?.assignments.length ?? 0) === 0) {
      set({ lastError: "편성 승인 후 이벤트 주입이 가능합니다." })
      return
    }
    try {
      const dashboard = await postEvent(event)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  decide: async (decision) => {
    try {
      const dashboard = await sendDecision(decision)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, lastError: null })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  runScriptedDemo: async () => {
    if (get().isRunningDemo) {
      return
    }
    set({ isRunningDemo: true, lastError: null })
    try {
      await get().reset()
      await get().allocateMission()
      await SCRIPTED_EVENTS.reduce(
        (sequence, event) => sequence.then(() => injectDemoEvent(event, get)),
        Promise.resolve(),
      )
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    } finally {
      set({ isRunningDemo: false })
    }
  },

  runCustomScenario: async () => {
    if (get().isRunningDemo) {
      return
    }
    const customScenario = get().customScenario
    set({ isRunningDemo: true, lastError: null })
    try {
      await get().reset()
      await get().configureCustomMission(customScenario)
      await get().allocateMission()
      await customScenarioEventBatches(customScenario).reduce(
        (sequence, events) => sequence.then(() => injectDemoEventBatch(events, get)),
        Promise.resolve(),
      )
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    } finally {
      set({ isRunningDemo: false })
    }
  },

  setCustomScenario: (customScenario) => {
    set({ customScenario, lastError: null })
  },

  selectReplayIndex: (index) => {
    set({ selectedReplayIndex: index })
  },

  connectLive: () => {
    return connectLiveDashboard({
      fetchDashboardState,
      websocketUrl: websocketUrl(),
      onDashboard: (dashboard) => {
        if (get().isRunningDemo) {
          return
        }
        set({ dashboard, lastError: null })
      },
      onError: (message) => set({ lastError: message === "" ? null : message }),
    })
  },
}))

const UNKNOWN_ERROR = "Unknown dashboard error"

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function injectDemoEvent(event: EventPayload, getStore: () => MissionStore): Promise<void> {
  return delay(500).then(() => getStore().injectEvent(event))
}

async function injectDemoEventBatch(
  events: readonly EventPayload[],
  getStore: () => MissionStore,
): Promise<void> {
  await delay(500)
  for (const event of events) {
    await getStore().injectEvent(event)
  }
}
