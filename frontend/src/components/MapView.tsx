import { useEffect, useRef, useState } from "react"
import { displayPositionsForVehicles } from "../mapAssetDisplay"
import { minimumCoverageForArea } from "../mapCoverage"
import {
  assetMenuStateFromClientPoint,
  DEFAULT_MAP_VIEW_BOX,
  formatViewBox,
  type MapAssetMenuState,
  type MapDragState,
  type MapViewBox,
  overlayScaleForViewBox,
  panViewBox,
  zoomViewBox,
} from "../mapViewport"
import { useMissionStore } from "../store"
import { MapAreaLabel, MapAreaSector } from "./MapAreaSector"
import { MapAssetContextMenu } from "./MapAssetContextMenu"
import { type AssetMenuRequest, MapAssetGlyph, MapAssetInfoCard } from "./MapAssetGlyph"
import { MapLegend } from "./MapLegend"
import { MapReadout } from "./MapReadout"

const GRID_LINES = [12, 24, 36, 48, 60, 72, 84] as const

export function MapView() {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<SVGSVGElement | null>(null)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [assetMenu, setAssetMenu] = useState<MapAssetMenuState | null>(null)
  const [dragState, setDragState] = useState<MapDragState | null>(null)
  const [viewBox, setViewBox] = useState<MapViewBox>(DEFAULT_MAP_VIEW_BOX)
  const dashboard = useMissionStore((state) => state.dashboard)
  const deployFleet = useMissionStore((state) => state.deployFleet)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)
  const mapAreas = useMissionStore((state) => state.customScenario.map.areas)
  const mapName = useMissionStore((state) => state.customScenario.map.name)
  const profiles = useMissionStore((state) => state.vehicleTypeProfiles)

  useEffect(() => {
    const map = mapRef.current
    if (map === null) {
      return
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = map.getBoundingClientRect()
      setViewBox((current) =>
        zoomViewBox({
          clientX: event.clientX,
          clientY: event.clientY,
          deltaY: event.deltaY,
          rect,
          viewBox: current,
        }),
      )
    }
    map.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      map.removeEventListener("wheel", handleWheel)
    }
  }, [])

  if (!dashboard) {
    return null
  }
  const realAssets = dashboard.vehicles.filter((vehicle) => !vehicle.synthetic).length
  const syntheticAssets = dashboard.vehicles.length - realAssets
  const overlayScale = overlayScaleForViewBox(viewBox)
  const assetDisplayPositions = displayPositionsForVehicles(dashboard.vehicles)

  const openAssetMenu = (request: AssetMenuRequest) => {
    setActiveAssetId(request.vehicle.id)
    setAssetMenu(
      assetMenuStateFromClientPoint({
        clientX: request.clientX,
        clientY: request.clientY,
        frameRect: frameRef.current?.getBoundingClientRect() ?? null,
        vehicleId: request.vehicle.id,
      }),
    )
  }

  return (
    <section className="panel map-panel" aria-label="공통작전상황도" data-testid="map-view">
      <div className="panel-title">
        <span>
          공통작전상황도 <span className="mono">(COP)</span>
        </span>
        <span className="caption">
          실자산 {realAssets} / 합성 {syntheticAssets}
        </span>
      </div>
      <div className="cop-frame" ref={frameRef}>
        <svg
          ref={mapRef}
          viewBox={formatViewBox(viewBox)}
          className={`cop-map ${dragState ? "is-panning" : ""}`}
          role="img"
          aria-label={`${mapName} 공통작전상황도`}
          onPointerCancel={(event) => {
            if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
              event.currentTarget.releasePointerCapture?.(event.pointerId)
            }
            setDragState(null)
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return
            }
            setAssetMenu(null)
            event.currentTarget.setPointerCapture?.(event.pointerId)
            setDragState({ clientX: event.clientX, clientY: event.clientY, viewBox })
          }}
          onPointerMove={(event) => {
            if (dragState === null) {
              return
            }
            const rect = event.currentTarget.getBoundingClientRect()
            setViewBox(
              panViewBox({
                clientX: event.clientX,
                clientY: event.clientY,
                dragState,
                rectHeight: rect.height,
                rectWidth: rect.width,
              }),
            )
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
              event.currentTarget.releasePointerCapture?.(event.pointerId)
            }
            setDragState(null)
          }}
        >
          <defs>
            <pattern id="grid-major" width="12" height="12" patternUnits="userSpaceOnUse">
              <path className="grid-pattern" d="M12 0 H0 V12" />
            </pattern>
            <pattern id="no-go-hatch" width="4" height="4" patternUnits="userSpaceOnUse">
              <path className="hatch-line" d="M-1 4 L4 -1 M0 5 L5 0" />
            </pattern>
          </defs>
          <rect className="map-bg" x="0" y="0" width="100" height="86" rx="3" />
          <rect className="map-grid-fill" x="0" y="0" width="100" height="86" />
          {mapAreas.map((area) => (
            <MapAreaSector
              key={area.id}
              area={area}
              minimumCoverage={minimumCoverageForArea(dashboard, area.id)}
              noGo={dashboard.mission.no_go_areas.includes(area.id)}
              threat={dashboard.mission.area_threats[area.id] ?? 0}
            />
          ))}

          {GRID_LINES.map((line) => (
            <g className="grid-axis" key={`grid-${line}`}>
              <line x1={line} y1="0" x2={line} y2="86" />
              <line x1="0" y1={line} x2="100" y2={line} />
            </g>
          ))}
          <path className="route-line route-primary" d="M17 27 L55 38 L78 70" />
          <path className="route-line route-secondary" d="M26 58 L55 38 L73 25" />
          <circle className="relay-node" cx="55" cy="38" r="2.2" />

          <g className="map-label-layer">
            {mapAreas.map((area) => (
              <MapAreaLabel area={area} key={`label-${area.id}`} overlayScale={overlayScale} />
            ))}
          </g>
          {dashboard.vehicles.map((vehicle) => (
            <MapAssetGlyph
              active={activeAssetId === vehicle.id}
              displayPosition={assetDisplayPositions.get(vehicle.id) ?? vehicle.position}
              key={vehicle.id}
              overlayScale={overlayScale}
              vehicle={vehicle}
              onActiveChange={setActiveAssetId}
              onOpenMenu={openAssetMenu}
            />
          ))}
          <g className="asset-info-layer">
            {dashboard.vehicles.map((vehicle) => (
              <MapAssetInfoCard
                active={activeAssetId === vehicle.id}
                displayPosition={assetDisplayPositions.get(vehicle.id) ?? vehicle.position}
                key={`info-${vehicle.id}`}
                overlayScale={overlayScale}
                vehicle={vehicle}
              />
            ))}
          </g>
        </svg>
        <MapAssetContextMenu
          dashboard={dashboard}
          disabled={isRunningDemo}
          menu={assetMenu}
          profiles={profiles}
          onClose={() => setAssetMenu(null)}
          onDeployFleet={deployFleet}
        />
      </div>
      <MapReadout dashboard={dashboard} mapAreas={mapAreas} />
      <MapLegend />
    </section>
  )
}
