import { pointsToPath } from "../customScenario"
import { boundsAttributes, CORNERS, cornerPoint, type DraftPoint } from "./ScenarioAreaGeometry"

export function ScenarioAreaDraftOverlay({
  draftPoints,
  showHandles,
}: {
  readonly draftPoints: readonly DraftPoint[]
  readonly showHandles: boolean
}) {
  if (draftPoints.length === 0) {
    return null
  }
  return (
    <>
      <path
        className="area-draw-draft"
        d={pointsToPath(draftPoints.map((draftPoint) => draftPoint.point))}
      />
      <rect className="area-draw-bounds" {...boundsAttributes(draftPoints)} />
      {showHandles
        ? CORNERS.map((corner) => (
            <circle
              aria-label={`구역 ${corner} 핸들`}
              className={`area-draw-handle ${corner}`}
              cx={cornerPoint(draftPoints, corner).x}
              cy={cornerPoint(draftPoints, corner).y}
              key={corner}
              r="1.65"
            />
          ))
        : null}
    </>
  )
}
