import { Boxes, Trash2 } from "lucide-react"
import { capabilityLabel, targetLabel } from "../format"
import type { Vehicle } from "../types"
import { isDeployableVehicleType, type VehicleType, vehicleTypeLabel } from "../vehicleDeployment"

type FleetAssetListProps = {
  readonly canRemove: boolean
  readonly minCount: number
  readonly onRemove: (vehicleType: VehicleType) => void
  readonly totalCount: number
  readonly vehicles: readonly Vehicle[]
}

export function FleetAssetList(props: FleetAssetListProps) {
  const removableVehicles = props.vehicles.filter(isRemovableVehicle)
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
        {removableVehicles.map((vehicle) => (
          <div className="deployed-asset-row" key={vehicle.id}>
            <Boxes size={14} />
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
                removeEnabled ? `${vehicle.id} 삭제` : `최소 ${props.minCount}대는 유지해야 합니다`
              }
              type="button"
              onClick={() => props.onRemove(vehicle.type)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </fieldset>
  )
}

function isRemovableVehicle(vehicle: Vehicle): vehicle is Vehicle & { readonly type: VehicleType } {
  return !vehicle.synthetic && isDeployableVehicleType(vehicle.type)
}
