import type { MutableRefObject } from "react"
import { useEffect, useRef, useState } from "react"
import type { Point } from "./types"

export const ASSET_MOVE_DURATION_MS = 900
export const EMPTY_ASSET_POSITIONS: ReadonlyMap<string, Point> = new Map<string, Point>()

export type AssetMoveFrame = {
  readonly start: Point
  readonly target: Point
}

export function useAnimatedAssetPositions(
  targetPositions: ReadonlyMap<string, Point>,
): ReadonlyMap<string, Point> {
  const [animatedPositions, setAnimatedPositions] =
    useState<ReadonlyMap<string, Point>>(targetPositions)
  const animatedRef = useRef<ReadonlyMap<string, Point>>(targetPositions)
  const frameRef = useRef<number | null>(null)
  const targetRef = useRef<ReadonlyMap<string, Point>>(targetPositions)

  useEffect(() => {
    targetRef.current = targetPositions
    cancelPendingFrame(frameRef)

    const plan = buildAssetMovePlan(animatedRef.current, targetPositions)
    if (shouldSnapToTarget(plan)) {
      animatedRef.current = targetPositions
      setAnimatedPositions(targetPositions)
      return
    }

    const startMs = performance.now()
    const tick = (nowMs: number) => {
      const progress = Math.min((nowMs - startMs) / ASSET_MOVE_DURATION_MS, 1)
      const nextPositions = interpolateAssetPositions(plan, easeAssetMove(progress))
      animatedRef.current = nextPositions
      setAnimatedPositions(nextPositions)

      if (progress < 1) {
        frameRef.current = requestMoveFrame(tick)
        return
      }

      frameRef.current = null
      animatedRef.current = targetRef.current
      setAnimatedPositions(targetRef.current)
    }

    frameRef.current = requestMoveFrame(tick)
    return () => cancelPendingFrame(frameRef)
  }, [targetPositions])

  return animatedPositions
}

export function buildAssetMovePlan(
  currentPositions: ReadonlyMap<string, Point>,
  targetPositions: ReadonlyMap<string, Point>,
): ReadonlyMap<string, AssetMoveFrame> {
  const plan = new Map<string, AssetMoveFrame>()
  for (const [vehicleId, target] of targetPositions) {
    plan.set(vehicleId, { start: currentPositions.get(vehicleId) ?? target, target })
  }
  return plan
}

export function interpolateAssetPositions(
  plan: ReadonlyMap<string, AssetMoveFrame>,
  progress: number,
): ReadonlyMap<string, Point> {
  const positions = new Map<string, Point>()
  for (const [vehicleId, frame] of plan) {
    positions.set(vehicleId, {
      x: interpolateCoordinate(frame.start.x, frame.target.x, progress),
      y: interpolateCoordinate(frame.start.y, frame.target.y, progress),
    })
  }
  return positions
}

export function easeAssetMove(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1)
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2
}

function shouldSnapToTarget(plan: ReadonlyMap<string, AssetMoveFrame>): boolean {
  return motionShouldReduce() || !planHasMotion(plan)
}

function planHasMotion(plan: ReadonlyMap<string, AssetMoveFrame>): boolean {
  for (const frame of plan.values()) {
    if (!pointsMatch(frame.start, frame.target)) {
      return true
    }
  }
  return false
}

function pointsMatch(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y
}

function interpolateCoordinate(start: number, target: number, progress: number): number {
  return roundMapCoordinate(start + (target - start) * progress)
}

function roundMapCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000
}

function motionShouldReduce(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function requestMoveFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback)
  }
  return window.setTimeout(() => callback(performance.now()), 16)
}

function cancelPendingFrame(frameRef: MutableRefObject<number | null>): void {
  if (frameRef.current === null) {
    return
  }
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameRef.current)
  } else {
    window.clearTimeout(frameRef.current)
  }
  frameRef.current = null
}
