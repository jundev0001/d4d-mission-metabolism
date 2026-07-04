export const DEFAULT_MAP_VIEW_BOX: MapViewBox = { height: 86, width: 100, x: 0, y: 0 }

const MIN_VIEW_WIDTH = 36
const MENU_WIDTH = 228
const MENU_HEIGHT = 218

export type MapViewBox = {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export type MapDragState = {
  readonly clientX: number
  readonly clientY: number
  readonly viewBox: MapViewBox
}

export type MapAssetMenuState = {
  readonly vehicleId: string
  readonly x: number
  readonly y: number
}

export function formatViewBox(viewBox: MapViewBox): string {
  return `${roundMapValue(viewBox.x)} ${roundMapValue(viewBox.y)} ${roundMapValue(
    viewBox.width,
  )} ${roundMapValue(viewBox.height)}`
}

export function overlayScaleForViewBox(viewBox: MapViewBox): number {
  return viewBox.width / DEFAULT_MAP_VIEW_BOX.width
}

export function panViewBox(request: {
  readonly clientX: number
  readonly clientY: number
  readonly dragState: MapDragState
  readonly rectHeight: number
  readonly rectWidth: number
}): MapViewBox {
  if (request.rectWidth === 0 || request.rectHeight === 0) {
    return request.dragState.viewBox
  }
  const deltaX =
    ((request.clientX - request.dragState.clientX) * request.dragState.viewBox.width) /
    request.rectWidth
  const deltaY =
    ((request.clientY - request.dragState.clientY) * request.dragState.viewBox.height) /
    request.rectHeight
  return clampViewBox({
    ...request.dragState.viewBox,
    x: request.dragState.viewBox.x - deltaX,
    y: request.dragState.viewBox.y - deltaY,
  })
}

export function zoomViewBox(request: {
  readonly clientX: number
  readonly clientY: number
  readonly deltaY: number
  readonly rect: DOMRectReadOnly
  readonly viewBox: MapViewBox
}): MapViewBox {
  if (request.rect.width === 0 || request.rect.height === 0) {
    return request.viewBox
  }
  const pointerX = (request.clientX - request.rect.left) / request.rect.width
  const pointerY = (request.clientY - request.rect.top) / request.rect.height
  const scale = request.deltaY > 0 ? 1.14 : 0.86
  const nextWidth = Math.min(
    DEFAULT_MAP_VIEW_BOX.width,
    Math.max(MIN_VIEW_WIDTH, request.viewBox.width * scale),
  )
  const nextHeight = nextWidth * (DEFAULT_MAP_VIEW_BOX.height / DEFAULT_MAP_VIEW_BOX.width)
  const anchorX = request.viewBox.x + pointerX * request.viewBox.width
  const anchorY = request.viewBox.y + pointerY * request.viewBox.height
  return clampViewBox({
    height: nextHeight,
    width: nextWidth,
    x: anchorX - pointerX * nextWidth,
    y: anchorY - pointerY * nextHeight,
  })
}

export function assetMenuStateFromClientPoint(request: {
  readonly clientX: number
  readonly clientY: number
  readonly frameRect: DOMRectReadOnly | null
  readonly vehicleId: string
}): MapAssetMenuState {
  if (request.frameRect === null) {
    return { vehicleId: request.vehicleId, x: request.clientX, y: request.clientY }
  }
  return {
    vehicleId: request.vehicleId,
    x: clamp(
      request.clientX - request.frameRect.left,
      8,
      Math.max(8, request.frameRect.width - MENU_WIDTH),
    ),
    y: clamp(
      request.clientY - request.frameRect.top,
      8,
      Math.max(8, request.frameRect.height - MENU_HEIGHT),
    ),
  }
}

function clampViewBox(viewBox: MapViewBox): MapViewBox {
  return {
    ...viewBox,
    x: clamp(viewBox.x, 0, DEFAULT_MAP_VIEW_BOX.width - viewBox.width),
    y: clamp(viewBox.y, 0, DEFAULT_MAP_VIEW_BOX.height - viewBox.height),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundMapValue(value: number): number {
  return Math.round(value * 100) / 100
}
