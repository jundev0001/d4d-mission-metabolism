import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventControls } from "../src/components/EventControls"

const storeMock = vi.hoisted(() => ({
  injectEvent: vi.fn(),
}))

vi.mock("../src/store", () => ({
  useMissionStore: (
    selector: (state: { readonly injectEvent: typeof storeMock.injectEvent }) => unknown,
  ) => selector({ injectEvent: storeMock.injectEvent }),
}))

describe("event controls", () => {
  beforeEach(() => {
    storeMock.injectEvent.mockClear()
  })

  it("Given a scenario event button When clicked Then only the API event payload is emitted", () => {
    render(<EventControls />)

    fireEvent.click(screen.getByRole("button", { name: /통신 재밍/ }))

    expect(storeMock.injectEvent).toHaveBeenCalledWith({
      event_type: "comm_jam",
      target: "B",
      severity: 0.82,
    })
  })
})
