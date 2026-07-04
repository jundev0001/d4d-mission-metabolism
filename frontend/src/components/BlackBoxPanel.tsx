import { Database } from "lucide-react"
import { blackBoxKindLabel, blackBoxSummaryLabel, formatPercent } from "../format"
import { useMissionStore } from "../store"
import { type BlackBoxEntry, type CalculationTrace, CalculationTraceSchema } from "../types"

export function BlackBoxPanel() {
  const replay = useMissionStore((state) => state.replay)
  const selectedReplayIndex = useMissionStore((state) => state.selectedReplayIndex)
  const selectReplayIndex = useMissionStore((state) => state.selectReplayIndex)
  const selectedEntry = replay[selectedReplayIndex] ?? replay[0] ?? null
  const selectedTrace =
    (selectedEntry === null ? null : parseCalculationTrace(selectedEntry)) ??
    latestCalculationTrace(replay)

  return (
    <section className="panel blackbox-panel" data-testid="black-box-panel">
      <div className="panel-title">
        <h2>계산 로그</h2>
        <span className="caption">{replay.length}개 기록</span>
      </div>
      <CalculationTraceDetail trace={selectedTrace} />
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

function CalculationTraceDetail({ trace }: { readonly trace: CalculationTrace | null }) {
  if (trace === null) {
    return (
      <div className="calculation-detail empty-state">
        <Database size={18} aria-hidden="true" />
        <span>선택된 계산 근거 없음</span>
      </div>
    )
  }

  return (
    <section className="calculation-detail" aria-label="선택 계산 상세">
      <div className="calculation-trigger">
        <span className="kind">trigger</span>
        <strong>{trace.trigger}</strong>
      </div>
      <div className="calculation-grid">
        <span>MCC {formatPercent(trace.mcc)}</span>
        <span>Baseline {formatPercent(trace.baseline_mcc)}</span>
        <span>붕괴 {formatPercent(trace.collapse_probability)}</span>
        <span>부채 {Math.round(trace.autonomy_debt)}</span>
        <span>CCR 외부 {trace.ccr_external.toFixed(1)}x</span>
        <span>배정 {trace.assigned_assets}</span>
      </div>
      <fieldset className="area-calculation-row">
        <legend className="sr-only">구역별 MCC</legend>
        {Object.entries(trace.area_mcc).map(([area, value]) => (
          <span key={area}>
            {area} {formatPercent(value)}
          </span>
        ))}
      </fieldset>
    </section>
  )
}

function parseCalculationTrace(entry: BlackBoxEntry): CalculationTrace | null {
  if (entry.kind !== "calculation") {
    return null
  }
  let payload: unknown
  try {
    payload = JSON.parse(entry.payload_json)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }
    throw error
  }
  const parsed = CalculationTraceSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

function latestCalculationTrace(replay: readonly BlackBoxEntry[]): CalculationTrace | null {
  for (const entry of replay.toReversed()) {
    const trace = parseCalculationTrace(entry)
    if (trace !== null) {
      return trace
    }
  }
  return null
}
