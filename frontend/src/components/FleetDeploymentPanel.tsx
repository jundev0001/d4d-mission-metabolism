import { Minus, Plus, Send } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { capabilityLabel } from "../format"
import { mapAssetIconHref } from "../mapAssetIcons"
import { useMissionStore } from "../store"
import type {
  FleetDeploymentItem,
  FleetDeploymentPayload,
  VehicleType,
  VehicleTypeProfile,
} from "../vehicleDeployment"
import { vehicleTypeLabel } from "../vehicleDeployment"
import { FleetAssetList } from "./FleetAssetList"

const MIN_DEPLOYED_ASSETS = 5
const MAX_COUNT_PER_TYPE = 12

export function FleetDeploymentPanel() {
  const dashboard = useMissionStore((state) => state.dashboard)
  const deployFleet = useMissionStore((state) => state.deployFleet)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)
  const profiles = useMissionStore((state) => state.vehicleTypeProfiles)
  const tuneVehicle = useMissionStore((state) => state.tuneVehicle)
  const baselineDraft = useMemo(
    () => deploymentDraftFrom(profiles, dashboard?.vehicles ?? []),
    [dashboard?.vehicles, profiles],
  )
  const [draft, setDraft] = useState<readonly FleetDeploymentItem[]>(baselineDraft)
  const totalCount = draft.reduce((sum, item) => sum + item.count, 0)
  const canDeploy = totalCount >= MIN_DEPLOYED_ASSETS && !isRunningDemo
  const canRemove = totalCount > MIN_DEPLOYED_ASSETS && !isRunningDemo

  useEffect(() => {
    setDraft(baselineDraft)
  }, [baselineDraft])

  const removeVehicle = (vehicleType: VehicleType) => {
    const nextDraft = changeCount(draft, vehicleType, countFor(draft, vehicleType) - 1)
    setDraft(nextDraft)
    if (deploymentTotal(nextDraft) >= MIN_DEPLOYED_ASSETS) {
      void deployFleet(compactDeployment(nextDraft))
    }
  }

  return (
    <section className="panel deployment-panel">
      <div className="panel-title">
        <span>UxV 배치 구성</span>
        <span className="caption">합계 {totalCount}대</span>
      </div>
      <div className="deployment-list">
        {profiles.map((profile) => (
          <DeploymentRow
            draft={draft}
            key={profile.vehicle_type}
            profile={profile}
            onCountChange={setDraft}
          />
        ))}
      </div>
      <FleetAssetList
        canRemove={canRemove}
        isRunningDemo={isRunningDemo}
        minCount={MIN_DEPLOYED_ASSETS}
        onRemove={removeVehicle}
        onTuneVehicle={(payload) => void tuneVehicle(payload)}
        totalCount={totalCount}
        vehicles={dashboard?.vehicles ?? []}
      />
      <div className="deployment-actions">
        <span className={canDeploy ? "caption" : "caption deployment-warning"}>
          최소 {MIN_DEPLOYED_ASSETS}대 이상
        </span>
        <button
          className="button primary"
          type="button"
          disabled={!canDeploy}
          onClick={() => void deployFleet(compactDeployment(draft))}
        >
          <Send size={14} />
          맵에 배치
        </button>
      </div>
    </section>
  )
}

function DeploymentRow({
  draft,
  onCountChange,
  profile,
}: {
  readonly draft: readonly FleetDeploymentItem[]
  readonly onCountChange: (draft: readonly FleetDeploymentItem[]) => void
  readonly profile: VehicleTypeProfile
}) {
  const count = draft.find((item) => item.vehicle_type === profile.vehicle_type)?.count ?? 0

  return (
    <div className="deployment-row">
      <img
        alt=""
        aria-hidden="true"
        className="deployment-vehicle-icon"
        data-testid="deployment-vehicle-type-icon"
        src={mapAssetIconHref(profile.vehicle_type)}
      />
      <span className="deployment-copy">
        <strong>{vehicleTypeLabel(profile.vehicle_type)}</strong>
        <small>{capabilityLabel(profile.primary_role)}</small>
      </span>
      <span className="deployment-stepper">
        <button
          className="button"
          type="button"
          aria-label={`${vehicleTypeLabel(profile.vehicle_type)} 줄이기`}
          onClick={() => onCountChange(changeCount(draft, profile.vehicle_type, count - 1))}
        >
          <Minus size={13} />
        </button>
        <input
          aria-label={`${vehicleTypeLabel(profile.vehicle_type)} 대수`}
          min={0}
          max={MAX_COUNT_PER_TYPE}
          type="number"
          value={count}
          onChange={(event) =>
            onCountChange(
              changeCount(draft, profile.vehicle_type, Number(event.currentTarget.value)),
            )
          }
        />
        <button
          className="button"
          type="button"
          aria-label={`${vehicleTypeLabel(profile.vehicle_type)} 늘리기`}
          onClick={() => onCountChange(changeCount(draft, profile.vehicle_type, count + 1))}
        >
          <Plus size={13} />
        </button>
      </span>
    </div>
  )
}

function deploymentDraftFrom(
  profiles: readonly VehicleTypeProfile[],
  vehicles: readonly { readonly type: string; readonly synthetic: boolean }[],
): readonly FleetDeploymentItem[] {
  return profiles.map((profile) => ({
    vehicle_type: profile.vehicle_type,
    count: vehicles.filter((vehicle) => vehicle.type === profile.vehicle_type && !vehicle.synthetic)
      .length,
  }))
}

function changeCount(
  draft: readonly FleetDeploymentItem[],
  vehicleType: VehicleType,
  count: number,
): readonly FleetDeploymentItem[] {
  const nextCount = Math.min(Math.max(count, 0), MAX_COUNT_PER_TYPE)
  return draft.map((item) =>
    item.vehicle_type === vehicleType ? { ...item, count: nextCount } : item,
  )
}

function countFor(draft: readonly FleetDeploymentItem[], vehicleType: VehicleType): number {
  return draft.find((item) => item.vehicle_type === vehicleType)?.count ?? 0
}

function deploymentTotal(draft: readonly FleetDeploymentItem[]): number {
  return draft.reduce((sum, item) => sum + item.count, 0)
}

function compactDeployment(draft: readonly FleetDeploymentItem[]): FleetDeploymentPayload {
  return draft.filter((item) => item.count > 0)
}
