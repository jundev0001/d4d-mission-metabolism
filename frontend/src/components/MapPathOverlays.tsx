import type { CustomMapArea } from "../customScenario"
import { capabilityLabel } from "../format"
import type { DashboardState, Point } from "../types"

const GCS_POINT: Point = { x: 50, y: 80 }

type MapPathOverlay = {
  readonly area: string
  readonly end: Point
  readonly id: string
  readonly label: string
  readonly start: Point
  readonly vehicleId: string
}

type MapPathOverlaysProps = {
  readonly dashboard: DashboardState
  readonly mapAreas: readonly CustomMapArea[]
  readonly positions: ReadonlyMap<string, Point>
}

export function MapPathOverlays({ dashboard, mapAreas, positions }: MapPathOverlaysProps) {
  const missionActivityPaths = missionActivityPathsFor({ dashboard, positions })
  const actionPaths = [
    ...allocationApprovalPathsFor({ dashboard, mapAreas }),
    ...approvedActionPathsFor({ dashboard, mapAreas, positions }),
  ]

  return (
    <>
      <g className="mission-activity-layer">
        {missionActivityPaths.map((path) => (
          <path className="mission-activity-path" d={pathData(path.start, path.end)} key={path.id}>
            <title>{path.label}</title>
          </path>
        ))}
      </g>

      <g className="action-path-layer">
        {actionPaths.map((path) => (
          <g key={path.id}>
            <path
              className="action-path"
              d={pathData(path.start, path.end)}
              data-testid={`action-path-${path.vehicleId}-${path.area}`}
            />
            <circle className="action-path-source" cx={path.start.x} cy={path.start.y} r="1.25" />
            <circle className="action-path-target" cx={path.end.x} cy={path.end.y} r="1.45" />
            <text
              className="action-path-label"
              x={(path.start.x + path.end.x) / 2}
              y={(path.start.y + path.end.y) / 2 - 1.9}
            >
              {path.label}
            </text>
          </g>
        ))}
      </g>
    </>
  )
}

function missionActivityPathsFor({
  dashboard,
  positions,
}: {
  readonly dashboard: DashboardState
  readonly positions: ReadonlyMap<string, Point>
}): readonly MapPathOverlay[] {
  return dashboard.assignments.flatMap((assignment) => {
    const vehicle = dashboard.vehicles.find((item) => item.id === assignment.vehicle_id)
    const target = dashboard.mission.area_centers[assignment.area]
    if (vehicle === undefined || target === undefined || vehicle.status === "lost") {
      return []
    }
    const start = positions.get(vehicle.id) ?? vehicle.position
    if (pointsAreNear(start, target)) {
      return []
    }
    return [
      {
        area: assignment.area,
        end: target,
        id: `mission-${assignment.vehicle_id}-${assignment.area}-${assignment.role}`,
        label: `${assignment.vehicle_id} ${capabilityLabel(assignment.role)}`,
        start,
        vehicleId: assignment.vehicle_id,
      },
    ]
  })
}

function approvedActionPathsFor({
  dashboard,
  mapAreas,
  positions,
}: MapPathOverlaysProps): readonly MapPathOverlay[] {
  return dashboard.recommendations.flatMap((card) => {
    if (card.status !== "approved" && card.status !== "manual") {
      return []
    }
    return card.actions.flatMap((action) => {
      if (action.area === null) {
        return []
      }
      const vehicle = dashboard.vehicles.find((item) => item.id === action.vehicle_id)
      const target = dashboard.mission.area_centers[action.area]
      if (vehicle === undefined || target === undefined) {
        return []
      }
      return [
        {
          area: action.area,
          end: target,
          id: `${card.id}-${action.vehicle_id}-${action.area}-${action.action}`,
          label: `${action.vehicle_id} → ${mapAreaLabel(mapAreas, action.area)}`,
          start:
            action.action === "launch_reserve" || action.action === "replace"
              ? GCS_POINT
              : (positions.get(vehicle.id) ?? vehicle.position),
          vehicleId: action.vehicle_id,
        },
      ]
    })
  })
}

function allocationApprovalPathsFor({
  dashboard,
  mapAreas,
}: Omit<MapPathOverlaysProps, "positions">): readonly MapPathOverlay[] {
  if (dashboard.assignments.length === 0 || dashboard.events.length > 0) {
    return []
  }
  return dashboard.assignments.flatMap((assignment) => {
    const vehicle = dashboard.vehicles.find((item) => item.id === assignment.vehicle_id)
    const target = dashboard.mission.area_centers[assignment.area]
    if (vehicle === undefined || vehicle.synthetic || target === undefined) {
      return []
    }
    return [
      {
        area: assignment.area,
        end: target,
        id: `allocation-${assignment.vehicle_id}-${assignment.area}`,
        label: `${assignment.vehicle_id} → ${mapAreaLabel(mapAreas, assignment.area)}`,
        start: GCS_POINT,
        vehicleId: assignment.vehicle_id,
      },
    ]
  })
}

function mapAreaLabel(mapAreas: readonly CustomMapArea[], areaId: string): string {
  return mapAreas.find((area) => area.id === areaId)?.label ?? areaId
}

function pathData(start: Point, end: Point): string {
  return `M${start.x} ${start.y} L${end.x} ${end.y}`
}

function pointsAreNear(start: Point, end: Point): boolean {
  return Math.hypot(start.x - end.x, start.y - end.y) < 0.4
}
