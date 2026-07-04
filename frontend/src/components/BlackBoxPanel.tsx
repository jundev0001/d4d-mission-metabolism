import { Database } from "lucide-react"
import { useMissionStore } from "../store"

export function BlackBoxPanel() {
  const replay = useMissionStore((state) => state.replay)
  const selectedReplayIndex = useMissionStore((state) => state.selectedReplayIndex)
  const selectReplayIndex = useMissionStore((state) => state.selectReplayIndex)

  return (
    <section className="panel blackbox-panel" data-testid="black-box-panel">
      <div className="panel-title">
        <span>Mission Black Box</span>
        <span className="caption">{replay.length} entries</span>
      </div>
      {replay.length === 0 ? (
        <div className="empty-state">
          <Database size={18} aria-hidden="true" />
          <span>Timeline awaiting mission events</span>
        </div>
      ) : (
        <ol className="blackbox-list">
          {replay.map((entry, index) => (
            <li key={entry.id}>
              <button
                className={index === selectedReplayIndex ? "blackbox-row selected" : "blackbox-row"}
                type="button"
                onClick={() => selectReplayIndex(index)}
              >
                <span className="mono">T+{entry.scenario_time}s</span>
                <span className="kind">{entry.kind}</span>
                <span>{entry.summary}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
