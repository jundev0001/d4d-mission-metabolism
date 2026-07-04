import { Play, RotateCcw, ShieldCheck } from "lucide-react"
import { useMissionStore } from "../store"

export function Header() {
  const dashboard = useMissionStore((state) => state.dashboard)
  const reset = useMissionStore((state) => state.reset)
  const runScriptedDemo = useMissionStore((state) => state.runScriptedDemo)
  const isRunningDemo = useMissionStore((state) => state.isRunningDemo)

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="caption">D4D Multi-UxV Control</p>
          <h1>Capability Mission OS</h1>
        </div>
      </div>
      <div className="mission-summary">
        <span>{dashboard?.mission.objective ?? "Mission loading"}</span>
        <span className="mono">T+{dashboard?.scenario_time ?? 0}s</span>
      </div>
      <div className="toolbar">
        <button className="button secondary" type="button" onClick={() => void reset()}>
          <RotateCcw size={15} aria-hidden="true" />
          Reset
        </button>
        <button
          className="button primary"
          type="button"
          disabled={isRunningDemo}
          onClick={() => void runScriptedDemo()}
        >
          <Play size={15} aria-hidden="true" />
          {isRunningDemo ? "Running" : "Run Demo"}
        </button>
      </div>
    </header>
  )
}
