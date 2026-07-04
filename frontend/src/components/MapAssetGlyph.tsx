import type { MouseEvent as ReactMouseEvent } from "react"
import { capabilityLabel, formatPercent, targetLabel } from "../format"
import { mapAssetIconHref } from "../mapAssetIcons"
import type { Point, Vehicle } from "../types"
import { vehicleTypeLabel } from "../vehicleDeployment"

const AIR_VEHICLE_TYPES = new Set([
  "UAV",
  "micro_scout_uav",
  "quad_recon_uav",
  "fixedwing_survey_uav",
  "relay_uav",
  "overwatch_uav",
  "gps_denied_uav",
])

const GROUND_VEHICLE_TYPES = new Set(["UGV", "scout_rover", "sensor_rover"])

type InfoOffset = {
  readonly x: number
  readonly y: number
}

type MapAssetGlyphProps = {
  readonly active: boolean
  readonly displayPosition: Point
  readonly onActiveChange: (vehicleId: string | null) => void
  readonly onOpenMenu: (request: AssetMenuRequest) => void
  readonly overlayScale: number
  readonly vehicle: Vehicle
}

type MapAssetInfoCardProps = {
  readonly active: boolean
  readonly displayPosition: Point
  readonly overlayScale: number
  readonly vehicle: Vehicle
}

export type AssetMenuRequest = {
  readonly clientX: number
  readonly clientY: number
  readonly vehicle: Vehicle
}

export function MapAssetGlyph({
  active,
  displayPosition,
  onActiveChange,
  onOpenMenu,
  overlayScale,
  vehicle,
}: MapAssetGlyphProps) {
  const availability = assetAvailability(vehicle)
  const readiness = availability >= 0.72 ? "ready" : availability >= 0.45 ? "degraded" : "stressed"
  const className = `asset ${AIR_VEHICLE_TYPES.has(vehicle.type) ? "asset-uav" : ""} ${
    GROUND_VEHICLE_TYPES.has(vehicle.type) ? "asset-ugv" : ""
  } ${vehicle.synthetic ? "asset-synthetic" : ""} ${vehicle.status} ${readiness} ${
    active ? "asset-active" : ""
  }`
  const radius = vehicle.synthetic ? 0.62 : 1.2
  const iconSize = vehicle.synthetic ? 3.4 : 4.8
  const offsetX = displayPosition.x - vehicle.position.x
  const offsetY = displayPosition.y - vehicle.position.y
  const nearBottomEdge = displayPosition.y > 68
  const labelOnLeft = offsetX < -0.5
  const labelX = labelOnLeft ? -4.8 : offsetX > 0.5 ? 4.8 : 3.4
  const labelY =
    (offsetY < -0.5 || nearBottomEdge ? -4.0 : offsetY > 0.5 ? 5.8 : 1.1) +
    labelStaggerFor(vehicle.id)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: SVG map glyphs expose hover/focus details and context menu actions.
    <g
      aria-label={`${vehicle.id} 자산 정보`}
      className={className}
      data-asset-id={vehicle.id}
      focusable="true"
      tabIndex={0}
      transform={`translate(${displayPosition.x} ${displayPosition.y}) scale(${overlayScale})`}
      onBlur={() => onActiveChange(null)}
      onFocus={() => onActiveChange(vehicle.id)}
      onMouseEnter={() => onActiveChange(vehicle.id)}
      onMouseLeave={() => onActiveChange(null)}
      onContextMenu={(event) => openMenuForAsset({ event, onOpenMenu, vehicle })}
    >
      <title>{assetDescription(vehicle, availability)}</title>
      <circle className="asset-hitbox" cx="0" cy="0" r={radius + 3.3} />
      <circle className="asset-ring" cx="0" cy="0" r={radius + 0.82} />
      <image
        className="asset-type-icon"
        data-testid="asset-type-icon"
        focusable="false"
        height={iconSize}
        href={mapAssetIconHref(vehicle.type)}
        preserveAspectRatio="xMidYMid meet"
        width={iconSize}
        x={-iconSize / 2}
        y={-iconSize / 2}
      />
      {!vehicle.synthetic ? (
        <text
          className="asset-label"
          textAnchor={labelOnLeft ? "end" : "start"}
          x={labelX}
          y={labelY}
        >
          {vehicle.id}
        </text>
      ) : null}
    </g>
  )
}

function openMenuForAsset({
  event,
  onOpenMenu,
  vehicle,
}: {
  readonly event: ReactMouseEvent<SVGGElement>
  readonly onOpenMenu: (request: AssetMenuRequest) => void
  readonly vehicle: Vehicle
}) {
  event.preventDefault()
  event.stopPropagation()
  onOpenMenu({ clientX: event.clientX, clientY: event.clientY, vehicle })
}

export function MapAssetInfoCard({
  active,
  displayPosition,
  overlayScale,
  vehicle,
}: MapAssetInfoCardProps) {
  const availability = assetAvailability(vehicle)
  const offset = infoOffsetFor(displayPosition)
  return (
    <g
      className={`asset-info ${active ? "visible" : ""}`}
      data-asset-info-id={vehicle.id}
      transform={`translate(${displayPosition.x} ${displayPosition.y}) scale(${overlayScale}) translate(${offset.x} ${offset.y})`}
    >
      <rect className="asset-info-bg" x="0" y="0" width="38" height="22" rx="1.5" />
      <text className="asset-info-title" x="2.2" y="4.8">
        {vehicle.id} · {vehicleTypeLabel(vehicle.type)}
      </text>
      <text className="asset-info-line" x="2.2" y="9.4">
        {targetLabel(vehicle.area)} / {capabilityLabel(vehicle.role)}
      </text>
      <text className="asset-info-line" x="2.2" y="14">
        가용 {formatPercent(availability)} · 배터리 {formatPercent(vehicle.health.battery)}
      </text>
      <text className="asset-info-line" x="2.2" y="18.6">
        링크 {formatPercent(vehicle.health.comm)} · 항법 {formatPercent(vehicle.health.nav)}
      </text>
    </g>
  )
}

function assetAvailability(vehicle: Vehicle): number {
  return Math.min(
    vehicle.health.battery,
    vehicle.health.comm,
    vehicle.health.nav,
    vehicle.health.sensor,
    vehicle.health.health,
  )
}

function assetDescription(vehicle: Vehicle, availability: number): string {
  return `${vehicle.id} ${vehicleTypeLabel(vehicle.type)}, ${targetLabel(vehicle.area)}, ${capabilityLabel(
    vehicle.role,
  )}, 가용 ${formatPercent(availability)}`
}

function labelStaggerFor(vehicleId: string): number {
  const suffix = Number(vehicleId.match(/[0-9]+$/)?.[0] ?? "0")
  const offsets: Record<number, number> = {
    1: -5.2,
    2: -1.6,
    3: 1.8,
    4: 4.8,
    5: 0.6,
    6: 3.0,
  }
  return offsets[suffix] ?? 0
}

function infoOffsetFor(position: Point): InfoOffset {
  const x = position.x > 62 ? -40 : 4
  const y = position.y > 56 ? -24 : 4
  return { x, y }
}
