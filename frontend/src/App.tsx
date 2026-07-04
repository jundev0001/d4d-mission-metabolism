import { useEffect, useState } from "react"
import { BlackBoxPanel } from "./components/BlackBoxPanel"
import { CapabilityPanel } from "./components/CapabilityPanel"
import { EvaluationPanel } from "./components/EvaluationPanel"
import { EventControls } from "./components/EventControls"
import { Header } from "./components/Header"
import { MapView } from "./components/MapView"
import { MetricStrip } from "./components/MetricStrip"
import { RecommendationPanel } from "./components/RecommendationPanel"
import { ScenarioBuilderPanel } from "./components/ScenarioBuilderPanel"
import { useMissionStore } from "./store"
import "./App.css"

type WorkspaceView = "mission" | "custom"

const WORKSPACE_TABS: readonly {
  readonly view: WorkspaceView
  readonly label: string
  readonly caption: string
}[] = [
  { view: "mission", label: "임무 판단", caption: "실시간 COP" },
  { view: "custom", label: "커스텀 빌더", caption: "맵/시나리오 제작" },
] as const

export function App() {
  const hydrate = useMissionStore((state) => state.hydrate)
  const isLoading = useMissionStore((state) => state.isLoading)
  const error = useMissionStore((state) => state.lastError)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("mission")

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (isLoading) {
    return (
      <main className="boot-screen">
        <div className="boot-panel" role="status">
          <span className="pulse-dot" />
          임무 능력망 초기화 중
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Header />
      {error ? <div className="error-banner">{error}</div> : null}
      <MetricStrip />
      <WorkspaceTabs activeView={workspaceView} onViewChange={setWorkspaceView} />
      {workspaceView === "mission" ? <MissionWorkspace /> : <CustomWorkspace />}
    </main>
  )
}

function WorkspaceTabs({
  activeView,
  onViewChange,
}: {
  readonly activeView: WorkspaceView
  readonly onViewChange: (view: WorkspaceView) => void
}) {
  return (
    <nav className="workspace-tabs" aria-label="작업면 전환">
      {WORKSPACE_TABS.map((tab) => (
        <button
          className={`workspace-tab ${tab.view === activeView ? "active" : ""}`}
          type="button"
          key={tab.view}
          aria-label={tab.label}
          aria-pressed={tab.view === activeView}
          onClick={() => onViewChange(tab.view)}
        >
          <span>{tab.label}</span>
          <small>{tab.caption}</small>
        </button>
      ))}
    </nav>
  )
}

function MissionWorkspace() {
  return (
    <section className="workspace" aria-label="임무 판단 작업면">
      <aside className="left-rail">
        <EventControls />
        <CapabilityPanel />
      </aside>
      <section className="center-stage">
        <MapView />
        <EvaluationPanel />
      </section>
      <aside className="right-rail">
        <RecommendationPanel />
        <BlackBoxPanel />
      </aside>
    </section>
  )
}

function CustomWorkspace() {
  return (
    <section className="custom-workspace" aria-label="커스텀 시나리오 작업면">
      <ScenarioBuilderPanel />
    </section>
  )
}
