import type { CustomScenarioDocument } from "./customScenario"
import { customScenarioEventBatches } from "./customScenarioGraph"
import type { DashboardState, EventPayload } from "./types"

const DEMO_EVENT_DELAY_MS = 500

export type CustomScenarioRun = {
  readonly batches: readonly (readonly EventPayload[])[]
  readonly nextBatchIndex: number
}

export function createCustomScenarioRun(document: CustomScenarioDocument): CustomScenarioRun {
  return {
    batches: customScenarioEventBatches(document),
    nextBatchIndex: 0,
  }
}

export function advanceRunCursor(run: CustomScenarioRun): CustomScenarioRun {
  return {
    ...run,
    nextBatchIndex: run.nextBatchIndex + 1,
  }
}

export function hasPendingRecommendations(dashboard: DashboardState | null): boolean {
  return dashboard?.recommendations.some((card) => card.status === "pending") ?? false
}

export function injectDemoEvent(
  event: EventPayload,
  injectEvent: (event: EventPayload) => Promise<void>,
): Promise<void> {
  return delayDemoEvent().then(() => injectEvent(event))
}

export async function injectDemoEventBatch(
  events: readonly EventPayload[],
  injectEvent: (event: EventPayload) => Promise<void>,
): Promise<void> {
  await delayDemoEvent()
  for (const event of events) {
    await injectEvent(event)
  }
}

function delayDemoEvent(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, DEMO_EVENT_DELAY_MS)
  })
}
