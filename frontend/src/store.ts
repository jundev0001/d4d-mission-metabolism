import { create } from "zustand"
import {
  fetchDashboardState,
  fetchReplay,
  injectEvent as postEvent,
  resetMission,
  sendDecision,
  websocketUrl,
} from "./api"
import { type CustomScenarioDocument, orderedCustomEvents } from "./customScenario"
import { DEFAULT_CUSTOM_SCENARIO } from "./defaultCustomScenario"
import type { BlackBoxEntry } from "./types"
import {
  type DashboardState,
  DashboardStateSchema,
  type DecisionPayload,
  type EventPayload,
} from "./types"

const SCRIPTED_EVENTS: readonly EventPayload[] = [
  { event_type: "comm_jam", target: "B", severity: 0.82 },
  { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
  { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
  { event_type: "no_go", target: "B", severity: 0.68 },
] as const

type MissionStore = {
  readonly dashboard: DashboardState | null
  readonly replay: readonly BlackBoxEntry[]
  readonly isLoading: boolean
  readonly isRunningDemo: boolean
  readonly selectedReplayIndex: number
  readonly lastError: string | null
  readonly customScenario: CustomScenarioDocument
  readonly hydrate: () => Promise<void>
  readonly acceptSnapshot: (dashboard: DashboardState) => void
  readonly reset: () => Promise<void>
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
  isLoading: true,
  isRunningDemo: false,
  selectedReplayIndex: 0,
  lastError: null,
  customScenario: DEFAULT_CUSTOM_SCENARIO,

  hydrate: async () => {
    try {
      const dashboard = await fetchDashboardState()
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, isLoading: false, lastError: null })
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

  injectEvent: async (event) => {
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
    set({ isRunningDemo: true, lastError: null })
    try {
      await get().reset()
      await orderedCustomEvents(get().customScenario).reduce(
        (sequence, event) => sequence.then(() => injectDemoEvent(event, get)),
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
    const socket = new WebSocket(websocketUrl())
    socket.addEventListener("message", (event) => {
      const parsed = DashboardStateSchema.safeParse(JSON.parse(event.data))
      if (parsed.success) {
        set({ dashboard: parsed.data })
      }
    })
    return () => {
      socket.close()
    }
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
