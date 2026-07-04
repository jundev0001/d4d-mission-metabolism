import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventControls } from "../src/components/EventControls"

const storeMock = vi.hoisted(() => ({
  dashboard: {
    mission: { areas: ["A", "B", "C"] },
    vehicles: [{ id: "UxV-01" }, { id: "UxV-02" }],
    assignments: [{ vehicle_id: "UxV-01" }],
  },
  injectEvent: vi.fn(),
  isRunningDemo: false,
}))

vi.mock("../src/store", () => ({
  useMissionStore: (
    selector: (state: {
      readonly dashboard: typeof storeMock.dashboard
      readonly injectEvent: typeof storeMock.injectEvent
      readonly isRunningDemo: boolean
    }) => unknown,
  ) =>
    selector({
      dashboard: storeMock.dashboard,
      injectEvent: storeMock.injectEvent,
      isRunningDemo: storeMock.isRunningDemo,
    }),
}))

describe("event controls", () => {
  beforeEach(() => {
    storeMock.injectEvent.mockClear()
    storeMock.dashboard.assignments = [{ vehicle_id: "UxV-01" }]
    storeMock.isRunningDemo = false
  })

  it("Given a selected area event When injected Then the selected event payload is emitted", () => {
    render(<EventControls />)

    fireEvent.change(screen.getByLabelText("이벤트"), { target: { value: "data_stale" } })
    fireEvent.change(screen.getByLabelText("대상"), { target: { value: "C" } })
    fireEvent.click(screen.getByRole("button", { name: /주입/ }))

    expect(storeMock.injectEvent).toHaveBeenCalledWith({
      event_type: "data_stale",
      target: "C",
      severity: 0.72,
    })
  })

  it("Given initial formation is not approved When rendering controls Then event injection is locked", () => {
    storeMock.dashboard.assignments = []

    render(<EventControls />)

    expect(screen.getByRole("button", { name: /주입/ })).toBeDisabled()
    expect(screen.getByText("편성 승인 후 이벤트 주입 가능")).toBeInTheDocument()
  })
})
