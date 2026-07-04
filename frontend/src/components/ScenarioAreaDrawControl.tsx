import { MapIcon, Plus, Trash2, X } from "lucide-react"
import { type PointerEvent as ReactPointerEvent, useState } from "react"
import {
  type CustomMapArea,
  type CustomPoint,
  MAX_AREA_POINTS,
  pointsToPath,
} from "../customScenario"
import { ScenarioAreaDraftOverlay } from "./ScenarioAreaDraftOverlay"
import {
  clamp,
  type DraftPoint,
  type DragDraft,
  deltaBetween,
  draftPointsFromPoints,
  draftPointsFromRectangle,
  hitShapeCorner,
  pointInsideDraft,
  resizeDraftPoints,
  roundCoordinate,
  translateDraftPoints,
} from "./ScenarioAreaGeometry"

type DrawMode = "add" | "replace"

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
    setDraftPoints(mode === "replace" ? draftPointsFromPoints(selectedArea.points) : [])
    setDragDraft(null)
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
    const corner = hitShapeCorner(draftPoints, point)
    if (corner !== null) {
      setDragDraft({
        corner,
        current: point,
        kind: "resize",
        origin: point,
        pointerId: event.pointerId,
        startPoints: draftPoints,
      })
      return
    }
    if (pointInsideDraft(draftPoints, point)) {
      setDragDraft({
        current: point,
        kind: "move",
        origin: point,
        pointerId: event.pointerId,
        startPoints: draftPoints,
      })
      return
    }
    setDragDraft({
      current: point,
      kind: "create",
      origin: point,
      pointerId: event.pointerId,
      startPoints: [],
    })
    setDraftPoints([])
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drawMode === null || dragDraft === null) {
      return
    }
    const current = pointFromPointer(event)
    if (dragDraft.kind === "create") {
      setDragDraft({ ...dragDraft, current })
      setDraftPoints(draftPointsFromRectangle(dragDraft.origin, current))
    }
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<SVGSVGElement>): void {
    if (drawMode === null || dragDraft === null) {
      return
    }
    const points = currentDraftPoints(event, dragDraft)
    setDraftPoints(points)
    setDragDraft(null)
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
        <ScenarioAreaDraftOverlay draftPoints={draftPoints} showHandles={dragDraft === null} />
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

function pointFromPointer(event: ReactPointerEvent<SVGElement>): CustomPoint {
  const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget
  const rect = svg.getBoundingClientRect()
  return {
    x: roundCoordinate(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100)),
    y: roundCoordinate(clamp(((event.clientY - rect.top) / rect.height) * 86, 0, 86)),
  }
}

function currentDraftPoints(
  event: ReactPointerEvent<SVGSVGElement>,
  dragDraft: DragDraft,
): readonly DraftPoint[] {
  const current = pointFromPointer(event)
  if (dragDraft.kind === "create") {
    return draftPointsFromRectangle(dragDraft.origin, current)
  }
  if (dragDraft.kind === "move") {
    return translateDraftPoints(dragDraft.startPoints, deltaBetween(dragDraft.origin, current))
  }
  if (dragDraft.corner === undefined) {
    return dragDraft.startPoints
  }
  return resizeDraftPoints(dragDraft.startPoints, dragDraft.corner, current)
}
