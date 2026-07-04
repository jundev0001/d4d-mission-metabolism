import { z } from "zod"
import { type EventPayload, EventTypes } from "./types"

export const ScenarioTargets = [
  "A",
  "B",
  "C",
  "UxV-01",
  "UxV-02",
  "UxV-03",
  "UxV-04",
  "UxV-05",
  "UxV-06",
  "operator",
] as const

const VIEWBOX_HEIGHT = 86
const MIN_AREA_SIZE = 10
const MAX_AREA_SIZE = 68

const Percent = z.number().min(0).max(1)
const Coordinate = z.number().min(0).max(100)
const PointSchema = z.object({ x: Coordinate, y: Coordinate })
const AreaSizeSchema = z.object({
  width: z.number().min(MIN_AREA_SIZE).max(MAX_AREA_SIZE),
  height: z.number().min(MIN_AREA_SIZE).max(MAX_AREA_SIZE),
})

export const CustomMapAreaSchema = z.object({
  id: z.enum(["A", "B", "C"]),
  label: z.string().min(1).max(24),
  center: PointSchema,
  size: AreaSizeSchema,
  skew: z.number().min(-16).max(16),
  label_position: PointSchema,
  metric_position: PointSchema,
  threat_position: PointSchema,
})

const CustomScenarioNodeSchema = z.object({
  id: z.string().min(1).max(40),
  event: z.object({
    event_type: z.enum(EventTypes),
    target: z.enum(ScenarioTargets),
    severity: Percent,
  }),
  position: PointSchema,
})

const CustomScenarioEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

export const CustomScenarioDocumentSchema = z.object({
  version: z.literal(1),
  map: z.object({
    name: z.string().min(1).max(48),
    areas: z.array(CustomMapAreaSchema).length(3),
  }),
  scenario: z.object({
    name: z.string().min(1).max(48),
    entry_node_id: z.string().min(1),
    nodes: z.array(CustomScenarioNodeSchema).min(1).max(8),
    edges: z.array(CustomScenarioEdgeSchema).max(12),
  }),
})

export type CustomMapArea = z.infer<typeof CustomMapAreaSchema>
export type CustomScenarioDocument = z.infer<typeof CustomScenarioDocumentSchema>
export type CustomScenarioNode = CustomScenarioDocument["scenario"]["nodes"][number]
export type CustomScenarioEvent = CustomScenarioNode["event"]

export function areaPath(area: CustomMapArea): string {
  const halfWidth = area.size.width / 2
  const halfHeight = area.size.height / 2
  const top = clamp(area.center.y - halfHeight, 2, VIEWBOX_HEIGHT - 2)
  const bottom = clamp(area.center.y + halfHeight, 2, VIEWBOX_HEIGHT - 2)
  const leftTop = clamp(area.center.x - halfWidth + area.skew, 2, 98)
  const rightTop = clamp(area.center.x + halfWidth + area.skew, 2, 98)
  const rightBottom = clamp(area.center.x + halfWidth - area.skew, 2, 98)
  const leftBottom = clamp(area.center.x - halfWidth - area.skew, 2, 98)
  return `M${formatPathNumber(leftTop)} ${formatPathNumber(top)} L${formatPathNumber(
    rightTop,
  )} ${formatPathNumber(top)} L${formatPathNumber(rightBottom)} ${formatPathNumber(
    bottom,
  )} L${formatPathNumber(leftBottom)} ${formatPathNumber(bottom)} Z`
}

export function serializeCustomScenario(document: CustomScenarioDocument): string {
  return JSON.stringify(document, null, 2)
}

export function parseCustomScenarioText(text: string): CustomScenarioDocument {
  return CustomScenarioDocumentSchema.parse(JSON.parse(text))
}

export function orderedCustomEvents(document: CustomScenarioDocument): readonly EventPayload[] {
  const nodesById = new Map(document.scenario.nodes.map((node) => [node.id, node]))
  const firstEdgeBySource = new Map(document.scenario.edges.map((edge) => [edge.from, edge.to]))
  const visited = new Set<string>()
  const ordered: EventPayload[] = []
  let currentId: string | undefined = document.scenario.entry_node_id

  while (currentId !== undefined && !visited.has(currentId)) {
    const node = nodesById.get(currentId)
    if (node === undefined) {
      break
    }
    visited.add(currentId)
    ordered.push(node.event)
    currentId = firstEdgeBySource.get(currentId)
  }

  for (const node of document.scenario.nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node.event)
    }
  }

  return ordered
}

export function withMapName(
  document: CustomScenarioDocument,
  name: string,
): CustomScenarioDocument {
  return { ...document, map: { ...document.map, name } }
}

export function withScenarioName(
  document: CustomScenarioDocument,
  name: string,
): CustomScenarioDocument {
  return { ...document, scenario: { ...document.scenario, name } }
}

export function withMapArea(
  document: CustomScenarioDocument,
  areaId: string,
  patch: Partial<Omit<CustomMapArea, "id">>,
): CustomScenarioDocument {
  return {
    ...document,
    map: {
      ...document.map,
      areas: document.map.areas.map((area) => (area.id === areaId ? { ...area, ...patch } : area)),
    },
  }
}

export function withScenarioNodeEvent(
  document: CustomScenarioDocument,
  nodeId: string,
  event: Partial<CustomScenarioEvent>,
): CustomScenarioDocument {
  return {
    ...document,
    scenario: {
      ...document.scenario,
      nodes: document.scenario.nodes.map((node) =>
        node.id === nodeId ? { ...node, event: { ...node.event, ...event } } : node,
      ),
    },
  }
}

export function withScenarioNodePosition(
  document: CustomScenarioDocument,
  nodeId: string,
  position: CustomScenarioNode["position"],
): CustomScenarioDocument {
  return {
    ...document,
    scenario: {
      ...document.scenario,
      nodes: document.scenario.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node,
      ),
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatPathNumber(value: number): string {
  return value.toFixed(2).replace(/\\.00$/, "")
}
