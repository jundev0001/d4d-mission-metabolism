import { create } from "zustand"
import {
  fetchDashboardState,
  fetchReplay,
  injectEvent as postEvent,
  resetMission,
  sendDecision,
  websocketUrl,
} from "./api"
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
  readonly hydrate: () => Promise<void>
  readonly acceptSnapshot: (dashboard: DashboardState) => void
  readonly reset: () => Promise<void>
  readonly injectEvent: (event: EventPayload) => Promise<void>
  readonly decide: (decision: DecisionPayload) => Promise<void>
  readonly runScriptedDemo: () => Promise<void>
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

  hydrate: async () => {
    try {
      const dashboard = await fetchDashboardState()
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, isLoading: false, lastError: null })
    } catch (error) {
      set({ isLoading: false, lastError: errorMessage(error) })
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
      set({ lastError: errorMessage(error) })
    }
  },

  injectEvent: async (event) => {
    try {
      const dashboard = await postEvent(event)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, lastError: null })
    } catch (error) {
      set({ lastError: errorMessage(error) })
    }
  },

  decide: async (decision) => {
    try {
      const dashboard = await sendDecision(decision)
      const replay = await fetchReplay()
      set({ dashboard, replay: replay.entries, lastError: null })
    } catch (error) {
      set({ lastError: errorMessage(error) })
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
      set({ lastError: errorMessage(error) })
    } finally {
      set({ isRunningDemo: false })
    }
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return "Unknown dashboard error"
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function injectDemoEvent(event: EventPayload, getStore: () => MissionStore): Promise<void> {
  return delay(500).then(() => getStore().injectEvent(event))
}
