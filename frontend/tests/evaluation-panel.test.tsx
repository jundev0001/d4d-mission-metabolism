import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { EvaluationPanel } from "../src/components/EvaluationPanel"
import { useMissionStore } from "../src/store"
import { makeDashboardState } from "./fixtures"

describe("EvaluationPanel", () => {
  afterEach(() => {
    useMissionStore.setState({ dashboard: null })
  })

  it("Given paired dashboard metrics When rendering Then baseline values come from the backend contract", () => {
    const baseDashboard = makeDashboardState()
    const dashboard = {
      ...baseDashboard,
      assisted_operator_actions: 3,
      baseline_metrics: {
        ...baseDashboard.baseline_metrics,
        operator_actions: 12,
        replan_time_seconds: 39,
        collapse_probability: 0.61,
      },
      metrics: {
        ...baseDashboard.metrics,
        operator_actions: 3,
        replan_time_seconds: 17,
        collapse_probability: 0.32,
        ccr_external: 4,
        ccr_internal: 2.5,
      },
    }
    useMissionStore.setState({ dashboard })

    render(<EvaluationPanel />)

    expect(screen.getByText("39s")).toBeInTheDocument()
    expect(screen.getByText("61%")).toBeInTheDocument()
    expect(screen.getByText("29pp")).toBeInTheDocument()
    expect(screen.getByText("4.0x / 2.5x")).toBeInTheDocument()
  })
})
