import { type DashboardState, DashboardStateSchema } from "./types"

const LIVE_FALLBACK_INTERVAL_MS = 3000

type LiveDashboardConnection = {
  readonly fetchDashboardState: () => Promise<DashboardState>
  readonly onDashboard: (dashboard: DashboardState) => void
  readonly onError: (message: string) => void
  readonly websocketUrl: string
}

export function connectLiveDashboard(request: LiveDashboardConnection): () => void {
  const socket = new WebSocket(request.websocketUrl)
  let closedByClient = false
  let fallbackTimer: ReturnType<typeof setInterval> | null = null
  const pollSnapshot = () => {
    void request
      .fetchDashboardState()
      .then(request.onDashboard)
      .catch((error) => {
        request.onError(error instanceof Error ? error.message : "Unknown dashboard error")
      })
  }
  const startFallback = () => {
    if (closedByClient || fallbackTimer !== null) {
      return
    }
    request.onError("Live stream unavailable; using REST polling")
    pollSnapshot()
    fallbackTimer = setInterval(pollSnapshot, LIVE_FALLBACK_INTERVAL_MS)
  }
  socket.addEventListener("open", () => {
    request.onError("")
  })
  socket.addEventListener("message", (event) => {
    const dashboard = parseDashboardMessage(String(event.data))
    if (dashboard !== null) {
      request.onDashboard(dashboard)
    }
  })
  socket.addEventListener("error", startFallback)
  socket.addEventListener("close", startFallback)
  return () => {
    closedByClient = true
    if (fallbackTimer !== null) {
      clearInterval(fallbackTimer)
    }
    socket.close()
  }
}

function parseDashboardMessage(data: string): DashboardState | null {
  try {
    const payload: unknown = JSON.parse(data)
    const parsed = DashboardStateSchema.safeParse(payload)
    return parsed.success ? parsed.data : null
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}
