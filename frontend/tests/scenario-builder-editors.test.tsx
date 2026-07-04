import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScenarioMapEditor } from "../src/components/ScenarioMapEditor"
import type { CustomPoint } from "../src/customScenario"
import { DEFAULT_CUSTOM_SCENARIO } from "../src/defaultCustomScenario"

describe("scenario map editor", () => {
  it("Given the map editor When the operator drags a new area Then a named polygon can be saved", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "도형 저장" }))

    expect(onAddArea).toHaveBeenCalledWith([
      { x: 10, y: 12 },
      { x: 52, y: 12 },
      { x: 52, y: 44 },
      { x: 10, y: 44 },
    ])
  })
})
