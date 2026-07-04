import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScenarioMapEditor } from "../src/components/ScenarioMapEditor"
import type { CustomPoint } from "../src/customScenario"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"

describe("scenario map editor", () => {
  it("Given the map editor When the operator drags a new area Then the rectangle is saved on release", () => {
    const onAddArea = vi.fn<(points: readonly CustomPoint[]) => void>()
    const selectedArea = DEFAULT_CUSTOM_SCENARIO.map.areas[0]
    render(
      <ScenarioMapEditor
        areas={DEFAULT_CUSTOM_SCENARIO.map.areas}
        selectedArea={selectedArea}
        onAddArea={onAddArea}
        onChange={vi.fn()}
        onDeleteArea={vi.fn()}
        onSelectArea={vi.fn()}
      />,
    )
    const canvas = screen.getByRole("img", { name: "구역 폴리곤 편집기" })
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 430, width: 500, x: 0, y: 0 }),
    )

    fireEvent.click(screen.getByRole("button", { name: "새 구역 그리기" }))
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 60, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 260, clientY: 220, pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 260, clientY: 220, pointerId: 1 })

    expect(onAddArea).toHaveBeenCalledWith([
      { x: 10, y: 12 },
      { x: 52, y: 12 },
      { x: 52, y: 44 },
      { x: 10, y: 44 },
    ])
  })

  it("Given a selected area When the operator redraws it Then the replacement rectangle is saved on release", () => {
    const onChange = vi.fn()
    const selectedArea = DEFAULT_CUSTOM_SCENARIO.map.areas[0]
    render(
      <ScenarioMapEditor
        areas={DEFAULT_CUSTOM_SCENARIO.map.areas}
        selectedArea={selectedArea}
        onAddArea={vi.fn()}
        onChange={onChange}
        onDeleteArea={vi.fn()}
        onSelectArea={vi.fn()}
      />,
    )
    const canvas = screen.getByRole("img", { name: "구역 폴리곤 편집기" })
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 430, width: 500, x: 0, y: 0 }),
    )

    fireEvent.click(screen.getByRole("button", { name: "선택 구역 다시 그리기" }))
    fireEvent.pointerDown(canvas, { clientX: 60, clientY: 70, pointerId: 2 })
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 250, pointerId: 2 })
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 250, pointerId: 2 })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        label_position: { x: 30, y: 29 },
        metric_position: { x: 30, y: 35 },
        points: [
          { x: 12, y: 14 },
          { x: 60, y: 14 },
          { x: 60, y: 50 },
          { x: 12, y: 50 },
        ],
        threat_position: { x: 36, y: 32 },
      }),
    )
  })
})
