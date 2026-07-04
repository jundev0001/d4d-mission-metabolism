import type { MissionConfigurePayload } from "./api"
import { areaCentroid, type CustomScenarioDocument } from "./customScenario"

export function missionPayloadFromCustomScenario(
  customScenario: CustomScenarioDocument,
): MissionConfigurePayload {
  const firstArea = customScenario.map.areas.at(0)
  return {
    objective: customScenario.scenario.name,
    mission_type: firstArea?.mission_type ?? "area_recon",
    constraints: customScenario.intent.constraints,
    autonomy_level: customScenario.intent.autonomy_level,
    areas: customScenario.map.areas.map((area) => ({
      id: area.id,
      label: area.label,
      mission_type: area.mission_type,
      requirements: area.requirements,
      priority: area.priority,
      threat: area.threat,
      center: areaCentroid(area),
    })),
  }
}
