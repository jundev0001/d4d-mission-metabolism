import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire("C:/Users/Jun/Documents/D4D/frontend/package.json")
const { chromium } = require("playwright")

const api = "http://127.0.0.1:8000"
const app = "http://127.0.0.1:4173"
const outputDir = "C:/Users/Jun/Documents/D4D/.omo/evidence/ulw-add-qa-improvements"
const screenshotDir = path.join(outputDir, "screenshots")

fs.mkdirSync(screenshotDir, { recursive: true })

async function apiGet(route) {
  const response = await fetch(`${api}${route}`)
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`)
  }
  return response.json()
}

async function apiPost(route, body) {
  const response = await fetch(`${api}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`)
  }
  return response.json()
}

async function waitForState(label, predicate, timeoutMs = 15_000) {
  const startedAt = Date.now()
  let latest = null
  while (Date.now() - startedAt < timeoutMs) {
    latest = await apiGet("/")
    if (predicate(latest)) {
      return latest
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`timed out waiting for ${label}`)
}

function assetSelector(vehicleId) {
  return `[data-asset-id="${vehicleId}"]`
}

async function assetTransform(page, vehicleId) {
  const transform = await page.locator(assetSelector(vehicleId)).getAttribute("transform")
  if (transform === null) {
    throw new Error(`${vehicleId} transform not found`)
  }
  return transform
}

function parseTranslate(transform) {
  const match = /^translate\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)/.exec(transform)
  if (match === null) {
    throw new Error(`could not parse transform: ${transform}`)
  }
  return { x: Number(match[1]), y: Number(match[2]) }
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function requireMotionEvidence(samples) {
  const before = parseTranslate(samples.beforeTransform)
  const first = parseTranslate(samples.firstFrameTransform)
  const mid = parseTranslate(samples.midFrameTransform)
  const settled = parseTranslate(samples.settledTransform)
  const totalDistance = distance(before, settled)
  const firstToMidDistance = distance(first, mid)
  const midToSettledDistance = distance(mid, settled)

  if (totalDistance < 4) {
    throw new Error(`asset target movement too small to validate: ${totalDistance}`)
  }
  if (firstToMidDistance < 0.05 || midToSettledDistance < 0.05) {
    throw new Error(
      `asset did not keep moving across sampled frames: ${JSON.stringify({
        firstToMidDistance,
        midToSettledDistance,
      })}`,
    )
  }

  return { before, first, firstToMidDistance, mid, midToSettledDistance, settled, totalDistance }
}

await apiPost("/mission", { seed: 42 })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15_000)

await page.goto(app, { waitUntil: "networkidle" })
await page.getByTestId("map-view").waitFor()
await page.getByRole("button", { name: "커스텀 빌더" }).click()
await page.getByRole("button", { name: "Apply mission" }).click()
await waitForState("mission configured", (state) => state.assignments.length === 0)
await page.getByRole("button", { name: "임무 판단" }).click()
await page.getByTestId("map-view").waitFor()

const vehicleId = "UxV-01"
const beforeTransform = await assetTransform(page, vehicleId)
await page.getByRole("button", { name: "편성 승인" }).click()
await page.waitForFunction(
  ({ selector, transform }) => document.querySelector(selector)?.getAttribute("transform") !== transform,
  { selector: assetSelector(vehicleId), transform: beforeTransform },
)
const firstFrameTransform = await assetTransform(page, vehicleId)
await page.waitForTimeout(300)
const midFrameTransform = await assetTransform(page, vehicleId)
await page.screenshot({
  path: path.join(screenshotDir, "06-desktop-allocation-motion-midframe.png"),
  fullPage: true,
})
await page.waitForTimeout(850)
const settledTransform = await assetTransform(page, vehicleId)
await waitForState("approved allocation", (state) => state.assignments.length > 0)

const motion = requireMotionEvidence({
  beforeTransform,
  firstFrameTransform,
  midFrameTransform,
  settledTransform,
})
const summary = {
  samples: {
    beforeTransform,
    firstFrameTransform,
    midFrameTransform,
    settledTransform,
  },
  screenshot: "screenshots/06-desktop-allocation-motion-midframe.png",
  vehicleId,
  ...motion,
}

await browser.close()

fs.writeFileSync(
  path.join(outputDir, "asset-animation-qa-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
)
console.log(JSON.stringify(summary, null, 2))
