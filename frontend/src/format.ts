import type { CapabilityName } from "./types"

const CAPABILITY_LABELS: Record<CapabilityName, string> = {
  visual_recon: "Visual recon",
  relay: "Relay",
  overwatch: "Overwatch",
  gps_denied_nav: "GPS-denied nav",
  reserve: "Reserve",
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${Math.round(value * 100)}pp`
}

export function formatSignedNumber(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${Math.round(value)}`
}

export function capabilityLabel(capability: CapabilityName): string {
  return CAPABILITY_LABELS[capability]
}

export function eventLabel(value: string): string {
  return value.replaceAll("_", " ")
}
