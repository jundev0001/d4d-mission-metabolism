# Review Criteria Pass

## remove-ai-slops

- No hardcoded frontend A/B constants remain in `EvaluationPanel`; it renders backend `dashboard.baseline_metrics` and assisted `dashboard.metrics`.
- Backend `baseline_metrics` is computed from a separate baseline mission/fleet/assignment track rather than from the assisted post-recovery state.
- No unsafe TypeScript casts or ignore directives are present in changed frontend/backend source or tests.
- Mission Intent defaults are schema-backed, and legacy custom scenario JSON is covered by tests.
- WebSocket fallback is covered by a store test instead of being a happy-path-only implementation.
- The previously referenced `mission-intent-controls.test.tsx` now exists and validates Target MCC, Relay min clamping, and human gate changes.
- Visual QA artifacts cover desktop mission, mobile mission, desktop builder, and mobile builder.

Remaining risk:

- `baseline_metrics` now uses paired baseline state, but it is still a deterministic manual-baseline model rather than a full baseline micro-action replay engine.

## programming

- `ScenarioBuilderPanel` was reduced by extracting `MissionIntentControls` and `ScenarioBuilderCommandBar`.
- `MapView` was reduced by extracting `mapAssetDisplay.ts`; `store.ts` was reduced by extracting `liveDashboard.ts` and `customMissionPayload.ts`.
- Pure LOC gate now passes for the previously rejected files: `MapView.tsx` 198, `store.ts` 204, `ScenarioBuilderPanel.tsx` 237.
- Backend API behavior is covered by regression tests for Mission Intent, operator-action integrity, baseline metrics, and CORS whitespace/default handling.
- Frontend behavior is covered by regression tests for baseline rendering, WebSocket fallback, legacy scenario defaults, map asset display, and Mission Intent payload serialization.
- Formatting/lint/type/test gates passed, including strict `basedpyright src tests` with the bundled Python path.

Remaining risk:

- Full baseline micro-action replay remains a future modeling improvement; the current baseline is paired state plus deterministic manual workload metrics.
