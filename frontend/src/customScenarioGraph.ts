import type {
  CustomScenarioDocument,
  CustomScenarioEdge,
  CustomScenarioNode,
} from "./customScenario"
import type { EventPayload } from "./types"

export function customScenarioEventBatches(
  document: CustomScenarioDocument,
): readonly (readonly EventPayload[])[] {
  return scenarioNodeBatches(document).map((batch) => batch.map((node) => node.event))
}

export function orderedCustomEvents(document: CustomScenarioDocument): readonly EventPayload[] {
  return customScenarioEventBatches(document).flat()
}

export function scenarioNodeDepths(document: CustomScenarioDocument): ReadonlyMap<string, number> {
  const depths = new Map<string, number>()
  scenarioNodeBatches(document).forEach((batch, depth) => {
    for (const node of batch) {
      depths.set(node.id, depth)
    }
  })
  return depths
}

export function canAddScenarioEdge(
  document: CustomScenarioDocument,
  edge: CustomScenarioEdge,
): boolean {
  if (edge.from === edge.to) {
    return false
  }
  const nodeIds = new Set(document.scenario.nodes.map((node) => node.id))
  if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
    return false
  }
  if (document.scenario.edges.some((item) => item.from === edge.from && item.to === edge.to)) {
    return false
  }
  return !hasPath(document.scenario.edges, edge.to, edge.from)
}

export function hasPath(
  edges: readonly CustomScenarioEdge[],
  fromNodeId: string,
  toNodeId: string,
): boolean {
  const nextBySource = edgesBySource(edges)
  const visited = new Set<string>()
  const stack = [fromNodeId]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined || visited.has(current)) {
      continue
    }
    if (current === toNodeId) {
      return true
    }
    visited.add(current)
    for (const next of nextBySource.get(current) ?? []) {
      stack.push(next)
    }
  }
  return false
}

function scenarioNodeBatches(
  document: CustomScenarioDocument,
): readonly (readonly CustomScenarioNode[])[] {
  const nodesById = new Map(document.scenario.nodes.map((node) => [node.id, node]))
  const entryNode = nodesById.get(document.scenario.entry_node_id) ?? document.scenario.nodes.at(0)
  if (entryNode === undefined) {
    return []
  }

  const nextBySource = edgesBySource(document.scenario.edges)
  const incomingByTarget = edgesByTarget(document.scenario.edges)
  const visited = new Set<string>()
  const batches: CustomScenarioNode[][] = []
  let frontier = [entryNode.id]

  while (frontier.length > 0) {
    const batch = unique(frontier)
      .filter((nodeId) => !visited.has(nodeId))
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is CustomScenarioNode => node !== undefined)
      .sort(compareNodePosition)
    if (batch.length === 0) {
      break
    }
    for (const node of batch) {
      visited.add(node.id)
    }
    batches.push(batch)
    const candidates = batch.flatMap((node) => nextBySource.get(node.id) ?? [])
    frontier = unique(candidates).filter((nodeId) =>
      (incomingByTarget.get(nodeId) ?? []).every((parentId) => visited.has(parentId)),
    )
  }

  appendUnvisitedBatches(document, visited, incomingByTarget, batches)
  return batches
}

function appendUnvisitedBatches(
  document: CustomScenarioDocument,
  visited: Set<string>,
  incomingByTarget: ReadonlyMap<string, readonly string[]>,
  batches: CustomScenarioNode[][],
): void {
  while (visited.size < document.scenario.nodes.length) {
    const ready = document.scenario.nodes
      .filter((node) => !visited.has(node.id))
      .filter((node) =>
        (incomingByTarget.get(node.id) ?? []).every((parentId) => visited.has(parentId)),
      )
      .sort(compareNodePosition)
    const fallback = document.scenario.nodes
      .filter((node) => !visited.has(node.id))
      .sort(compareNodePosition)
      .at(0)
    const batch = ready.length > 0 ? ready : fallback === undefined ? [] : [fallback]
    if (batch.length === 0) {
      break
    }
    for (const node of batch) {
      visited.add(node.id)
    }
    batches.push(batch)
  }
}

function edgesBySource(
  edges: readonly CustomScenarioEdge[],
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, string[]>()
  for (const edge of edges) {
    result.set(edge.from, [...(result.get(edge.from) ?? []), edge.to])
  }
  return result
}

function edgesByTarget(
  edges: readonly CustomScenarioEdge[],
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, string[]>()
  for (const edge of edges) {
    result.set(edge.to, [...(result.get(edge.to) ?? []), edge.from])
  }
  return result
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function compareNodePosition(left: CustomScenarioNode, right: CustomScenarioNode): number {
  return left.position.x - right.position.x || left.position.y - right.position.y
}
