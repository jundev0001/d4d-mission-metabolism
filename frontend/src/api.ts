import ky from "ky"
import {
  type DashboardState,
  DashboardStateSchema,
  type DecisionPayload,
  type EventPayload,
  type ReplayResponse,
  ReplayResponseSchema,
} from "./types"
import {
  type FleetDeploymentPayload,
  type VehicleTypeCatalogResponse,
  VehicleTypeCatalogResponseSchema,
} from "./vehicleDeployment"

const API_BASE = import.meta.env["VITE_API_BASE_URL"] ?? "http://127.0.0.1:8000"

const client = ky.create({
  prefix: API_BASE,
  timeout: 6000,
  retry: {
    limit: 1,
    methods: ["get", "post"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
})

export async function fetchDashboardState(): Promise<DashboardState> {
  const payload = await client.get("").json()
  return DashboardStateSchema.parse(payload)
}

export async function resetMission(seed: number): Promise<DashboardState> {
  const payload = await client.post("mission", { json: { seed } }).json()
  return DashboardStateSchema.parse(payload)
}

export async function fetchVehicleTypes(): Promise<VehicleTypeCatalogResponse> {
  const payload = await client.get("vehicle/types").json()
  return VehicleTypeCatalogResponseSchema.parse(payload)
}

export async function deployFleet(items: FleetDeploymentPayload): Promise<DashboardState> {
  const payload = await client.post("fleet/deploy", { json: { items } }).json()
  return DashboardStateSchema.parse(payload)
}

export async function injectEvent(event: EventPayload): Promise<DashboardState> {
  const payload = await client.post("event/inject", { json: event }).json()
  return DashboardStateSchema.parse(payload)
}

export async function sendDecision(decision: DecisionPayload): Promise<DashboardState> {
  const payload = await client.post("decision", { json: decision }).json()
  return DashboardStateSchema.parse(payload)
}

export async function fetchReplay(): Promise<ReplayResponse> {
  const payload = await client.get("replay").json()
  return ReplayResponseSchema.parse(payload)
}

export function websocketUrl(): string {
  const url = new URL(API_BASE)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/ws/state"
  return url.toString()
}
