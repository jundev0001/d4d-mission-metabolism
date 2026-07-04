import { SlidersHorizontal, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { capabilityLabel, targetLabel } from "../format"
import { mapAssetIconHref } from "../mapAssetIcons"
import type { Vehicle, VehicleStatus, VehicleTunePayload } from "../types"
import { isDeployableVehicleType, type VehicleType, vehicleTypeLabel } from "../vehicleDeployment"

type FleetAssetListProps = {
  readonly canRemove: boolean
  readonly isRunningDemo: boolean
  readonly minCount: number
  readonly onRemove: (vehicleType: VehicleType) => void
  readonly onTuneVehicle: (payload: VehicleTunePayload) => void
  readonly totalCount: number
  readonly vehicles: readonly Vehicle[]
}

type VehicleParameterDraft = {
  readonly battery: number
  readonly comm: number
  readonly nav: number
  readonly sensor: number
  readonly status: VehicleStatus
}

const STATUS_OPTIONS: readonly { readonly label: string; readonly value: VehicleStatus }[] = [
  { label: "임무 중", value: "active" },
  { label: "복귀", value: "returning" },
  { label: "예비", value: "standby" },
  { label: "손실", value: "lost" },
]

export function FleetAssetList(props: FleetAssetListProps) {
  const removableVehicles = useMemo(
    () => props.vehicles.filter(isRemovableVehicle),
    [props.vehicles],
  )
  const baselineDrafts = useMemo(() => draftsFromVehicles(removableVehicles), [removableVehicles])
  const [drafts, setDrafts] = useState<Record<string, VehicleParameterDraft>>(baselineDrafts)

  useEffect(() => {
    setDrafts(baselineDrafts)
  }, [baselineDrafts])

  if (removableVehicles.length === 0) {
    return null
  }

  const removeEnabled = props.canRemove && props.totalCount > props.minCount
  return (
    <fieldset className="deployed-assets">
      <legend className="deployment-subtitle">
        <span>현재 맵 자산</span>
        <span className="caption">삭제 가능 {removableVehicles.length}대</span>
      </legend>
      <div className="deployed-asset-list">
        {removableVehicles.map((vehicle) => {
          const draft = drafts[vehicle.id] ?? draftFromVehicle(vehicle)
          return (
            <div className="deployed-asset-row" key={vehicle.id}>
              <img
                alt=""
                aria-hidden="true"
                className="deployment-vehicle-icon"
                data-testid="deployed-asset-type-icon"
                src={mapAssetIconHref(vehicle.type)}
              />
              <span className="deployment-copy">
                <strong>{vehicle.id}</strong>
                <small>
                  {vehicleTypeLabel(vehicle.type)} · {targetLabel(vehicle.area)} ·{" "}
                  {capabilityLabel(vehicle.role)}
                </small>
              </span>
              <button
                aria-label={`${vehicle.id} 삭제`}
                className="button danger deployed-asset-remove"
                disabled={!removeEnabled}
                title={
                  removeEnabled
                    ? `${vehicle.id} 삭제`
                    : `최소 ${props.minCount}대는 유지해야 합니다`
                }
                type="button"
                onClick={() => props.onRemove(vehicle.type)}
              >
                <Trash2 size={13} />
              </button>
              <div className="vehicle-param-controls">
                <VehiclePercentInput
                  label="배터리"
                  value={draft.battery}
                  vehicleId={vehicle.id}
                  onChange={(battery) =>
                    setDrafts((current) => updateDraft(current, vehicle, { battery }))
                  }
                />
                <VehiclePercentInput
                  label="링크"
                  value={draft.comm}
                  vehicleId={vehicle.id}
                  onChange={(comm) =>
                    setDrafts((current) => updateDraft(current, vehicle, { comm }))
                  }
                />
                <VehiclePercentInput
                  label="항법"
                  value={draft.nav}
                  vehicleId={vehicle.id}
                  onChange={(nav) => setDrafts((current) => updateDraft(current, vehicle, { nav }))}
                />
                <VehiclePercentInput
                  label="센서"
                  value={draft.sensor}
                  vehicleId={vehicle.id}
                  onChange={(sensor) =>
                    setDrafts((current) => updateDraft(current, vehicle, { sensor }))
                  }
                />
                <label className="vehicle-param-field">
                  <span>상태</span>
                  <select
                    aria-label={`${vehicle.id} 상태`}
                    value={draft.status}
                    onChange={(event) => {
                      const status = vehicleStatusFromValue(event.currentTarget.value)
                      if (status !== null) {
                        setDrafts((current) => updateDraft(current, vehicle, { status }))
                      }
                    }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  aria-label={`${vehicle.id} 파라미터 적용`}
                  className="button vehicle-param-apply"
                  disabled={props.isRunningDemo}
                  type="button"
                  onClick={() => props.onTuneVehicle(tunePayloadFor(vehicle, draft))}
                >
                  <SlidersHorizontal size={13} />
                  적용
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function VehiclePercentInput({
  label,
  onChange,
  value,
  vehicleId,
}: {
  readonly label: string
  readonly onChange: (value: number) => void
  readonly value: number
  readonly vehicleId: string
}) {
  return (
    <label className="vehicle-param-field">
      <span>{label}</span>
      <input
        aria-label={`${vehicleId} ${label}`}
        max={100}
        min={0}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <b>{value}%</b>
    </label>
  )
}

function isRemovableVehicle(vehicle: Vehicle): vehicle is Vehicle & { readonly type: VehicleType } {
  return !vehicle.synthetic && isDeployableVehicleType(vehicle.type)
}

function draftsFromVehicles(
  vehicles: readonly (Vehicle & { readonly type: VehicleType })[],
): Record<string, VehicleParameterDraft> {
  const drafts: Record<string, VehicleParameterDraft> = {}
  for (const vehicle of vehicles) {
    drafts[vehicle.id] = draftFromVehicle(vehicle)
  }
  return drafts
}

function draftFromVehicle(vehicle: Vehicle): VehicleParameterDraft {
  return {
    battery: percentFromRatio(vehicle.health.battery),
    comm: percentFromRatio(vehicle.health.comm),
    nav: percentFromRatio(vehicle.health.nav),
    sensor: percentFromRatio(vehicle.health.sensor),
    status: vehicle.status,
  }
}

function updateDraft(
  current: Record<string, VehicleParameterDraft>,
  vehicle: Vehicle,
  patch: Partial<VehicleParameterDraft>,
): Record<string, VehicleParameterDraft> {
  return {
    ...current,
    [vehicle.id]: {
      ...(current[vehicle.id] ?? draftFromVehicle(vehicle)),
      ...patch,
    },
  }
}

function tunePayloadFor(vehicle: Vehicle, draft: VehicleParameterDraft): VehicleTunePayload {
  return {
    health: {
      ...vehicle.health,
      battery: draft.battery / 100,
      comm: draft.comm / 100,
      nav: draft.nav / 100,
      sensor: draft.sensor / 100,
    },
    status: draft.status,
    vehicle_id: vehicle.id,
  }
}

function percentFromRatio(value: number): number {
  return Math.round(value * 100)
}

function vehicleStatusFromValue(value: string): VehicleStatus | null {
  return STATUS_OPTIONS.find((option) => option.value === value)?.value ?? null
}
