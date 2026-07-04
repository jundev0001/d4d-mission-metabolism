import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { BlackBoxPanel } from "../src/components/BlackBoxPanel"
import { useMissionStore } from "../src/store"

describe("black box calculation log", () => {
  beforeEach(() => {
    useMissionStore.setState({
      replay: [
        {
          id: "bb-001",
          kind: "calculation",
          payload_json: JSON.stringify({
            trigger: "vehicle_parameter_tune",
            mcc: 0.76,
            baseline_mcc: 0.68,
            collapse_probability: 0.34,
            autonomy_debt: 42,
            ccr_external: 5.4,
            ccr_internal: 3,
            pending_recommendations: 1,
            assigned_assets: 9,
            area_mcc: { A: 0.82, B: 0.76, C: 0.71 },
          }),
          scenario_time: 120,
          summary: "vehicle parameter tune recalculated mission metrics",
        },
      ],
      selectedReplayIndex: 0,
    })
  })

  it("Given a calculation entry When the log renders Then it exposes the computed KPI inputs and outputs", () => {
    render(<BlackBoxPanel />)

    expect(screen.getByRole("heading", { name: "계산 로그" })).toBeInTheDocument()
    expect(screen.getByText("vehicle_parameter_tune")).toBeInTheDocument()
    expect(screen.getByText("MCC 76%")).toBeInTheDocument()
    expect(screen.getByText("Baseline 68%")).toBeInTheDocument()
    expect(screen.getByText("붕괴 34%")).toBeInTheDocument()
    expect(screen.getByText("부채 42")).toBeInTheDocument()
    expect(screen.getByText("A 82%")).toBeInTheDocument()
    expect(screen.getByText("B 76%")).toBeInTheDocument()
  })

  it("Given chronological replay When the selected row is not a calculation Then it shows the latest calculation", () => {
    useMissionStore.setState({
      replay: [
        {
          id: "bb-001",
          kind: "mission",
          payload_json: "{}",
          scenario_time: 0,
          summary: "mission initialized",
        },
        {
          id: "bb-002",
          kind: "calculation",
          payload_json: JSON.stringify({
            trigger: "mission_initialized",
            mcc: 0.58,
            baseline_mcc: 0.58,
            collapse_probability: 0.22,
            autonomy_debt: 12,
            ccr_external: 28,
            ccr_internal: 1,
            pending_recommendations: 0,
            assigned_assets: 0,
            area_mcc: { A: 0.58 },
          }),
          scenario_time: 0,
          summary: "mission initialized recalculated mission metrics",
        },
        {
          id: "bb-003",
          kind: "calculation",
          payload_json: JSON.stringify({
            trigger: "vehicle_parameter_tune",
            mcc: 0.73,
            baseline_mcc: 0.73,
            collapse_probability: 0.31,
            autonomy_debt: 36,
            ccr_external: 5.1,
            ccr_internal: 3,
            pending_recommendations: 1,
            assigned_assets: 7,
            area_mcc: { A: 0.8, B: 0.73 },
          }),
          scenario_time: 60,
          summary: "vehicle parameter tune recalculated mission metrics",
        },
      ],
      selectedReplayIndex: 0,
    })

    render(<BlackBoxPanel />)

    expect(screen.getByText("vehicle_parameter_tune")).toBeInTheDocument()
    expect(screen.getByText("MCC 73%")).toBeInTheDocument()
  })
})
