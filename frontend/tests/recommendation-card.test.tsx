import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RecommendationCardView } from "../src/components/RecommendationPanel"
import { makeRecommendationCard } from "./fixtures"

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
})
