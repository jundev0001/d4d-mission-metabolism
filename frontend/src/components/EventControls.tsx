import { BatteryWarning, Bell, MapPinOff, Radio, Satellite, WifiOff } from "lucide-react"
import { eventLabel, targetLabel } from "../format"
import { useMissionStore } from "../store"
import type { EventPayload } from "../types"

type ScenarioEvent = {
  readonly payload: EventPayload
  readonly icon: React.ReactNode
}

const EVENTS: readonly ScenarioEvent[] = [
  { payload: { event_type: "comm_jam", target: "B", severity: 0.82 }, icon: <Radio size={15} /> },
  {
    payload: { event_type: "battery_drop", target: "UxV-02", severity: 0.9 },
    icon: <BatteryWarning size={15} />,
  },
  {
    payload: { event_type: "comm_degraded", target: "UxV-03", severity: 0.74 },
    icon: <WifiOff size={15} />,
  },
  {
    payload: { event_type: "gps_drop", target: "UxV-05", severity: 0.7 },
    icon: <Satellite size={15} />,
  },
  { payload: { event_type: "no_go", target: "B", severity: 0.68 }, icon: <MapPinOff size={15} /> },
  {
    payload: { event_type: "alert_flood", target: "operator", severity: 0.72 },
    icon: <Bell size={15} />,
  },
] as const

export function EventControls() {
  const injectEvent = useMissionStore((state) => state.injectEvent)

  return (
    <section className="panel event-panel">
      <div className="panel-title">
        <span>시나리오 이벤트</span>
        <span className="caption">안전 스크립트</span>
      </div>
      <div className="event-grid">
        {EVENTS.map((event) => (
          <button
            className="button event-button"
            type="button"
            key={`${event.payload.event_type}-${event.payload.target}`}
            onClick={() => void injectEvent(event.payload)}
          >
            {event.icon}
            <span className="event-copy">
              <span>{eventLabel(event.payload.event_type)}</span>
              <span className="caption">{targetLabel(event.payload.target)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
