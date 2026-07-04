import { DEFAULT_MAP_VIEW_BOX } from "./mapViewport"
import type { Point, Vehicle } from "./types"

const ASSET_CLUSTER_DISTANCE = 8
const ASSET_CLUSTER_MAP_PADDING = 5
const REAL_ASSET_CLUSTER_RADIUS_BASE = 10.5
const REAL_ASSET_CLUSTER_RADIUS_STEP = 0.95
const SYNTHETIC_CLUSTER_RADIUS_BASE = 3.4
const SYNTHETIC_CLUSTER_RADIUS_STEP = 0.28
const RIGHT_EDGE_CLUSTER_THRESHOLD = 89
const RIGHT_EDGE_CLUSTER_X = 94.7
const REAL_RIGHT_EDGE_STEP = 6.4
const SYNTHETIC_RIGHT_EDGE_STEP = 3.2

type AssetDisplayCluster = {
  center: Point
  members: Vehicle[]
}

export function displayPositionsForVehicles(
  vehicles: readonly Vehicle[],
): ReadonlyMap<string, Point> {
  const groups = clusterVehiclesByMapDistance(vehicles)
  const positions = new Map<string, Point>()

  for (const group of groups) {
    if (group.members.length === 1) {
      const vehicle = group.members.at(0)
      if (vehicle === undefined) {
        continue
      }
      positions.set(vehicle.id, vehicle.position)
      continue
    }

    const realMembers = sortedClusterMembers(group.members.filter((vehicle) => !vehicle.synthetic))
    const syntheticMembers = sortedClusterMembers(
      group.members.filter((vehicle) => vehicle.synthetic),
    )
    if (isRightEdgeCluster(group.center)) {
      placeRightEdgeRail({
        center: group.center,
        members: realMembers,
        positions,
        step: REAL_RIGHT_EDGE_STEP,
        x: RIGHT_EDGE_CLUSTER_X,
      })
      placeRightEdgeRail({
        center: group.center,
        members: syntheticMembers,
        positions,
        step: SYNTHETIC_RIGHT_EDGE_STEP,
        x: RIGHT_EDGE_CLUSTER_X - 4.4,
      })
      continue
    }
    placeClusterRing({
      angleOffset: -Math.PI / 2,
      center: group.center,
      members: realMembers,
      positions,
      radius: Math.min(
        18,
        REAL_ASSET_CLUSTER_RADIUS_BASE + realMembers.length * REAL_ASSET_CLUSTER_RADIUS_STEP,
      ),
    })
    placeClusterRing({
      angleOffset: Math.PI / 2,
      center: group.center,
      members: syntheticMembers,
      positions,
      radius: Math.min(
        7,
        SYNTHETIC_CLUSTER_RADIUS_BASE + syntheticMembers.length * SYNTHETIC_CLUSTER_RADIUS_STEP,
      ),
    })
  }

  return positions
}

function isRightEdgeCluster(center: Point): boolean {
  return center.x > RIGHT_EDGE_CLUSTER_THRESHOLD
}

function sortedClusterMembers(members: readonly Vehicle[]): readonly Vehicle[] {
  return [...members].sort((left, right) => left.id.localeCompare(right.id))
}

function placeRightEdgeRail(request: {
  readonly center: Point
  readonly members: readonly Vehicle[]
  readonly positions: Map<string, Point>
  readonly step: number
  readonly x: number
}): void {
  const midpoint = (request.members.length - 1) / 2
  request.members.forEach((vehicle, index) => {
    request.positions.set(vehicle.id, {
      x: request.x,
      y: clampMapCoordinate(request.center.y + (index - midpoint) * request.step, "y"),
    })
  })
}

function placeClusterRing(request: {
  readonly angleOffset: number
  readonly center: Point
  readonly members: readonly Vehicle[]
  readonly positions: Map<string, Point>
  readonly radius: number
}): void {
  request.members.forEach((vehicle, index) => {
    const angle = request.angleOffset + (index * 2 * Math.PI) / request.members.length
    request.positions.set(vehicle.id, {
      x: clampMapCoordinate(request.center.x + Math.cos(angle) * request.radius, "x"),
      y: clampMapCoordinate(request.center.y + Math.sin(angle) * request.radius, "y"),
    })
  })
}

function clusterVehiclesByMapDistance(vehicles: readonly Vehicle[]): {
  readonly center: Point
  readonly members: readonly Vehicle[]
}[] {
  const groups: AssetDisplayCluster[] = []

  for (const vehicle of vehicles) {
    const group = nearestClusterFor(vehicle, groups)
    if (group === undefined) {
      groups.push({ center: vehicle.position, members: [vehicle] })
      continue
    }
    group.members.push(vehicle)
    group.center = clusterCenter(group.members)
  }

  return groups
}

function nearestClusterFor(
  vehicle: Vehicle,
  groups: readonly AssetDisplayCluster[],
): AssetDisplayCluster | undefined {
  let nearest: AssetDisplayCluster | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const group of groups) {
    const distance = mapDistance(vehicle.position, group.center)
    if (distance <= ASSET_CLUSTER_DISTANCE && distance < nearestDistance) {
      nearest = group
      nearestDistance = distance
    }
  }
  return nearest
}

function clusterCenter(vehicles: readonly Vehicle[]): Point {
  const total = vehicles.reduce(
    (sum, vehicle) => ({
      x: sum.x + vehicle.position.x,
      y: sum.y + vehicle.position.y,
    }),
    { x: 0, y: 0 },
  )
  return {
    x: total.x / vehicles.length,
    y: total.y / vehicles.length,
  }
}

function mapDistance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function clampMapCoordinate(value: number, axis: "x" | "y"): number {
  const max = axis === "x" ? DEFAULT_MAP_VIEW_BOX.width : DEFAULT_MAP_VIEW_BOX.height
  return Math.min(Math.max(value, ASSET_CLUSTER_MAP_PADDING), max - ASSET_CLUSTER_MAP_PADDING)
}
