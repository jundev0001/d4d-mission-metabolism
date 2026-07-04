import fixedwingSurveyUavIcon from "./assets/vehicle-icons/fixedwing_survey_uav.png?inline"
import gpsDeniedUavIcon from "./assets/vehicle-icons/gps_denied_uav.png?inline"
import microScoutUavIcon from "./assets/vehicle-icons/micro_scout_uav.png?inline"
import overwatchUavIcon from "./assets/vehicle-icons/overwatch_uav.png?inline"
import quadReconUavIcon from "./assets/vehicle-icons/quad_recon_uav.png?inline"
import relayUavIcon from "./assets/vehicle-icons/relay_uav.png?inline"
import scoutRoverIcon from "./assets/vehicle-icons/scout_rover.png?inline"
import sensorRoverIcon from "./assets/vehicle-icons/sensor_rover.png?inline"
import syntheticWingmanIcon from "./assets/vehicle-icons/synthetic_wingman.png?inline"

const VEHICLE_TYPE_ICONS: Readonly<Record<string, string>> = {
  fixedwing_survey_uav: fixedwingSurveyUavIcon,
  gps_denied_uav: gpsDeniedUavIcon,
  micro_scout_uav: microScoutUavIcon,
  overwatch_uav: overwatchUavIcon,
  quad_recon_uav: quadReconUavIcon,
  relay_uav: relayUavIcon,
  scout_rover: scoutRoverIcon,
  sensor_rover: sensorRoverIcon,
  synthetic_wingman: syntheticWingmanIcon,
  UAV: quadReconUavIcon,
  UGV: scoutRoverIcon,
} as const

export function mapAssetIconHref(vehicleType: string): string {
  return VEHICLE_TYPE_ICONS[vehicleType] ?? syntheticWingmanIcon
}
