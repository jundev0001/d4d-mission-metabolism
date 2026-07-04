import { beforeEach, describe, expect, it } from "vitest"
import { useMissionStore } from "../src/store"
import { makeDashboardState } from "./fixtures"

describe("mission store", () => {
  beforeEach(() => {
    useMissionStore.setState({
      dashboard: null,
      replay: [],
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
})
