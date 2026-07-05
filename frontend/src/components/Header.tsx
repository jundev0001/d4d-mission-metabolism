import { Play, RotateCcw, ShieldCheck } from "lucide-react"
import { formatPercent, missionObjectiveLabel } from "../format"
import { useMissionStore } from "../store"

export function Header() {
  const dashboard = useMissionStore((state) => state.dashboard)
  const reset = useMissionStore((state) => state.reset)
  const runScriptedDemo = useMissionStore((state) => state.runScriptedDemo)
  const approveInitialDeployment = useMissionStore((state) => state.approveInitialDeployment)
  const initialDeploymentApproval = useMissionStore((state) => state.initialDeploymentApproval)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)
  const isWaitingForDeploymentApproval = initialDeploymentApproval === "pending"
  const targetMcc = dashboard?.mission.constraints.target_mcc ?? 0.8
  const relayRedundancy = dashboard?.mission.constraints.min_relay_redundancy ?? 1
  const returnThreshold = dashboard?.mission.constraints.return_battery_threshold ?? 0.2

  return (
    <header className="mission-bar">
      <div className="mission-title">
        <h1>D4D 임무 메타볼리즘</h1>
        <span className="mission-clock">T+{dashboard?.scenario_time ?? 0}s</span>
      </div>
      <div className="mission-intent">
        <span className="mission-objective">
          {dashboard ? missionObjectiveLabel(dashboard.mission.objective) : "임무 로딩 중"}
        </span>
        <span className="mission-constraints">
          {"MCC 목표 "}
          {formatPercent(targetMcc)}
          {" / B구역 중계 "}
          {relayRedundancy}
          {" 이상 / 복귀 기준 "}
          {formatPercent(returnThreshold)}
        </span>
      </div>
      <div className="toolbar">
        <button className="button secondary" type="button" onClick={() => void reset()}>
          <RotateCcw size={15} aria-hidden="true" />
          초기화
        </button>
        <button
          className="button primary"
          type="button"
          disabled={isRunningDemo && !isWaitingForDeploymentApproval}
          onClick={() => {
            if (isWaitingForDeploymentApproval) {
              void approveInitialDeployment()
              return
            }
            void runScriptedDemo()
          }}
        >
          {isWaitingForDeploymentApproval ? (
            <ShieldCheck size={15} aria-hidden="true" />
          ) : (
            <Play size={15} aria-hidden="true" />
          )}
          {isWaitingForDeploymentApproval ? "전개 승인" : isRunningDemo ? "실행 중" : "데모 실행"}
        </button>
      </div>
    </header>
  )
}
