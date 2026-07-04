import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MissionIntentControls } from "../src/components/MissionIntentControls"
import type { CustomMissionIntent } from "../src/customScenario"

const intent: CustomMissionIntent = {
  autonomy_level: 0.62,
  constraints: {
    human_approval_for_replan: true,
    min_relay_redundancy: 1,
    return_battery_threshold: 0.2,
    target_mcc: 0.8,
  },
}

describe("MissionIntentControls", () => {
  it("Given mission intent controls When edited Then constrained intent updates are emitted", () => {
    const onChange = vi.fn()

    render(<MissionIntentControls intent={intent} onChange={onChange} />)

    fireEvent.change(inputFor("Target MCC"), { target: { value: "0.86" } })
    fireEvent.change(inputFor("Relay min"), { target: { value: "9" } })
    fireEvent.click(inputFor("Gate"))

    expect(onChange).toHaveBeenNthCalledWith(1, {
      ...intent,
      constraints: { ...intent.constraints, target_mcc: 0.86 },
    })
    expect(onChange).toHaveBeenNthCalledWith(2, {
      ...intent,
      constraints: { ...intent.constraints, min_relay_redundancy: 4 },
    })
    expect(onChange).toHaveBeenNthCalledWith(3, {
      ...intent,
      constraints: { ...intent.constraints, human_approval_for_replan: false },
    })
  })
})

function inputFor(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText).closest("label")
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error(`${labelText} label not found`)
  }
  const input = label.querySelector("input")
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`${labelText} input not found`)
  }
  return input
}
