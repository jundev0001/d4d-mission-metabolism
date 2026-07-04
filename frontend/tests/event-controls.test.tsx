import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventControls } from "../src/components/EventControls"

const storeMock = vi.hoisted(() => ({
  dashboard: {
    mission: { areas: ["A", "B", "C"] },
    vehicles: [{ id: "UxV-01" }, { id: "UxV-02" }],
  },
  injectEvent: vi.fn(),
}))

vi.mock("../src/store", () => ({
  useMissionStore: (
    selector: (state: {
      readonly dashboard: typeof storeMock.dashboard
      readonly injectEvent: typeof storeMock.injectEvent
    }) => unknown,
  ) => selector({ dashboard: storeMock.dashboard, injectEvent: storeMock.injectEvent }),
}))

describe("event controls", () => {
  beforeEach(() => {
    storeMock.injectEvent.mockClear()
  })

  it("Given a selected area event When injected Then the selected event payload is emitted", () => {
    render(<EventControls />)

    fireEvent.change(screen.getByLabelText("Event"), { target: { value: "data_stale" } })
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "C" } })
    fireEvent.click(screen.getByRole("button", { name: /Inject/ }))

    expect(storeMock.injectEvent).toHaveBeenCalledWith({
      event_type: "data_stale",
      target: "C",
      severity: 0.72,
    })
  })
})
