import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { App } from "../src/App"

const storeMock = vi.hoisted(() => ({
  hydrate: vi.fn(),
}))

vi.mock("../src/store", () => ({
  useMissionStore: (
    selector: (state: {
      readonly hydrate: typeof storeMock.hydrate
      readonly isLoading: boolean
      readonly lastError: string | null
    }) => unknown,
  ) => selector({ hydrate: storeMock.hydrate, isLoading: false, lastError: null }),
}))

vi.mock("../src/components/Header", () => ({
  Header: () => <header>미션 헤더</header>,
}))

vi.mock("../src/components/MetricStrip", () => ({
  MetricStrip: () => <section>메트릭 스트립</section>,
}))

vi.mock("../src/components/EventControls", () => ({
  EventControls: () => <section>이벤트 컨트롤</section>,
}))

vi.mock("../src/components/CapabilityPanel", () => ({
  CapabilityPanel: () => <section>능력 패널</section>,
}))

vi.mock("../src/components/MapView", () => ({
  MapView: () => <section>지도 패널</section>,
}))

vi.mock("../src/components/EvaluationPanel", () => ({
  EvaluationPanel: () => <section>평가 패널</section>,
}))

vi.mock("../src/components/RecommendationPanel", () => ({
  RecommendationPanel: () => <section>권고 패널</section>,
}))

vi.mock("../src/components/BlackBoxPanel", () => ({
  BlackBoxPanel: () => <section>블랙박스 패널</section>,
}))

vi.mock("../src/components/ScenarioBuilderPanel", () => ({
  ScenarioBuilderPanel: () => <section>커스텀 빌더 패널</section>,
}))

describe("workspace tabs", () => {
  it("Given the dashboard When selecting the custom builder tab Then the custom workspace replaces the mission workspace", () => {
    render(<App />)

    expect(screen.getByRole("region", { name: "임무 판단 작업면" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "커스텀 빌더" }))

    expect(screen.getByRole("region", { name: "커스텀 시나리오 작업면" })).toBeInTheDocument()
    expect(screen.getByText("커스텀 빌더 패널")).toBeInTheDocument()
    expect(screen.queryByText("이벤트 컨트롤")).not.toBeInTheDocument()
  })
})
