import type { CustomScenarioDocument } from "./customScenario"
import {
  advanceRunCursor,
  type CustomScenarioRun,
  createCustomScenarioRun,
  hasPendingRecommendations,
  injectDemoEvent,
  injectDemoEventBatch,
} from "./demoFlowRunner"
import type { DashboardState, EventPayload } from "./types"

const SCRIPTED_EVENTS: readonly EventPayload[] = [
  { event_type: "comm_jam", target: "B", severity: 0.82 },
  { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
  { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
  { event_type: "no_go", target: "B", severity: 0.68 },
] as const

type DemoStore = {
  readonly dashboard: DashboardState | null
  readonly isRunningDemo: boolean
  readonly customScenario: CustomScenarioDocument
  readonly customScenarioRun: CustomScenarioRun | null
  readonly reset: () => Promise<void>
  readonly configureCustomMission: (customScenario?: CustomScenarioDocument) => Promise<void>
  readonly allocateMission: () => Promise<void>
  readonly injectEvent: (event: EventPayload) => Promise<void>
  readonly advanceCustomScenario: () => Promise<void>
}

type DemoPatch = Partial<
  Pick<DemoStore, "customScenarioRun" | "isRunningDemo"> & { readonly lastError: string | null }
>
type DemoGet = () => DemoStore
type DemoSet = (patch: DemoPatch) => void

export type { CustomScenarioRun }

export function runScriptedDemoAction(
  get: DemoGet,
  set: DemoSet,
  unknownError: string,
): () => Promise<void> {
  return async () => {
    if (get().isRunningDemo) {
      return
    }
    set({ isRunningDemo: true, lastError: null })
    try {
      await get().reset()
      await get().allocateMission()
      set({ isRunningDemo: true, lastError: null })
      await SCRIPTED_EVENTS.reduce(
        (sequence, event) => sequence.then(() => injectDemoEvent(event, get().injectEvent)),
        Promise.resolve(),
      )
    } catch (error) {
      set({ lastError: messageForError(error, unknownError) })
    } finally {
      set({ isRunningDemo: false })
    }
  }
}

export function runCustomScenarioAction(
  get: DemoGet,
  set: DemoSet,
  unknownError: string,
): () => Promise<void> {
  return async () => {
    if (get().isRunningDemo) {
      return
    }
    const customScenario = get().customScenario
    set({ isRunningDemo: true, lastError: null })
    try {
      await get().reset()
      await get().configureCustomMission(customScenario)
      await get().allocateMission()
      set({
        customScenarioRun: createCustomScenarioRun(customScenario),
        isRunningDemo: true,
        lastError: null,
      })
      await get().advanceCustomScenario()
    } catch (error) {
      set({
        lastError: messageForError(error, unknownError),
        customScenarioRun: null,
        isRunningDemo: false,
      })
    }
  }
}

export function advanceCustomScenarioAction(
  get: DemoGet,
  set: DemoSet,
  unknownError: string,
): () => Promise<void> {
  return async () => {
    const run = get().customScenarioRun
    if (run === null) {
      return
    }
    const events = run.batches.at(run.nextBatchIndex)
    if (events === undefined) {
      set({ customScenarioRun: null, isRunningDemo: false })
      return
    }
    set({ customScenarioRun: advanceRunCursor(run) })
    try {
      await injectDemoEventBatch(events, get().injectEvent)
      if (!hasPendingRecommendations(get().dashboard)) {
        await get().advanceCustomScenario()
      }
    } catch (error) {
      set({
        lastError: messageForError(error, unknownError),
        customScenarioRun: null,
        isRunningDemo: false,
      })
    }
  }
}

function messageForError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
