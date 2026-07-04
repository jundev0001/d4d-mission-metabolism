import { useEffect } from "react"
import { BlackBoxPanel } from "./components/BlackBoxPanel"
import { CapabilityPanel } from "./components/CapabilityPanel"
import { EvaluationPanel } from "./components/EvaluationPanel"
import { EventControls } from "./components/EventControls"
import { Header } from "./components/Header"
import { MapView } from "./components/MapView"
import { MetricStrip } from "./components/MetricStrip"
import { RecommendationPanel } from "./components/RecommendationPanel"
import { useMissionStore } from "./store"
import "./App.css"

export function App() {
  const hydrate = useMissionStore((state) => state.hydrate)
  const isLoading = useMissionStore((state) => state.isLoading)
  const error = useMissionStore((state) => state.lastError)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  if (isLoading) {
    return (
      <main className="boot-screen">
        <div className="boot-panel" role="status">
          <span className="pulse-dot" />
          Initializing mission fabric
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Header />
      {error ? <div className="error-banner">{error}</div> : null}
      <MetricStrip />
      <section className="workspace" aria-label="Mission decision workspace">
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
    </main>
  )
}
