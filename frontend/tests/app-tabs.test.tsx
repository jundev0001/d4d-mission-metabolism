import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { App } from "../src/App"

const storeMock = vi.hoisted(() => ({
  connectLive: vi.fn(() => vi.fn()),
  hydrate: vi.fn(),
}))

vi.mock("../src/store", () => ({
  useMissionStore: (
    selector: (state: {
      readonly hydrate: typeof storeMock.hydrate
      readonly connectLive: typeof storeMock.connectLive
      readonly isLoading: boolean
      readonly lastError: string | null
      readonly dashboard: {
        readonly assignments: readonly unknown[]
        readonly vehicles: readonly { readonly synthetic: boolean }[]
      }
      readonly customScenario: {
        readonly map: { readonly areas: readonly unknown[] }
        readonly scenario: {
          readonly edges: readonly unknown[]
          readonly nodes: readonly unknown[]
        }
      }
    }) => unknown,
  ) =>
    selector({
      connectLive: storeMock.connectLive,
      customScenario: {
        map: { areas: [] },
        scenario: { edges: [], nodes: [] },
      },
      dashboard: {
        assignments: [],
        vehicles: [],
      },
      hydrate: storeMock.hydrate,
      isLoading: false,
      lastError: null,
    }),
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

vi.mock("../src/components/FleetDeploymentPanel", () => ({
  FleetDeploymentPanel: () => <section>배치 패널</section>,
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
  ScenarioBuilderPanel: ({ mode }: { readonly mode: "map" | "events" }) => (
    <section>{mode === "map" ? "구역 지도 편집 패널" : "이벤트 플로우 패널"}</section>
  ),
}))

describe("workspace tabs", () => {
  it("Given the dashboard When viewing mission judgment Then only operational decision surfaces remain", () => {
    render(<App />)

    expect(screen.getByRole("region", { name: "임무 판단 작업면" })).toBeInTheDocument()
    expect(screen.getByText("지도 패널")).toBeInTheDocument()
    expect(screen.getByText("권고 패널")).toBeInTheDocument()
    expect(screen.getByText("평가 패널")).toBeInTheDocument()
    expect(screen.getByText("능력 패널")).toBeInTheDocument()

    expect(screen.queryByText("이벤트 컨트롤")).not.toBeInTheDocument()
    expect(screen.queryByText("배치 패널")).not.toBeInTheDocument()
    expect(screen.queryByText("블랙박스 패널")).not.toBeInTheDocument()
    expect(screen.queryByText("커스텀 빌더 패널")).not.toBeInTheDocument()
  })

  it("Given the dashboard When selecting scenario Then the design workflow is staged from fleet to map to events", () => {
    render(<App />)

    expect(screen.queryByRole("button", { name: "계산 로그" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "커스텀 빌더" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "시나리오" }))

    expect(screen.getByRole("region", { name: "시나리오 작업면" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "시나리오 설계 단계" })).toHaveClass(
      "scenario-stepper-strip",
    )
    expect(screen.getByText("통합 시나리오 설계")).toHaveClass("scenario-stepper-heading")
    expect(screen.getByRole("button", { name: /1 최초 UxV 선정/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /2 구역\(지도\) 커스텀/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /3 이벤트 플로우차트/ })).toBeInTheDocument()
    expect(screen.getByText("배치 패널")).toBeInTheDocument()
    expect(screen.getByText("블랙박스 패널")).toBeInTheDocument()
    expect(screen.queryByText("구역 지도 편집 패널")).not.toBeInTheDocument()
    expect(screen.queryByText("이벤트 플로우 패널")).not.toBeInTheDocument()
    expect(screen.queryByText("이벤트 컨트롤")).not.toBeInTheDocument()
    expect(screen.queryByText("지도 패널")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /2 구역\(지도\) 커스텀/ }))
    expect(screen.getByText("구역 지도 편집 패널")).toBeInTheDocument()
    expect(screen.queryByText("배치 패널")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /3 이벤트 플로우차트/ }))
    expect(screen.getByText("이벤트 플로우 패널")).toBeInTheDocument()
    expect(screen.getByText("이벤트 컨트롤")).toBeInTheDocument()
  })
})
