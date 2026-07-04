import { Database } from "lucide-react"
import { blackBoxKindLabel, blackBoxSummaryLabel } from "../format"
import { useMissionStore } from "../store"

export function BlackBoxPanel() {
  const replay = useMissionStore((state) => state.replay)
  const selectedReplayIndex = useMissionStore((state) => state.selectedReplayIndex)
  const selectReplayIndex = useMissionStore((state) => state.selectReplayIndex)

  return (
    <section className="panel blackbox-panel" data-testid="black-box-panel">
      <div className="panel-title">
        <span>블랙박스 타임라인</span>
        <span className="caption">{replay.length}개 기록</span>
      </div>
      {replay.length === 0 ? (
        <div className="empty-state">
          <Database size={18} aria-hidden="true" />
          <span>임무 이벤트 대기 중</span>
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
                <span className="kind">{blackBoxKindLabel(entry.kind)}</span>
                <span>{blackBoxSummaryLabel(entry.summary)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
