import {
  areaCentroid,
  type CustomMapArea,
  type CustomPoint,
  type CustomScenarioDocument,
  type CustomScenarioEdge,
  type CustomScenarioEvent,
  type CustomScenarioNode,
  MAX_SCENARIO_AREAS,
  MAX_SCENARIO_EDGES,
  MAX_SCENARIO_NODES,
  requirementsForMissionType,
} from "./customScenario"
import { canAddScenarioEdge } from "./customScenarioGraph"

type ScenarioMutationResult = {
  readonly document: CustomScenarioDocument
  readonly selectedNodeId: string
}

type AreaMutationResult = {
  readonly document: CustomScenarioDocument
  readonly selectedAreaId: string
}

const DEFAULT_EVENT: CustomScenarioEvent = {
  event_type: "comm_jam",
  target: "B",
  severity: 0.7,
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

export function addMapArea(
  document: CustomScenarioDocument,
  points?: readonly CustomPoint[],
): AreaMutationResult {
  if (document.map.areas.length >= MAX_SCENARIO_AREAS) {
    return { document, selectedAreaId: document.map.areas.at(0)?.id ?? "" }
  }
  const areaPoints =
    points === undefined || points.length < 3 ? defaultAreaPoints(document) : points
  const centroid = areaCentroid({ points: areaPoints })
  const id = nextAreaId(document)
  const area: CustomMapArea = {
    id,
    label: `Area ${id}`,
    points: areaPoints.map((point) => ({ x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 86) })),
    label_position: { x: clamp(centroid.x - 6, 0, 100), y: clamp(centroid.y - 3, 0, 86) },
    metric_position: { x: clamp(centroid.x - 6, 0, 100), y: clamp(centroid.y + 3, 0, 86) },
    threat_position: centroid,
    mission_type: "area_recon",
    priority: 0.6,
    threat: 0.1,
    requirements: requirementsForMissionType("area_recon"),
  }
  return {
    document: { ...document, map: { ...document.map, areas: [...document.map.areas, area] } },
    selectedAreaId: id,
  }
}

