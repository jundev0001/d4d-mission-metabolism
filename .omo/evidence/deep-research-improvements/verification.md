# Deep Research Improvement Verification

Source backlog: `Deep-Research-for-AGENTS.md`

## Implemented Scope

- Operator-action metric integrity: event injection no longer increments assisted operator actions; human decisions remain counted.
- Mission Intent round-trip: custom scenario constraints, target MCC, relay redundancy, RTB threshold, human gate policy, and autonomy level now flow from builder UI to backend mission configuration.
- Evaluation dashboard: baseline replan/collapse/CCR displays read backend `baseline_metrics` and compare them with assisted `metrics`; the frontend no longer fabricates baseline values.
- Paired baseline state: backend keeps baseline mission/fleet/assignment state separate from assisted recovery state, so approvals can improve assisted metrics without rewriting the baseline comparison.
- Live state: frontend opens `/ws/state` after hydrate, ignores malformed live payloads, and falls back to REST polling if the live stream errors or closes unexpectedly.
- Deployment hardening: backend CORS origins are configurable through `D4D_CORS_ORIGINS` with localhost defaults.
- COP readability: clustered asset glyphs are spread in the display layer while preserving underlying vehicle positions.

## Automated Verification

- `frontend`: `npm run lint` passed.
- `frontend`: `npm run typecheck` passed.
- `frontend`: `npm run test` passed, 9 files / 30 tests.
- `frontend`: `npm run build` passed with default API base restored after isolated QA.
- `backend`: `python -m ruff check src tests` passed.
- `backend`: `python -m pytest` passed, 44 tests with 1 existing Starlette/httpx deprecation warning.
- `backend`: configured `basedpyright` gate passed for `src` with 0 errors / 0 warnings when PATH was prefixed with the bundled Python directory.
- `backend`: strict `basedpyright src tests` passed with 0 errors / 0 warnings after typing the API tests through Pydantic response models.
- Direct API serialization check passed: internal `baseline_mission`, `baseline_vehicles`, and `baseline_assignments` fields are excluded from public dashboard JSON.
- Escape-hatch scan passed: no unsafe TypeScript casts or ignore-directive patterns in changed source/tests/evidence.
- LOC gate check passed for the previously rejected files: `MapView.tsx` 198, `store.ts` 204, `ScenarioBuilderPanel.tsx` 237 pure LOC.

## Manual Browser QA

Used isolated ports to avoid existing local processes:

- Backend: `127.0.0.1:8001`
- Frontend preview: `127.0.0.1:4174`
- Build env: `VITE_API_BASE_URL=http://127.0.0.1:8001`
- Backend env: `D4D_CORS_ORIGINS=http://127.0.0.1:4174,http://localhost:4174`

Playwright checks passed:

- Desktop mission workspace renders EvaluationPanel and scoped CCR value; COP asset display transforms are unique for UxV glyphs.
- Updated desktop mission capture after visual re-gate: real UxV labels render with 0 bounding-box overlaps, including the previously rejected `UxV-05` / `UxV-01` area.
- Mobile mission workspace renders EvaluationPanel and CCR.
- Desktop custom builder renders Mission Intent controls, keyboard-adjusted Target MCC to 86%, and Apply mission returns without an error banner.
- Mobile custom builder renders Mission Intent controls without visible overlap or clipped primary controls.

Screenshots:

- `desktop-mission.png`
- `desktop-mission-label-overlap.json`
- `mobile-mission.png`
- `desktop-builder.png`
- `mobile-builder.png`

The isolated QA listener processes were stopped after capture; no `LISTENING` sockets remained for `8001/4174`.

## Review Follow-Up

- Visual gate reject addressed by spreading COP real assets on an outer display ring, refreshing `desktop-mission.png`, and recording `desktop-mission-label-overlap.json` with 0 label overlaps.
- Frontend code review reject addressed by replacing frontend baseline formulas with backend `baseline_metrics`, adding WebSocket failure polling fallback, clamping Relay min input, and extracting `MissionIntentControls`.
- Frontend LOC follow-up addressed by extracting `mapAssetDisplay.ts`, `liveDashboard.ts`, `customMissionPayload.ts`, and `ScenarioBuilderCommandBar.tsx`.
- The previously referenced `frontend/tests/mission-intent-controls.test.tsx` now exists and passes.
- Backend watch item addressed by falling back to default CORS origins when `D4D_CORS_ORIGINS` is present but blank.
- Backend strict test typing addressed by replacing raw `response.json()` assertions in `backend/tests/test_api.py` with typed Pydantic response-model parsing and by exposing `relay_redundancy` as a public helper for `test_core.py`.
- `remove-ai-slops` / `programming` criteria are recorded in `review-criteria.md`.

## Type-Check Notes

- `python -m basedpyright` now passes the configured production gate because `backend/pyproject.toml` sets `executionEnvironments = [{ root = "src", extraPaths = ["src"] }]`.
- `python -m basedpyright src tests` now also passes with 0 errors / 0 warnings when the bundled Python directory is first on PATH.
- Running without the bundled Python directory first on PATH is misleading on this Windows host because basedpyright can fall through to the Windows Store Python shim.

## Deferred Items

- Short-horizon Mission Metabolism predictor remains P2.
- PX4/ROS 2/MAVSDK protocol adapter packages remain P2.
