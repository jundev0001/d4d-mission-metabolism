import { describe, expect, it } from "vitest"
import { displayPositionsForVehicles } from "../src/mapAssetDisplay"
import { makeDashboardState } from "./fixtures"

describe("asset display positioning", () => {
  it("Given GCS assets in the right staging lane When display positions are spread Then they stay clear of Area C", () => {
    const dashboard = makeDashboardState()
    const vehicles = dashboard.vehicles.map((vehicle, index) => ({
      ...vehicle,
      area: "GCS",
      position: {
        x: 90.8 + (index % 3) * 3.9,
        y: 61.2 + Math.floor(index / 3) * 3.1,
      },
    }))

    const positions = displayPositionsForVehicles(vehicles)

    for (const vehicle of vehicles) {
      const position = positions.get(vehicle.id)
      expect(position).toBeDefined()
      expect(position?.x).toBeGreaterThan(89)
      expect(position?.y).toBeLessThanOrEqual(86)
    }
  })
})
