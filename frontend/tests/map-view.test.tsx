import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MapView } from "../src/components/MapView"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"
import { useMissionStore } from "../src/store"
import { makeDashboardState } from "./fixtures"
import { makeMapDashboard, mapVehicleTypeProfiles } from "./map-fixtures"

const apiMocks = vi.hoisted(() => ({
  deployFleet: vi.fn(),
  fetchReplay: vi.fn(),
}))

vi.mock("../src/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/api")>()),
  deployFleet: apiMocks.deployFleet,
  fetchReplay: apiMocks.fetchReplay,
}))

describe("map view", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    apiMocks.fetchReplay.mockResolvedValue({ entries: [] })
    apiMocks.deployFleet.mockResolvedValue(makeMapDashboard())
    useMissionStore.setState({
      customScenario: DEFAULT_CUSTOM_SCENARIO,
      dashboard: makeDashboardState(),
      isRunningDemo: false,
      lastError: null,
      replay: [],
      selectedReplayIndex: 0,
      vehicleTypeProfiles: mapVehicleTypeProfiles,
    })
  })

  it("Given a UxV on the COP When the map renders Then hover details are available on the asset glyph", () => {
    render(<MapView />)

    const map = screen.getByTestId("map-view")
    const assetGlyph = assetGlyphFor(map, "UxV-04")
    fireEvent.mouseEnter(assetGlyph)

    const svg = map.querySelector(".cop-map")
    const infoLayer = svg?.querySelector(".asset-info-layer")
    const visibleInfo = infoLayer?.querySelector(".asset-info.visible")

    expect(assetGlyph).toBeInTheDocument()
    expect(infoLayer).toBeInTheDocument()
    expect(svg?.lastElementChild).toBe(infoLayer)
    expect(svg?.querySelector(".map-metric")).toBeNull()
    expect(screen.getAllByText(/^Area B/).length).toBeGreaterThan(0)
    expect(visibleInfo).toHaveTextContent("UxV-04")
    expect(visibleInfo).toHaveTextContent("80%")
    expect(visibleInfo).toHaveTextContent("90%")
  })

  it("Given the COP is visible When the operator wheels and drags Then the map moves without scaling asset overlays", () => {
    useMissionStore.setState({ dashboard: makeMapDashboard() })
    render(<MapView />)
    const svg = copSvg()
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 860, width: 1000, x: 0, y: 0 }),
    )
    const assetGlyph = assetGlyphFor(screen.getByTestId("map-view"), "UxV-04")

    fireEvent.wheel(svg, { clientX: 500, clientY: 430, deltaY: -120 })
    const zoomedViewBox = svg.getAttribute("viewBox")
    fireEvent.pointerDown(svg, { button: 0, clientX: 500, clientY: 430, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 560, clientY: 480, pointerId: 1 })

    expect(zoomedViewBox).not.toBe("0 0 100 86")
    expect(svg.getAttribute("viewBox")).not.toBe(zoomedViewBox)
    expect(assetGlyph.getAttribute("transform")).toMatch(/^translate\(.+\) scale\(0\.86\)$/)
  })

  it("Given the COP is visible When the operator wheels over it Then the page scroll default is blocked", () => {
    const addEventListener = vi.spyOn(SVGSVGElement.prototype, "addEventListener")
    render(<MapView />)
    const svg = copSvg()
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 860, width: 1000, x: 0, y: 0 }),
    )

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 500,
      clientY: 430,
      deltaY: -120,
    })
    const dispatched = svg.dispatchEvent(wheelEvent)

    expect(addEventListener).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false })
    expect(dispatched).toBe(false)
    expect(wheelEvent.defaultPrevented).toBe(true)
  })

  it("Given mixed vehicle types When the COP renders Then each asset uses its vehicle icon image", () => {
    useMissionStore.setState({ dashboard: makeMapDashboard() })
    render(<MapView />)

    expect(assetIconHref("UxV-01")).toContain("fixedwing_survey_uav")
    expect(assetIconHref("UxV-02")).toContain("micro_scout_uav")
    expect(assetIconHref("UxV-03")).toContain("overwatch_uav")
    expect(assetIconHref("UxV-04")).toContain("relay_uav")
    expect(assetIconHref("UxV-05")).toContain("sensor_rover")
    expect(assetIconHref("UxV-06")).toContain("scout_rover")
  })

  it("Given area missions and an approved recommendation When the COP renders Then mission labels and action paths explain the decision", () => {
    const dashboard = makeMapDashboard()
    useMissionStore.setState({
      dashboard: {
        ...dashboard,
        recommendations: [
          {
            ...dashboard.recommendations[0],
            actions: [
              {
                action: "launch_reserve",
                area: "B",
                rationale: "replace relay capacity from reserve",
                vehicle_id: "UxV-06",
              },
            ],
            status: "approved",
          },
        ],
      },
    })

    render(<MapView />)

    expect(screen.getAllByText("Area B").length).toBeGreaterThan(0)
    expect(screen.getAllByText("중계 임무").length).toBeGreaterThan(0)
    expect(screen.getByTestId("action-path-UxV-06-B")).toBeInTheDocument()
    expect(screen.getByText("UxV-06 → Area B")).toBeInTheDocument()
  })

  it("Given area mission summaries When the COP readout renders Then long Korean text is preserved without an ellipsis-only chip", () => {
    render(<MapView />)

    const areaSummary = screen.getByTitle(/Area A 구역 정찰/)
    const missionLine = areaSummary.querySelector(".area-coverage-mission")
    const metricsLine = areaSummary.querySelector(".area-coverage-metrics")

    expect(areaSummary).toHaveTextContent("Area A")
    expect(missionLine).toHaveTextContent("구역 정찰")
    expect(metricsLine).toHaveTextContent(/우선순위/)
    expect(metricsLine).toHaveTextContent(/최저/)
    expect(areaSummary.getAttribute("title")).toContain("Area A 구역 정찰")
  })

  it("Given deployed UxVs When an asset is removed from the COP menu Then fleet deployment is updated", async () => {
    useMissionStore.setState({ dashboard: makeMapDashboard() })
    render(<MapView />)

    fireEvent.contextMenu(assetGlyphFor(screen.getByTestId("map-view"), "UxV-04"), {
      clientX: 500,
      clientY: 300,
    })
    fireEvent.click(removeAssetButton("UxV-04"))

    await waitFor(() => {
      expect(apiMocks.deployFleet).toHaveBeenCalledWith([
        { vehicle_type: "fixedwing_survey_uav", count: 1 },
        { vehicle_type: "micro_scout_uav", count: 1 },
        { vehicle_type: "overwatch_uav", count: 1 },
        { vehicle_type: "scout_rover", count: 1 },
        { vehicle_type: "sensor_rover", count: 1 },
      ])
    })
  })
})

function assetGlyphFor(container: HTMLElement, vehicleId: string): Element {
  const glyph = container.querySelector(`[data-asset-id="${vehicleId}"]`)
  if (glyph !== null) {
    return glyph
  }
  throw new TypeError(`${vehicleId} asset glyph not found`)
}

function removeAssetButton(vehicleId: string): HTMLElement {
  const button = screen
    .getAllByRole("button", { name: new RegExp(vehicleId) })
    .find((candidate) => candidate.classList.contains("danger"))
  if (button !== undefined) {
    return button
  }
  throw new TypeError(`${vehicleId} remove button not found`)
}

function copSvg(): SVGSVGElement {
  const svg = screen.getByTestId("map-view").querySelector(".cop-map")
  if (svg instanceof SVGSVGElement) {
    return svg
  }
  throw new TypeError("COP SVG not found")
}

function assetIconHref(vehicleId: string): string {
  const icon = screen
    .getByLabelText(`${vehicleId} 자산 정보`)
    .querySelector("[data-testid='asset-type-icon']")
  if (icon instanceof Element) {
    return icon.getAttribute("href") ?? ""
  }
  throw new TypeError(`${vehicleId} icon not found`)
}