export function removeMapArea(
  document: CustomScenarioDocument,
  areaId: string,
): AreaMutationResult {
  if (document.map.areas.length <= 1) {
    return { document, selectedAreaId: areaId }
  }
  const areas = document.map.areas.filter((area) => area.id !== areaId)
  const fallbackTarget = areas.at(0)?.id ?? areaId
  return {
    document: {
      ...document,
      map: { ...document.map, areas },
      scenario: {
        ...document.scenario,
        nodes: document.scenario.nodes.map((node) =>
          node.event.target === areaId
            ? { ...node, event: { ...node.event, target: fallbackTarget } }
            : node,
        ),
      },
    },
    selectedAreaId: fallbackTarget,
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

export function addScenarioNode(document: CustomScenarioDocument): ScenarioMutationResult {
  const node = createScenarioNode(document)
  return appendNode(document, node)
}

export function insertScenarioNodeAfter(
  document: CustomScenarioDocument,
  nodeId: string,
): ScenarioMutationResult {
  const source = findNode(document, nodeId)
  if (source === undefined || document.scenario.nodes.length >= MAX_SCENARIO_NODES) {
    return { document, selectedNodeId: nodeId }
  }
  const node = createScenarioNode(document, {
    position: { x: clamp(source.position.x + 18, 8, 88), y: source.position.y },
  })
  const outgoing = document.scenario.edges.filter((edge) => edge.from === nodeId)
  const retained = document.scenario.edges.filter((edge) => edge.from !== nodeId)
  const insertedEdges = [
    { from: nodeId, to: node.id },
    ...outgoing.map((edge) => ({ from: node.id, to: edge.to })),
  ].slice(0, Math.max(0, MAX_SCENARIO_EDGES - retained.length))
  return {
    document: {
      ...document,
      scenario: {
        ...document.scenario,
        nodes: [...document.scenario.nodes, node],
        edges: [...retained, ...insertedEdges],
      },
    },
    selectedNodeId: node.id,
  }
}

export function addParallelScenarioNode(
  document: CustomScenarioDocument,
  nodeId: string,
): ScenarioMutationResult {
  const reference = findNode(document, nodeId)
  if (reference === undefined || document.scenario.nodes.length >= MAX_SCENARIO_NODES) {
    return { document, selectedNodeId: nodeId }
  }
  const incoming = document.scenario.edges.find((edge) => edge.to === nodeId)
  const parentId = incoming?.from ?? nodeId
  const node = createScenarioNode(document, {
    position: {
      x: incoming === undefined ? clamp(reference.position.x + 20, 8, 88) : reference.position.x,
      y: clamp(reference.position.y + 14, 18, 78),
    },
  })
  return appendNode(document, node, { from: parentId, to: node.id })
}

export function removeScenarioNode(
  document: CustomScenarioDocument,
  nodeId: string,
): ScenarioMutationResult {
  if (document.scenario.nodes.length <= 1) {
    return { document, selectedNodeId: nodeId }
  }
  const nodes = document.scenario.nodes.filter((node) => node.id !== nodeId)
  const selectedNodeId = nodes.at(0)?.id ?? document.scenario.entry_node_id
  const entryNodeId =
    document.scenario.entry_node_id === nodeId ? selectedNodeId : document.scenario.entry_node_id
  return {
    document: {
      ...document,
      scenario: {
        ...document.scenario,
        entry_node_id: entryNodeId,
        nodes,
        edges: document.scenario.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      },
    },
    selectedNodeId,
  }
}

export function setScenarioEntryNode(
  document: CustomScenarioDocument,
  nodeId: string,
): CustomScenarioDocument {
  if (findNode(document, nodeId) === undefined) {
    return document
  }
  return { ...document, scenario: { ...document.scenario, entry_node_id: nodeId } }
}

export function upsertScenarioEdge(
  document: CustomScenarioDocument,
  edge: CustomScenarioEdge,
): CustomScenarioDocument {
  if (document.scenario.edges.length >= MAX_SCENARIO_EDGES || !canAddScenarioEdge(document, edge)) {
    return document
  }
  return {
    ...document,
    scenario: { ...document.scenario, edges: [...document.scenario.edges, edge] },
  }
}

export function removeScenarioEdge(
  document: CustomScenarioDocument,
  edge: CustomScenarioEdge,
): CustomScenarioDocument {
  return {
    ...document,
    scenario: {
      ...document.scenario,
      edges: document.scenario.edges.filter(
        (item) => item.from !== edge.from || item.to !== edge.to,
      ),
    },
  }
}

function appendNode(
  document: CustomScenarioDocument,
  node: CustomScenarioNode,
  edge?: CustomScenarioEdge,
): ScenarioMutationResult {
  if (document.scenario.nodes.length >= MAX_SCENARIO_NODES) {
    return { document, selectedNodeId: document.scenario.entry_node_id }
  }
  const nextEdges =
    edge === undefined ||
    document.scenario.edges.length >= MAX_SCENARIO_EDGES ||
    !canAddScenarioEdge(
      {
        ...document,
        scenario: { ...document.scenario, nodes: [...document.scenario.nodes, node] },
      },
      edge,
    )
      ? document.scenario.edges
      : [...document.scenario.edges, edge]
  return {
    document: {
      ...document,
      scenario: {
        ...document.scenario,
        nodes: [...document.scenario.nodes, node],
        edges: nextEdges,
      },
    },
    selectedNodeId: node.id,
  }
}

function createScenarioNode(
  document: CustomScenarioDocument,
  options?: Partial<Pick<CustomScenarioNode, "event" | "position">>,
): CustomScenarioNode {
  const fallbackTarget = document.map.areas.at(0)?.id ?? DEFAULT_EVENT.target
  return {
    id: nextNodeId(document),
    event: options?.event ?? { ...DEFAULT_EVENT, target: fallbackTarget },
    position: options?.position ?? { x: 16, y: 62 },
  }
}

function nextNodeId(document: CustomScenarioDocument): string {
  const existing = new Set(document.scenario.nodes.map((node) => node.id))
  for (
    let index = document.scenario.nodes.length + 1;
    index <= MAX_SCENARIO_NODES + 1;
    index += 1
  ) {
    const candidate = `node-${index.toString().padStart(2, "0")}`
    if (!existing.has(candidate)) {
      return candidate
    }
  }
  return `node-${Date.now().toString(36)}`
}

function findNode(
  document: CustomScenarioDocument,
  nodeId: string,
): CustomScenarioNode | undefined {
  return document.scenario.nodes.find((node) => node.id === nodeId)
}

function nextAreaId(document: CustomScenarioDocument): string {
  const existing = new Set(document.map.areas.map((area) => area.id))
  for (let index = 1; index <= MAX_SCENARIO_AREAS + 1; index += 1) {
    const candidate = `area-${index.toString().padStart(2, "0")}`
    if (!existing.has(candidate)) {
      return candidate
    }
  }
  return `area-${Date.now().toString(36)}`
}

function defaultAreaPoints(document: CustomScenarioDocument): readonly CustomPoint[] {
  const offset = document.map.areas.length * 4
  return [
    { x: clamp(42 + offset, 0, 100), y: clamp(22 + offset, 0, 86) },
    { x: clamp(62 + offset, 0, 100), y: clamp(24 + offset, 0, 86) },
    { x: clamp(58 + offset, 0, 100), y: clamp(44 + offset, 0, 86) },
    { x: clamp(38 + offset, 0, 100), y: clamp(42 + offset, 0, 86) },
  ]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
