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
    body: body === undefined ? undefined : JSON.stringify(body),
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
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify(latest?.metrics ?? null)}`)
}

await apiPost("/mission", { seed: 42 })
const initial = await apiGet("/")
if (!initial.vehicles.every((vehicle) => vehicle.area === "GCS")) {
  throw new Error("initial scenario did not stage every UxV at GCS")
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15_000)

await page.goto(app, { waitUntil: "networkidle" })
await page.getByTestId("map-view").waitFor()
await page.getByText("중계 임무").first().waitFor()
await page.screenshot({ path: path.join(screenshotDir, "01-desktop-initial-gcs.png"), fullPage: true })

await page.getByRole("button", { name: "커스텀 빌더" }).click()
await page.getByRole("button", { name: "Apply mission" }).click()
await waitForState("mission configure", (state) => state.assignments.length === 0)
await page.getByRole("button", { name: "편성 승인" }).click()
await waitForState(
  "approved optimized allocation",
  (state) => state.assignments.length > 0 && state.events.length === 0,
)
await page.getByRole("button", { name: "임무 판단" }).click()
await page.waitForFunction(() => document.querySelectorAll("[data-testid^='action-path-']").length > 0)
await page.screenshot({
  path: path.join(screenshotDir, "02-desktop-allocation-paths.png"),
  fullPage: true,
})

await page.getByRole("button", { name: "Inject" }).click()
await waitForState("pending recommendation", (state) =>
  state.recommendations.some((card) => card.status === "pending"),
)
const recommendationCard = page.getByTestId("recommendation-card").first()
await recommendationCard.getByRole("button", { name: "승인" }).click()
await waitForState("approved recommendation", (state) =>
  state.recommendations.some((card) => card.status === "approved"),
)
await page.waitForFunction(() => document.querySelectorAll("[data-testid^='action-path-']").length > 0)
await page.screenshot({
  path: path.join(screenshotDir, "03-desktop-event-approved-paths.png"),
  fullPage: true,
})

const batteryInput = page.getByLabel("UxV-04 배터리")
await batteryInput.scrollIntoViewIfNeeded()
await batteryInput.evaluate((element) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  valueSetter?.call(element, "42")
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
})
await page.getByLabel("UxV-04 상태").selectOption("standby")
await page.getByRole("button", { name: "UxV-04 파라미터 적용" }).click()
await waitForState("vehicle parameter tune", (state) =>
  state.vehicles.some(
    (vehicle) => vehicle.id === "UxV-04" && vehicle.status === "standby" && vehicle.health.battery < 0.43,
  ),
)

await page.getByRole("button", { name: "계산 로그" }).click()
await page.getByRole("heading", { name: "계산 로그" }).waitFor()
await page.getByText("vehicle_parameter_tune").waitFor()
await page.getByText(/^MCC /).first().waitFor()
await page.screenshot({ path: path.join(screenshotDir, "04-desktop-log-and-tune.png"), fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole("button", { name: "임무 판단" }).click()
await page.getByTestId("map-view").waitFor()
await page.screenshot({ path: path.join(screenshotDir, "05-mobile-mission-view.png"), fullPage: true })

await browser.close()

const finalState = await apiGet("/")
const replay = await apiGet("/replay")
const summary = {
  initialAllGcs: initial.vehicles.every((vehicle) => vehicle.area === "GCS"),
  finalMcc: finalState.metrics.mcc,
  finalCollapse: finalState.metrics.collapse_probability,
  finalDebt: finalState.metrics.autonomy_debt,
  replayEntries: replay.entries.length,
  calculationEntries: replay.entries.filter((entry) => entry.kind === "calculation").length,
  screenshots: fs.readdirSync(screenshotDir).filter((name) => name.endsWith(".png")).sort(),
}

fs.writeFileSync(path.join(outputDir, "browser-qa-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
