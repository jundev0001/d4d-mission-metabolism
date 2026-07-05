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
import { DEFAULT_CUSTOM_SCENARIO } from "./defaultCustomScenario"
import { hasPendingRecommendations } from "./demoFlowRunner"
import {
  advanceCustomScenarioAction,
  type CustomScenarioRun,
  type InitialDeploymentApproval,
  runCustomScenarioAction,
  runScriptedDemoAction,
} from "./demoStoreActions"
import { connectLiveDashboard } from "./liveDashboard"
import type {
  BlackBoxEntry,
  DashboardState,
  DecisionPayload,
  EventPayload,
  VehicleTunePayload,
} from "./types"
import type { FleetDeploymentPayload, VehicleTypeProfile } from "./vehicleDeployment"

type MissionStore = {
  readonly dashboard: DashboardState | null
  readonly replay: readonly BlackBoxEntry[]
  readonly vehicleTypeProfiles: readonly VehicleTypeProfile[]
  readonly initialDeploymentApproval: InitialDeploymentApproval
  readonly isLoading: boolean
  readonly isRunningDemo: boolean
  readonly selectedReplayIndex: number
  readonly lastError: string | null
  readonly customScenario: CustomScenarioDocument
  readonly customScenarioRun: CustomScenarioRun | null
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
  readonly approveInitialDeployment: () => Promise<void>
  readonly advanceCustomScenario: () => Promise<void>
  readonly setCustomScenario: (customScenario: CustomScenarioDocument) => void
  readonly selectReplayIndex: (index: number) => void
  readonly connectLive: () => () => void
}

const UNKNOWN_ERROR = "Unknown dashboard error"

export const useMissionStore = create<MissionStore>()((set, get) => ({
  dashboard: null,
  replay: [],
  vehicleTypeProfiles: [],
  initialDeploymentApproval: "idle",
  isLoading: true,
  isRunningDemo: false,
  selectedReplayIndex: 0,
  lastError: null,
  customScenario: DEFAULT_CUSTOM_SCENARIO,
  customScenarioRun: null,

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
      set({
        dashboard,
        replay: replay.entries,
        selectedReplayIndex: 0,
        lastError: null,
        customScenarioRun: null,
        initialDeploymentApproval: "idle",
        isRunningDemo: false,
      })
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  deployFleet: async (items) => {
    try {
      const dashboard = await postFleetDeployment(items)
      const replay = await fetchReplay()
      set({
        dashboard,
        replay: replay.entries,
        selectedReplayIndex: 0,
        lastError: null,
        initialDeploymentApproval: "idle",
      })
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
      if (!hasPendingRecommendations(dashboard)) {
        await get().advanceCustomScenario()
      }
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : UNKNOWN_ERROR })
    }
  },

  runScriptedDemo: runScriptedDemoAction(get, set, UNKNOWN_ERROR),

  runCustomScenario: runCustomScenarioAction(get, set, UNKNOWN_ERROR),

  approveInitialDeployment: async () => {
    if (get().initialDeploymentApproval !== "pending") {
      return
    }
    try {
      const dashboard = await postAllocation()
      const replay = await fetchReplay()
      set({
        dashboard,
        replay: replay.entries,
        selectedReplayIndex: 0,
        initialDeploymentApproval: "approved",
        isRunningDemo: true,
        lastError: null,
      })
      await get().advanceCustomScenario()
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : UNKNOWN_ERROR,
        customScenarioRun: null,
        initialDeploymentApproval: "idle",
        isRunningDemo: false,
      })
    }
  },

  advanceCustomScenario: advanceCustomScenarioAction(get, set, UNKNOWN_ERROR),

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
