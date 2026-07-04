import { Send } from "lucide-react"
import { useState } from "react"
import { eventLabel, targetLabel } from "../format"
import { useMissionStore } from "../store"
import { type DashboardState, type EventType, EventTypes } from "../types"

const AREA_TARGET_EVENTS: readonly EventType[] = [
  "comm_jam",
  "no_go",
  "priority_shift",
  "data_stale",
  "target_detected",
  "weather_degraded",
  "reserve_depleted",
]

const VEHICLE_TARGET_EVENTS: readonly EventType[] = [
  "gps_drop",
  "battery_drop",
  "sensor_fail",
  "vehicle_lost",
  "comm_degraded",
]

export function EventControls() {
  const dashboard = useMissionStore((state) => state.dashboard)
  const injectEvent = useMissionStore((state) => state.injectEvent)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)
  const [eventType, setEventType] = useState<EventType>("comm_jam")
  const [target, setTarget] = useState("B")
  const [severity, setSeverity] = useState(0.72)
  const targetOptions = targetsForEventType(eventType, dashboard)
  const selectedTarget = targetOptions.includes(target) ? target : (targetOptions.at(0) ?? "B")
  const canInject = (dashboard?.assignments.length ?? 0) > 0 && !isRunningDemo

  return (
    <section className="panel event-panel">
      <div className="panel-title">
        <span>Inject event</span>
        <span className="caption">
          {canInject ? "Adaptive response" : "편성 승인 후 이벤트 주입 가능"}
        </span>
      </div>
      <div className="event-form">
        <label className="builder-field">
          <span>Event</span>
          <select
            value={eventType}
            onChange={(event) => {
              const next = EventTypes.find((value) => value === event.currentTarget.value)
              if (next !== undefined) {
                setEventType(next)
              }
            }}
          >
            {EventTypes.map((value) => (
              <option value={value} key={value}>
                {eventLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span>Target</span>
          <select value={selectedTarget} onChange={(event) => setTarget(event.currentTarget.value)}>
            {targetOptions.map((value) => (
              <option value={value} key={value}>
                {targetLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field range-field">
          <span>Severity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={severity}
            onChange={(event) => setSeverity(Number(event.currentTarget.value))}
          />
          <b>{severity.toFixed(2)}</b>
        </label>
        <button
          className="button primary"
          type="button"
          disabled={!canInject}
          onClick={() =>
            void injectEvent({
              event_type: eventType,
              target: selectedTarget,
              severity,
            })
          }
        >
          <Send size={15} />
          Inject
        </button>
      </div>
    </section>
  )
}

function targetsForEventType(
  eventType: EventType,
  dashboard: DashboardState | null,
): readonly string[] {
  if (AREA_TARGET_EVENTS.includes(eventType)) {
    return dashboard?.mission.areas.length ? dashboard.mission.areas : ["B"]
  }
  if (VEHICLE_TARGET_EVENTS.includes(eventType)) {
    return dashboard?.vehicles.length ? dashboard.vehicles.map((vehicle) => vehicle.id) : ["UxV-02"]
  }
  return ["operator"]
}
