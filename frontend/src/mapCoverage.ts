import type { DashboardState } from "./types"

export function countRelayAssignments(dashboard: DashboardState): number {
  return dashboard.assignments.filter((assignment) => assignment.role === "relay").length
}

export function minimumCoverageForArea(dashboard: DashboardState, area: string): number {
  const coverage = dashboard.capability_report.area_reports[area]?.coverage
  if (coverage === undefined) {
    return 0
  }
  const values = Object.values(coverage)
  if (values.length === 0) {
    return 0
  }
  return Math.min(...values)
}
