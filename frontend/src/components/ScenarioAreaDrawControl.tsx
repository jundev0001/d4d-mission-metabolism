import { MapIcon, Plus, Trash2, X } from "lucide-react"
import { type PointerEvent as ReactPointerEvent, useState } from "react"
import {
  type CustomMapArea,
  type CustomPoint,
  MAX_AREA_POINTS,
  pointsToPath,
} from "../customScenario"

type DrawMode = "add" | "replace"
type DraftPoint = {
  readonly key: string
  readonly point: CustomPoint
}
type DragDraft = {
  readonly current: CustomPoint
  readonly origin: CustomPoint
  readonly pointerId: number
}

export function ScenarioAreaDrawControl({
  areas,
  onAddArea,
  onDeleteArea,
  onReplaceArea,
  selectedArea,
}: {
  readonly areas: readonly CustomMapArea[]
  readonly onAddArea: (points: readonly CustomPoint[]) => void
  readonly onDeleteArea: () => void
  readonly onReplaceArea: (points: readonly CustomPoint[]) => void
  readonly selectedArea: CustomMapArea
}) {
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null)
  const [draftPoints, setDraftPoints] = useState<readonly DraftPoint[]>([])
  const [dragDraft, setDragDraft] = useState<DragDraft | null>(null)

  function startDrawing(mode: DrawMode): void {
    setDrawMode(mode)
    setDraftPoints([])
  }

  function cancelDrawing(): void {
    setDrawMode(null)
    setDraftPoints([])
    setDragDraft(null)
  }

  function finishDrawing(): void {
    if (draftPoints.length < 3 || drawMode === null) {
      return
    }
    commitPoints(
      drawMode,
      draftPoints.map((draftPoint) => draftPoint.point),
    )
  }

  function commitPoints(mode: DrawMode, points: readonly CustomPoint[]): void {
    if (points.length < 3) {
      return
    }
    if (mode === "add") {
      onAddArea(points)
    } else {
      onReplaceArea(points)
    }
    cancelDrawing()
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drawMode === null) {
      return
    }
    const point = pointFromPointer(event)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragDraft({ current: point, origin: point, pointerId: event.pointerId })
    setDraftPoints([])
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drawMode === null || dragDraft === null) {
      return
    }
    const current = pointFromPointer(event)
    setDragDraft({ ...dragDraft, current })
    setDraftPoints(draftPointsFromRectangle(dragDraft.origin, current))
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drawMode === null || dragDraft === null) {
      return
    }
    if (event.currentTarget.hasPointerCapture?.(dragDraft.pointerId)) {
      event.currentTarget.releasePointerCapture?.(dragDraft.pointerId)
    }
    const current = pointFromPointer(event)
    const points = draftPointsFromRectangle(dragDraft.origin, current)
    setDraftPoints(points)
    setDragDraft(null)
    commitPoints(
      drawMode,
      points.map((draftPoint) => draftPoint.point),
    )
  }

  return (
    <>
      <div className="area-draw-toolbar">
        <button className="button" type="button" onClick={() => startDrawing("add")}>
          <Plus size={14} />새 구역 그리기
        </button>
        <button className="button" type="button" onClick={() => startDrawing("replace")}>
          <MapIcon size={14} />
          선택 구역 다시 그리기
        </button>
        <button
          className="button danger"
          type="button"
          disabled={areas.length <= 1}
          onClick={onDeleteArea}
        >
          <Trash2 size={14} />
          삭제
        </button>
      </div>
      <svg
        className={`area-draw-canvas ${drawMode === null ? "" : "is-drawing"}`}
        viewBox="0 0 100 86"
        role="img"
        aria-label="구역 폴리곤 편집기"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={cancelDrawing}
      >
        <rect className="area-draw-bg" x="0" y="0" width="100" height="86" />
        {areas.map((area) => (
          <path
            className={`area-draw-shape ${area.id === selectedArea.id ? "selected" : ""}`}
            d={pointsToPath(area.points)}
            key={area.id}
          />
        ))}
        {draftPoints.length > 0 ? (
          <>
            <path
              className="area-draw-draft"
              d={pointsToPath(draftPoints.map((draftPoint) => draftPoint.point))}
            />
            {draftPoints.map((draftPoint) => (
              <circle
                cx={draftPoint.point.x}
                cy={draftPoint.point.y}
                r="1.4"
                key={draftPoint.key}
              />
            ))}
          </>
        ) : null}
      </svg>
      {drawMode !== null ? (
        <div className="area-draw-actions">
          <span className="caption">
            {drawMode === "add" ? "새 구역" : "교체 도형"}: {draftPoints.length}/{MAX_AREA_POINTS}
          </span>
          <button
            className="button primary"
            type="button"
            disabled={draftPoints.length < 3}
            onClick={finishDrawing}
          >
            도형 저장
          </button>
          <button className="button" type="button" onClick={cancelDrawing}>
            <X size={14} />
            취소
          </button>
        </div>
      ) : null}
    </>
  )
}

function pointFromPointer(event: ReactPointerEvent<SVGSVGElement>): CustomPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: roundCoordinate(((event.clientX - rect.left) / rect.width) * 100),
    y: roundCoordinate(((event.clientY - rect.top) / rect.height) * 86),
  }
}

function draftPointsFromRectangle(
  origin: CustomPoint,
  current: CustomPoint,
): readonly DraftPoint[] {
  const left = roundCoordinate(Math.min(origin.x, current.x))
  const right = roundCoordinate(Math.max(origin.x, current.x))
  const top = roundCoordinate(Math.min(origin.y, current.y))
  const bottom = roundCoordinate(Math.max(origin.y, current.y))
  if (right - left < 3 || bottom - top < 3) {
    return []
  }
  const points = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ] satisfies readonly CustomPoint[]
  return points.map((point, index) => ({ key: `${point.x}-${point.y}-${index}`, point }))
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(2))
}
