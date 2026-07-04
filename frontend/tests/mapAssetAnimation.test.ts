import { describe, expect, it } from "vitest"
import {
  buildAssetMovePlan,
  easeAssetMove,
  interpolateAssetPositions,
} from "../src/mapAssetAnimation"
import type { Point } from "../src/types"

describe("asset movement animation", () => {
  it("Given an existing UxV with a new target When movement is halfway complete Then its display position is interpolated", () => {
    const currentPositions = new Map<string, Point>([["UxV-01", { x: 50, y: 80 }]])
    const targetPositions = new Map<string, Point>([["UxV-01", { x: 70, y: 40 }]])

    const plan = buildAssetMovePlan(currentPositions, targetPositions)
    const midpoint = interpolateAssetPositions(plan, easeAssetMove(0.5))

    expect(pointFor(midpoint, "UxV-01")).toEqual({ x: 60, y: 60 })
  })

  it("Given a newly visible UxV When a movement plan is built Then it appears at the target without flying in from nowhere", () => {
    const currentPositions = new Map<string, Point>()
    const targetPositions = new Map<string, Point>([["UxV-06", { x: 28, y: 64 }]])

    const plan = buildAssetMovePlan(currentPositions, targetPositions)
    const startFrame = interpolateAssetPositions(plan, 0)

    expect(pointFor(startFrame, "UxV-06")).toEqual({ x: 28, y: 64 })
  })

  it("Given a removed UxV When a movement plan is built Then stale asset positions are not rendered", () => {
    const currentPositions = new Map<string, Point>([
      ["UxV-01", { x: 50, y: 80 }],
      ["UxV-02", { x: 18, y: 24 }],
    ])
    const targetPositions = new Map<string, Point>([["UxV-01", { x: 60, y: 72 }]])

    const plan = buildAssetMovePlan(currentPositions, targetPositions)
    const displayPositions = interpolateAssetPositions(plan, 1)

    expect(displayPositions.has("UxV-02")).toBe(false)
    expect(pointFor(displayPositions, "UxV-01")).toEqual({ x: 60, y: 72 })
  })
})

function pointFor(positions: ReadonlyMap<string, Point>, vehicleId: string): Point {
  const position = positions.get(vehicleId)
  if (position !== undefined) {
    return position
  }
  throw new TypeError(`${vehicleId} point not found`)
}
