import { Settings2, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { capabilityLabel, targetLabel } from "../format"
import type { MapAssetMenuState } from "../mapViewport"
import type { DashboardState, Vehicle } from "../types"
import {
  type FleetDeploymentPayload,
  isDeployableVehicleType,
  type VehicleType,
  type VehicleTypeProfile,
  vehicleTypeLabel,
} from "../vehicleDeployment"

const MIN_DEPLOYED_ASSETS = 5

type MapAssetContextMenuProps = {
  readonly dashboard: DashboardState
  readonly disabled: boolean
  readonly menu: MapAssetMenuState | null
  readonly profiles: readonly VehicleTypeProfile[]
  readonly onClose: () => void
  readonly onDeployFleet: (items: FleetDeploymentPayload) => Promise<void>
}

export function MapAssetContextMenu(props: MapAssetContextMenuProps) {
  const vehicle = props.menu
    ? props.dashboard.vehicles.find((item) => item.id === props.menu?.vehicleId)
    : undefined
  const [draftType, setDraftType] = useState<VehicleType | "">("")

  useEffect(() => {
    setDraftType(vehicle && isDeployableVehicleType(vehicle.type) ? vehicle.type : "")
  }, [vehicle])

  if (!props.menu || vehicle === undefined) {
    return null
  }

  const canMutate = !props.disabled && isMutableVehicle(vehicle)
  const deployedCount = props.dashboard.vehicles.filter(isMutableVehicle).length
  const canRemove = canMutate && deployedCount > MIN_DEPLOYED_ASSETS
  const canApplySpec = canMutate && draftType !== "" && draftType !== vehicle.type

  const removeVehicle = () => {
    if (!canRemove || !isMutableVehicle(vehicle)) {
      return
    }
    void props.onDeployFleet(
      removeFromDeployment(props.dashboard.vehicles, props.profiles, vehicle.type),
    )
    props.onClose()
  }

  const applySpecChange = () => {
    if (!canApplySpec || !isMutableVehicle(vehicle)) {
      return
    }
    void props.onDeployFleet(
      replaceInDeployment({
        currentType: vehicle.type,
        nextType: draftType,
        profiles: props.profiles,
        vehicles: props.dashboard.vehicles,
      }),
    )
    props.onClose()
  }

  return (
    <div
      aria-label={`${vehicle.id} 자산 작업 메뉴`}
      className="asset-context-menu"
      role="menu"
      style={{ left: props.menu.x, top: props.menu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="asset-context-head">
        <span>
          <strong>{vehicle.id}</strong>
          <small>{vehicleTypeLabel(vehicle.type)}</small>
        </span>
        <button
          aria-label="자산 메뉴 닫기"
          className="button icon-button"
          type="button"
          onClick={props.onClose}
        >
          <X size={13} />
        </button>
      </div>
      <p className="asset-context-meta">
        {targetLabel(vehicle.area)} / {capabilityLabel(vehicle.role)}
      </p>
      <button
        aria-label={`${vehicle.id} 제거`}
        className="button danger asset-context-action"
        disabled={!canRemove}
        type="button"
        onClick={removeVehicle}
      >
        <Trash2 size={14} />
        제거
      </button>
      <fieldset className="asset-spec-editor">
        <legend>
          <Settings2 size={13} />
          스펙 수정
        </legend>
        <label>
          <span>자산 유형</span>
          <select
            disabled={!canMutate}
            value={draftType}
            onChange={(event) => {
              if (isDeployableVehicleType(event.currentTarget.value)) {
                setDraftType(event.currentTarget.value)
              }
            }}
          >
            {props.profiles.map((profile) => (
              <option key={profile.vehicle_type} value={profile.vehicle_type}>
                {vehicleTypeLabel(profile.vehicle_type)}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label={`${vehicle.id} 스펙 적용`}
          className="button"
          disabled={!canApplySpec}
          type="button"
          onClick={applySpecChange}
        >
          적용
        </button>
      </fieldset>
      {!canMutate ? (
        <p className="asset-context-note">합성 자산은 직접 편집 대상이 아닙니다.</p>
      ) : null}
    </div>
  )
}

function isMutableVehicle(vehicle: Vehicle): vehicle is Vehicle & { readonly type: VehicleType } {
  return !vehicle.synthetic && isDeployableVehicleType(vehicle.type)
}

function removeFromDeployment(
  vehicles: readonly Vehicle[],
  profiles: readonly VehicleTypeProfile[],
  vehicleType: VehicleType,
): FleetDeploymentPayload {
  return deploymentFromVehicles(vehicles, profiles)
    .map((item) =>
      item.vehicle_type === vehicleType ? { ...item, count: Math.max(0, item.count - 1) } : item,
    )
    .filter((item) => item.count > 0)
}

function replaceInDeployment(request: {
  readonly currentType: VehicleType
  readonly nextType: VehicleType
  readonly profiles: readonly VehicleTypeProfile[]
  readonly vehicles: readonly Vehicle[]
}): FleetDeploymentPayload {
  return deploymentFromVehicles(request.vehicles, request.profiles)
    .map((item) => {
      if (item.vehicle_type === request.currentType) {
        return { ...item, count: Math.max(0, item.count - 1) }
      }
      if (item.vehicle_type === request.nextType) {
        return { ...item, count: item.count + 1 }
      }
      return item
    })
    .filter((item) => item.count > 0)
}

function deploymentFromVehicles(
  vehicles: readonly Vehicle[],
  profiles: readonly VehicleTypeProfile[],
): FleetDeploymentPayload {
  return profiles.map((profile) => ({
    vehicle_type: profile.vehicle_type,
    count: vehicles.filter((vehicle) => vehicle.type === profile.vehicle_type && !vehicle.synthetic)
      .length,
  }))
}
