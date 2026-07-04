import { useState } from "react"
import { useMissionStore } from "../store"
import { BlackBoxPanel } from "./BlackBoxPanel"
import { EventControls } from "./EventControls"
import { FleetDeploymentPanel } from "./FleetDeploymentPanel"
import { type ScenarioBuilderMode, ScenarioBuilderPanel } from "./ScenarioBuilderPanel"

type ScenarioWorkflowStep = "fleet" | ScenarioBuilderMode

const WORKFLOW_STEPS: readonly {
  readonly caption: string
  readonly label: string
  readonly step: ScenarioWorkflowStep
}[] = [
  {
    step: "fleet",
    label: "1 최초 UxV 선정",
    caption: "상태 점검과 임무 능력 기준 편성",
  },
  {
    step: "map",
    label: "2 구역(지도) 커스텀",
    caption: "구역 생성, 이름, 임무 예산",
  },
  {
    step: "events",
    label: "3 이벤트 플로우차트",
    caption: "구역/기기 이벤트 노드 연결",
  },
] as const

export function ScenarioWorkspace() {
  const [activeStep, setActiveStep] = useState<ScenarioWorkflowStep>("fleet")
  const dashboard = useMissionStore((state) => state.dashboard)
  const scenario = useMissionStore((state) => state.customScenario)
  const assignments = dashboard?.assignments.length ?? 0
  const realAssets = dashboard?.vehicles.filter((vehicle) => !vehicle.synthetic).length ?? 0
  const status = {
    events: `${scenario.scenario.nodes.length}개 노드 / ${scenario.scenario.edges.length}개 연결`,
    fleet: assignments > 0 ? "편성 승인 완료" : `${realAssets}대 대기`,
    map: `${scenario.map.areas.length}개 구역`,
  } satisfies Record<ScenarioWorkflowStep, string>

  return (
    <section className="scenario-workspace" aria-label="시나리오 작업면">
      <nav className="scenario-stepper-strip" aria-label="시나리오 설계 단계">
        <span className="scenario-stepper-heading">통합 시나리오 설계</span>
        <div className="scenario-step-list">
          {WORKFLOW_STEPS.map((item) => (
            <button
              className={`scenario-step-button ${item.step === activeStep ? "active" : ""}`}
              type="button"
              key={item.step}
              aria-pressed={item.step === activeStep}
              onClick={() => setActiveStep(item.step)}
            >
              <span>{item.label}</span>
              <small>{item.caption}</small>
              <b>{status[item.step]}</b>
            </button>
          ))}
        </div>
      </nav>

      <section className="scenario-workflow-shell">
        <section className="scenario-stage-main" aria-live="polite">
          {activeStep === "fleet" ? <FleetDeploymentPanel /> : null}
          {activeStep === "map" ? <ScenarioBuilderPanel mode="map" /> : null}
          {activeStep === "events" ? <ScenarioBuilderPanel mode="events" /> : null}
        </section>

        <aside className="scenario-support-rail">
          <section className="panel scenario-status-panel" aria-label="시나리오 진행 상태">
            <div className="panel-title">
              <span>진행 상태</span>
              <span className="caption">{status[activeStep]}</span>
            </div>
            <dl className="scenario-status-grid">
              <div>
                <dt>UxV</dt>
                <dd>{realAssets}대</dd>
              </div>
              <div>
                <dt>편성</dt>
                <dd>{assignments}개</dd>
              </div>
              <div>
                <dt>구역</dt>
                <dd>{scenario.map.areas.length}개</dd>
              </div>
              <div>
                <dt>이벤트</dt>
                <dd>{scenario.scenario.nodes.length}개</dd>
              </div>
            </dl>
          </section>
          {activeStep === "events" ? <EventControls /> : null}
          <BlackBoxPanel />
        </aside>
      </section>
    </section>
  )
}
