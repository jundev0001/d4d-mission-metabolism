import type { CapabilityName, EventType, MicroActionType } from "./types"

const CAPABILITY_LABELS: Record<CapabilityName, string> = {
  visual_recon: "영상 정찰",
  relay: "중계",
  overwatch: "감시",
  gps_denied_nav: "GPS 거부 항법",
  reserve: "예비",
}

const EVENT_LABELS: Record<string, string> = {
  comm_jam: "통신 재밍",
  gps_drop: "GPS 저하",
  battery_drop: "배터리 급락",
  sensor_fail: "센서 고장",
  vehicle_lost: "기체 손실",
  alert_flood: "경보 폭주",
  comm_degraded: "링크 저하",
  no_go: "No-go 생성",
  priority_shift: "우선순위 변경",
}

const MICRO_ACTION_LABELS: Record<MicroActionType, string> = {
  return: "복귀",
  replace: "예비 투입",
  reposition_relay: "중계 재배치",
  low_bandwidth: "저대역 모드",
  hold: "저속 대기",
  suppress_alerts: "경보 병합",
  redistribute_coverage: "커버리지 재분배",
}

const CAUSE_LABELS: Record<string, string> = {
  alert_flood: "경보 폭주",
  battery_drop: "배터리 급락",
  capability_deficit: "능력 결손",
  comm_degraded: "링크 저하",
  comm_jam: "통신 재밍",
  coverage_gap: "커버리지 공백",
  gps_drop: "GPS 저하",
  human_gate: "사람 개입",
  navigation_uncertainty: "항법 불확실성",
  no_go: "No-go 제약",
  operator_load: "인지부하",
  priority_shift: "우선순위 변경",
  recon_gap: "정찰 공백",
  relay_gap: "중계 공백",
  relay_redundancy: "중계 여유",
  reserve_activation: "예비 전력 투입",
  return_threshold: "복귀 기준",
  sensor_fail: "센서 고장",
  vehicle_lost: "기체 손실",
}

const RECOMMENDATION_TITLES: Record<string, string> = {
  "Alert flood suppression": "경보 폭주 병합",
  "B area mission instability": "B구역 임무 불안정",
}

const STATUS_LABELS: Record<string, string> = {
  approve: "승인",
  approved: "승인됨",
  critical: "긴급",
  high: "높음",
  manual: "수동",
  pending: "대기",
  reject: "거절",
  rejected: "거절됨",
}

const BLACKBOX_KIND_LABELS: Record<string, string> = {
  decision: "판단",
  event: "이벤트",
  mission: "임무",
  outcome: "결과",
  recommendation: "권고",
}

const BLACKBOX_SUMMARIES: Record<string, string> = {
  "metrics recomputed after human gate": "사람 개입 게이트 이후 지표 재계산",
  "mission initialized": "임무 초기화",
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

export function eventLabel(value: EventType): string {
  return EVENT_LABELS[value] ?? fallbackLabel(value)
}

export function microActionLabel(value: MicroActionType): string {
  return MICRO_ACTION_LABELS[value]
}

export function causeLabel(value: string): string {
  return CAUSE_LABELS[value] ?? fallbackLabel(value)
}

export function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? fallbackLabel(value)
}

export function areaLabel(value: string): string {
  return `구역 ${value}`
}

export function targetLabel(value: string): string {
  if (value === "operator") {
    return "운용자"
  }
  if (/^[A-Z]$/.test(value)) {
    return areaLabel(value)
  }
  return value
}

export function missionObjectiveLabel(value: string): string {
  if (value === "Maintain A/B/C ISR continuity") {
    return "A/B/C ISR 연속성 유지"
  }
  if (value === "Maintain A/B/C ISR continuity with B-area relay redundancy") {
    return "A/B/C ISR 연속성과 B구역 중계 여유 유지"
  }
  return value
}

export function recommendationTitleLabel(value: string): string {
  const exact = RECOMMENDATION_TITLES[value]
  if (exact !== undefined) {
    return exact
  }

  const batteryMatch = value.match(/^(.+) below return threshold$/)
  const batteryVehicle = batteryMatch?.[1]
  if (batteryVehicle !== undefined) {
    return `${batteryVehicle} 복귀 기준 미달`
  }

  const linkMatch = value.match(/^(.+) link degraded$/)
  const linkVehicle = linkMatch?.[1]
  if (linkVehicle !== undefined) {
    return `${linkVehicle} 링크 저하`
  }

  const gpsMatch = value.match(/^(.+) GPS-denied fallback$/)
  const gpsVehicle = gpsMatch?.[1]
  if (gpsVehicle !== undefined) {
    return `${gpsVehicle} GPS 거부환경 대응`
  }

  const sensorMatch = value.match(/^(.+) sensor payload failed$/)
  const sensorVehicle = sensorMatch?.[1]
  if (sensorVehicle !== undefined) {
    return `${sensorVehicle} 센서 페이로드 고장`
  }

  const lostMatch = value.match(/^(.+) capability lost$/)
  const lostVehicle = lostMatch?.[1]
  if (lostVehicle !== undefined) {
    return `${lostVehicle} 능력 손실`
  }

  const routeMatch = value.match(/^(.+) route constraint update$/)
  const routeTarget = routeMatch?.[1]
  if (routeTarget !== undefined) {
    return `${targetLabel(routeTarget)} 경로 제약 갱신`
  }

  return value
}

export function blackBoxKindLabel(value: string): string {
  return BLACKBOX_KIND_LABELS[value] ?? fallbackLabel(value)
}

export function blackBoxSummaryLabel(value: string): string {
  const exact = BLACKBOX_SUMMARIES[value]
  if (exact !== undefined) {
    return exact
  }

  const resetMatch = value.match(/^mission reset with seed ([0-9]+)$/)
  const seed = resetMatch?.[1]
  if (seed !== undefined) {
    return `시드 ${seed}로 임무 재설정`
  }

  const eventMatch = value.match(/^(.+) injected for (.+)$/)
  const eventType = eventMatch?.[1]
  const target = eventMatch?.[2]
  if (eventType !== undefined && target !== undefined) {
    return `${targetLabel(target)} 대상 ${fallbackEventLabel(eventType)} 주입`
  }

  const decisionMatch = value.match(/^(approve|reject|manual) (rec-[0-9]+)$/)
  const decision = decisionMatch?.[1]
  const recommendationId = decisionMatch?.[2]
  if (decision !== undefined && recommendationId !== undefined) {
    return `${recommendationId} ${statusLabel(decision)}`
  }

  const resolvedRecommendationMatch = value.match(/^(approved|rejected|manual) (.+)$/)
  const recommendationStatus = resolvedRecommendationMatch?.[1]
  const recommendationTitle = resolvedRecommendationMatch?.[2]
  if (recommendationStatus !== undefined && recommendationTitle !== undefined) {
    return `${recommendationTitleLabel(recommendationTitle)} ${statusLabel(recommendationStatus)}`
  }

  return recommendationTitleLabel(value)
}

function fallbackEventLabel(value: string): string {
  return EVENT_LABELS[value] ?? fallbackLabel(value)
}

function fallbackLabel(value: string): string {
  return value.replaceAll("_", " ")
}
