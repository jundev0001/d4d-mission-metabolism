# Deep Research Implementation Todo

Source: `Deep-Research-for-AGENTS.md`

## P0

- [x] Fix operator-action metric integrity so event injection does not count as a human action. Human approval, rejection, and manual intervention remain the only assisted operator-action increments.
- [x] Extend Mission Intent configuration end-to-end with constraints, autonomy level, and human approval policy.
- [x] Remove hardcoded EvaluationPanel baseline values and render values derived from dashboard state.
- [x] Move A/B baseline display to a backend `baseline_metrics` contract with a separate baseline mission/fleet/assignment track so the frontend compares paired state fields instead of inventing replan/collapse values.

## P1

- [x] Wire `/ws/state` live updates into the app with `hydrate()` preserved as the fallback.
- [x] Add REST polling fallback when the WebSocket closes or errors outside intentional cleanup.
- [x] Make CORS origins configurable for non-local demo hosts while preserving localhost defaults.
- [x] Spread clustered COP asset glyphs in the display layer so vehicle labels remain readable without mutating domain positions.
- [x] Add targeted regressions for operator-action integrity, Mission Intent round-trip, evaluation rendering, and live connection wiring.
- [x] Restore backend type gates: configured `basedpyright` passes for `src`, and strict `basedpyright src tests` passes when run with the bundled Python path ahead of the Windows Store Python shim.
- [x] Resolve the programming LOC gate by extracting `mapAssetDisplay.ts`, `liveDashboard.ts`, `customMissionPayload.ts`, and `ScenarioBuilderCommandBar.tsx`.

## Deferred

- [ ] Upgrade Mission Metabolism from snapshot risk gauge to short-horizon predictor. The research report marks this as medium-term/P2, so this pass keeps the deterministic MVP scope.
- [ ] Add protocol adapter packages for PX4/ROS 2/MAVSDK as future extension boundaries. This remains out of scope for the P0 demo hardening pass.
