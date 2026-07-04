import type { CustomPoint } from "../customScenario"

export type DraftPoint = {
  readonly key: string
  readonly point: CustomPoint
}

export type DragDraft = {
  readonly current: CustomPoint
  readonly corner?: ShapeCorner
  readonly kind: DragKind
  readonly origin: CustomPoint
  readonly pointerId: number
  readonly startPoints: readonly DraftPoint[]
}

export type DragKind = "create" | "move" | "resize"
export type ShapeCorner = "nw" | "ne" | "se" | "sw"

export const CORNERS = ["nw", "ne", "se", "sw"] as const

const MIN_SHAPE_SIZE = 3

export function draftPointsFromRectangle(
  origin: CustomPoint,
  current: CustomPoint,
): readonly DraftPoint[] {
  const left = roundCoordinate(Math.min(origin.x, current.x))
  const right = roundCoordinate(Math.max(origin.x, current.x))
  const top = roundCoordinate(Math.min(origin.y, current.y))
  const bottom = roundCoordinate(Math.max(origin.y, current.y))
  if (right - left < MIN_SHAPE_SIZE || bottom - top < MIN_SHAPE_SIZE) {
    return []
  }
  return draftPointsFromPoints([
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ])
}

export function draftPointsFromPoints(points: readonly CustomPoint[]): readonly DraftPoint[] {
  return points.map((point, index) => ({ key: `${point.x}-${point.y}-${index}`, point }))
}

export function translateDraftPoints(
  points: readonly DraftPoint[],
  delta: CustomPoint,
): readonly DraftPoint[] {
  const bounds = shapeBounds(points)
  const xDelta = clamp(delta.x, -bounds.left, 100 - bounds.right)
  const yDelta = clamp(delta.y, -bounds.top, 86 - bounds.bottom)
  return draftPointsFromPoints(
    points.map((draftPoint) => ({
      x: roundCoordinate(draftPoint.point.x + xDelta),
      y: roundCoordinate(draftPoint.point.y + yDelta),
    })),
  )
}

export function resizeDraftPoints(
  points: readonly DraftPoint[],
  corner: ShapeCorner,
  point: CustomPoint,
): readonly DraftPoint[] {
  const opposite = oppositeCornerPoint(shapeBounds(points), corner)
  return draftPointsFromRectangle(opposite, point)
}

export function cornerPoint(points: readonly DraftPoint[], corner: ShapeCorner): CustomPoint {
  return cornerPointFromBounds(shapeBounds(points), corner)
}

export function hitShapeCorner(
  points: readonly DraftPoint[],
  point: CustomPoint,
): ShapeCorner | null {
  const hitRadius = 3.2
  const corner = CORNERS.find(
    (candidate) => distanceBetween(cornerPoint(points, candidate), point) <= hitRadius,
  )
  return corner ?? null
}

export function pointInsideDraft(points: readonly DraftPoint[], point: CustomPoint): boolean {
  const bounds = shapeBounds(points)
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  )
}

export function boundsAttributes(points: readonly DraftPoint[]): {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
} {
  const bounds = shapeBounds(points)
  return {
    height: roundCoordinate(bounds.bottom - bounds.top),
    width: roundCoordinate(bounds.right - bounds.left),
    x: bounds.left,
    y: bounds.top,
  }
}

export function deltaBetween(origin: CustomPoint, current: CustomPoint): CustomPoint {
  return {
    x: roundCoordinate(current.x - origin.x),
    y: roundCoordinate(current.y - origin.y),
  }
}

export function roundCoordinate(value: number): number {
  return Number(value.toFixed(2))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

type ShapeBounds = {
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly top: number
}

function shapeBounds(points: readonly DraftPoint[]): ShapeBounds {
  const xs = points.map((draftPoint) => draftPoint.point.x)
  const ys = points.map((draftPoint) => draftPoint.point.y)
  return {
    bottom: Math.max(...ys),
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
  }
}

function oppositeCornerPoint(bounds: ShapeBounds, corner: ShapeCorner): CustomPoint {
  if (corner === "nw") {
    return { x: bounds.right, y: bounds.bottom }
  }
  if (corner === "ne") {
    return { x: bounds.left, y: bounds.bottom }
  }
  if (corner === "se") {
    return { x: bounds.left, y: bounds.top }
  }
  return { x: bounds.right, y: bounds.top }
}

function cornerPointFromBounds(bounds: ShapeBounds, corner: ShapeCorner): CustomPoint {
  if (corner === "nw") {
    return { x: bounds.left, y: bounds.top }
  }
  if (corner === "ne") {
    return { x: bounds.right, y: bounds.top }
  }
  if (corner === "se") {
    return { x: bounds.right, y: bounds.bottom }
  }
  return { x: bounds.left, y: bounds.bottom }
}

function distanceBetween(first: CustomPoint, second: CustomPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y)
}
