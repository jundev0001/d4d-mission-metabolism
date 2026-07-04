import type { CustomMissionIntent } from "../customScenario"

export function MissionIntentControls({
  intent,
  onChange,
}: {
  readonly intent: CustomMissionIntent
  readonly onChange: (intent: CustomMissionIntent) => void
}) {
  function updateConstraints(patch: Partial<CustomMissionIntent["constraints"]>): void {
    onChange({
      ...intent,
      constraints: {
        ...intent.constraints,
        ...patch,
      },
    })
  }

  return (
    <fieldset className="builder-intent-grid">
      <legend>Mission Intent</legend>
      <label className="builder-field range-field">
        <span>Target MCC</span>
        <input
          type="range"
          min={0.6}
          max={0.95}
          step={0.01}
          value={intent.constraints.target_mcc}
          onChange={(event) => updateConstraints({ target_mcc: Number(event.currentTarget.value) })}
        />
        <b>{Math.round(intent.constraints.target_mcc * 100)}%</b>
      </label>
      <label className="builder-field range-field">
        <span>RTB</span>
        <input
          type="range"
          min={0.1}
          max={0.45}
          step={0.01}
          value={intent.constraints.return_battery_threshold}
          onChange={(event) =>
            updateConstraints({ return_battery_threshold: Number(event.currentTarget.value) })
          }
        />
        <b>{Math.round(intent.constraints.return_battery_threshold * 100)}%</b>
      </label>
      <label className="builder-field range-field">
        <span>Autonomy</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intent.autonomy_level}
          onChange={(event) =>
            onChange({ ...intent, autonomy_level: Number(event.currentTarget.value) })
          }
        />
        <b>{Math.round(intent.autonomy_level * 100)}%</b>
      </label>
      <label className="builder-field">
        <span>Relay min</span>
        <input
          type="number"
          min={0}
          max={4}
          value={intent.constraints.min_relay_redundancy}
          onChange={(event) =>
            updateConstraints({
              min_relay_redundancy: Math.min(4, Math.max(0, Number(event.currentTarget.value))),
            })
          }
        />
      </label>
      <label className="builder-field builder-checkbox-field">
        <span>Gate</span>
        <input
          type="checkbox"
          checked={intent.constraints.human_approval_for_replan}
          onChange={(event) =>
            updateConstraints({ human_approval_for_replan: event.currentTarget.checked })
          }
        />
        <b>Human approval</b>
      </label>
    </fieldset>
  )
}
