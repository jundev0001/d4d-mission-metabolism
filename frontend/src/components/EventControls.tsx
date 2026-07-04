import { BatteryWarning, Bell, MapPinOff, Radio, Satellite, WifiOff } from "lucide-react"
import { eventLabel } from "../format"
import { useMissionStore } from "../store"
import type { EventPayload } from "../types"

const EVENTS: readonly (EventPayload & { readonly icon: React.ReactNode })[] = [
  { event_type: "comm_jam", target: "B", severity: 0.82, icon: <Radio size={15} /> },
  {
    event_type: "battery_drop",
    target: "UxV-02",
    severity: 0.9,
    icon: <BatteryWarning size={15} />,
  },
  { event_type: "comm_degraded", target: "UxV-03", severity: 0.74, icon: <WifiOff size={15} /> },
  { event_type: "gps_drop", target: "UxV-05", severity: 0.7, icon: <Satellite size={15} /> },
  { event_type: "no_go", target: "B", severity: 0.68, icon: <MapPinOff size={15} /> },
  { event_type: "alert_flood", target: "operator", severity: 0.72, icon: <Bell size={15} /> },
] as const

export function EventControls() {
  const injectEvent = useMissionStore((state) => state.injectEvent)

  return (
    <section className="panel">
      <div className="panel-title">
        <span>Event Injector</span>
        <span className="caption">script-safe</span>
      </div>
      <div className="event-grid">
        {EVENTS.map((event) => (
          <button
            className="button event-button"
            type="button"
            key={`${event.event_type}-${event.target}`}
            onClick={() => void injectEvent(event)}
          >
            {event.icon}
            <span>{eventLabel(event.event_type)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
