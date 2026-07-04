export function MapLegend() {
  return (
    <div className="map-legend">
      <span>
        <i className="legend-dot asset-uav" /> UxV 공중
      </span>
      <span>
        <i className="legend-dot asset-ugv" /> UGV 지상
      </span>
      <span>
        <i className="legend-dot asset-synthetic" /> 합성 윙맨
      </span>
      <span>
        <i className="legend-dot jammer-dot" /> 전자전 압력
      </span>
      <span>
        <i className="legend-dot no-go-dot" /> No-go
      </span>
    </div>
  )
}
