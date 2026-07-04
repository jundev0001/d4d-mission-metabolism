import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RecommendationCardView, RecommendationPanel } from "../src/components/RecommendationPanel"
import { useMissionStore } from "../src/store"
import { makeDashboardState, makeRecommendationCard } from "./fixtures"

describe("recommendation card", () => {
  it("Given a pending card When approving Then the approve decision is emitted", () => {
    const onDecision = vi.fn()

    render(<RecommendationCardView card={makeRecommendationCard()} onDecision={onDecision} />)
    screen.getByRole("button", { name: "승인" }).click()

    expect(onDecision).toHaveBeenCalledWith("approve")
  })

  it("Given a pending card When choosing manual Then a safe replacement action is emitted", () => {
    const onDecision = vi.fn()

    render(<RecommendationCardView card={makeRecommendationCard()} onDecision={onDecision} />)
    fireEvent.click(screen.getByRole("button", { name: "수동" }))

    expect(onDecision).toHaveBeenCalledWith("manual", "replace", "UxV-04")
  })

  it("Given one handled card When rendering the queue Then only the next pending card remains actionable", () => {
    const handledCard = {
      ...makeRecommendationCard(),
      id: "rec-000",
      title: "UxV-02 below return threshold",
      status: "approved",
    } as const
    const pendingCard = {
      ...makeRecommendationCard(),
      id: "rec-002",
      title: "B area mission instability",
      status: "pending",
    } as const
    useMissionStore.setState({
      dashboard: {
        ...makeDashboardState(),
        recommendations: [handledCard, pendingCard],
      },
      replay: [],
      lastError: null,
    })

    render(<RecommendationPanel />)

    const queue = screen.getByTestId("recommendation-queue")
    expect(queue).toHaveTextContent("B구역 임무 불안정")
    expect(queue).not.toHaveTextContent("UxV-02 복귀 기준 미달")
    expect(screen.getByText("대기 1 / 전체 2")).toBeInTheDocument()
    expect(screen.getByTestId("decision-history")).toHaveTextContent("UxV-02 복귀 기준 미달")
    expect(screen.getByTestId("decision-history")).toHaveTextContent("승인됨")
  })

  it("Given mixed severity cards When rendering the queue Then critical cards appear first and equal severity keeps creation order", () => {
    const highCard = {
      ...makeRecommendationCard(),
      id: "rec-001",
      severity: "high",
      title: "B area mission instability",
      status: "pending",
    } as const
    const firstCriticalCard = {
      ...makeRecommendationCard(),
      id: "rec-002",
      severity: "critical",
      title: "UxV-03 link degraded",
      status: "pending",
    } as const
    const secondCriticalCard = {
      ...makeRecommendationCard(),
      id: "rec-003",
      severity: "critical",
      title: "UxV-02 below return threshold",
      status: "pending",
    } as const
    useMissionStore.setState({
      dashboard: {
        ...makeDashboardState(),
        recommendations: [highCard, firstCriticalCard, secondCriticalCard],
      },
      replay: [],
      lastError: null,
    })

    render(<RecommendationPanel />)

    const titles = screen
      .getAllByTestId("recommendation-card")
      .map((card) => within(card).getByRole("heading", { level: 3 }).textContent)
    expect(titles).toEqual(["UxV-03 링크 저하", "UxV-02 복귀 기준 미달", "B구역 임무 불안정"])
  })

  it("Given manual and rejected cards When rendering the queue Then both stay in the decision history", () => {
    const manualCard = {
      ...makeRecommendationCard(),
      id: "rec-003",
      title: "UxV-03 link degraded",
      status: "manual",
    } as const
    const rejectedCard = {
      ...makeRecommendationCard(),
      id: "rec-004",
      title: "B area mission instability",
      status: "rejected",
    } as const
    useMissionStore.setState({
      dashboard: {
        ...makeDashboardState(),
        recommendations: [manualCard, rejectedCard],
      },
      replay: [],
      lastError: null,
    })

    render(<RecommendationPanel />)

    expect(screen.getByTestId("recommendation-queue")).toHaveTextContent("사람 승인 대기 없음")
    expect(screen.getByTestId("decision-history")).toHaveTextContent("UxV-03 링크 저하")
    expect(screen.getByTestId("decision-history")).toHaveTextContent("수동")
    expect(screen.getByTestId("decision-history")).toHaveTextContent("B구역 임무 불안정")
    expect(screen.getByTestId("decision-history")).toHaveTextContent("거절됨")
  })
})
