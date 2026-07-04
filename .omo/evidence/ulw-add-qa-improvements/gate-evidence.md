# ULW Add QA Improvements Gate Evidence

## Scope

Implemented the requested follow-up behaviors:

- Log tab showing actual calculation traces.
- COP overlays for allocation/action movement and ongoing mission activity.
- Per-vehicle health/status parameter tuning.
- Area mission, priority, threat, and MCC visibility.
- GCS staging before approved optimized allocation, reserve posture, and event recovery approval flow.
- Smooth COP asset movement for UxV coordinate changes, with visible mid-motion frames instead of instant teleporting.
- `임무 판단` surface now exposes `편성 승인` next to the COP so initial allocation approval can be observed without switching away to the custom builder.

## Key Files

- Backend contracts and state:
  - `backend/src/d4d_mission/models.py`
  - `backend/src/d4d_mission/scenario.py`
  - `backend/src/d4d_mission/state.py`
  - `backend/src/d4d_mission/runtime_support.py`
  - `backend/src/d4d_mission/main.py`
- Frontend:
  - `frontend/src/App.tsx`
  - `frontend/src/api.ts`
  - `frontend/src/store.ts`
  - `frontend/src/components/BlackBoxPanel.tsx`
  - `frontend/src/components/FleetAssetList.tsx`
  - `frontend/src/components/FleetDeploymentPanel.tsx`
  - `frontend/src/components/MapAreaSector.tsx`
  - `frontend/src/components/MapPathOverlays.tsx`
  - `frontend/src/components/MapReadout.tsx`
  - `frontend/src/components/MapView.tsx`
  - `frontend/src/mapAssetAnimation.ts`
  - `frontend/src/styles/deployment.css`
- Tests:
  - `backend/tests/test_api.py`
  - `frontend/tests/app-tabs.test.tsx`
  - `frontend/tests/blackbox-panel.test.tsx`
  - `frontend/tests/fleet-deployment-panel.test.tsx`
  - `frontend/tests/mapAssetAnimation.test.ts`
  - `frontend/tests/map-view.test.tsx`

## Verification

- Frontend targeted tests: passed, 11 tests.
- Frontend lint: passed.
- Frontend typecheck: passed.
- Frontend full tests: passed, 10 files / 35 tests.
- Frontend build: passed.
- Follow-up animation targeted tests: passed, 3 files / 13 tests.
- Follow-up animation browser QA: passed, transform changed across first/mid/settled frames for `UxV-01`.
- Backend ruff format/check: passed.
- Backend targeted API tests: passed, 14 tests.
- Backend full pytest: passed, 45 tests / 1 FastAPI StarletteDeprecationWarning.
- Backend basedpyright: still fails repository-wide with existing Pydantic unknown-type reports; this remains a known project typing issue, not introduced by this scope.

## Review Fixes

Initial code review report: `.omo/evidence/ulw-add-qa-improvements-code-review.md`.

Resolved blockers:

- Split oversized `MapView.tsx` path overlay logic into `MapPathOverlays.tsx`.
- Split runtime support from `state.py` into `runtime_support.py`.
- Latest calculation trace now appears when the selected replay row is not a calculation.
- Added chronological replay regression test for the log tab.
- Vehicle tuning now updates paired baseline vehicle state before metrics refresh.
- Backend tune test parses `CalculationTrace` instead of asserting raw JSON substrings.
- Removed status select type assertion escape hatch.
- Added `useAnimatedAssetPositions` with reduced-motion snap behavior and pure interpolation coverage.
- Added the mission-surface `편성 승인` control wired to the existing allocation store action.

Pure LOC after split:

- `backend/src/d4d_mission/state.py`: 241
- `backend/src/d4d_mission/runtime_support.py`: 80
- `frontend/src/components/MapView.tsx`: 213
- `frontend/src/components/MapPathOverlays.tsx`: 152
- `frontend/src/components/FleetAssetList.tsx`: 228
- `frontend/src/components/FleetDeploymentPanel.tsx`: 198
- `frontend/src/mapAssetAnimation.ts`: 115
- `frontend/src/types.ts`: 250

## Manual Browser QA

Script: `.omo/evidence/ulw-add-qa-improvements/browser-qa.mjs`.

Summary JSON: `.omo/evidence/ulw-add-qa-improvements/browser-qa-summary.json`.

Animation QA script: `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa.mjs`.

Animation summary JSON: `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa-summary.json`.

Screenshots:

- `screenshots/01-desktop-initial-gcs.png`
- `screenshots/02-desktop-allocation-paths.png`
- `screenshots/03-desktop-event-approved-paths.png`
- `screenshots/04-desktop-log-and-tune.png`
- `screenshots/05-mobile-mission-view.png`
- `screenshots/06-desktop-allocation-motion-midframe.png`

Browser QA result:

- Initial all GCS: true.
- Final MCC: 0.874.
- Final collapse probability: 0.417.
- Final autonomy debt: 25.1.
- Replay entries: 32.
- Calculation entries: 13.

Animation QA result:

- `UxV-01` before: `translate(50 70.1) scale(1)`.
- First animation frame: `translate(50.011 70.056) scale(1)`.
- 300ms mid-frame: `translate(51.855 62.509) scale(1)`.
- Settled: `translate(59.849999999999994 29.800000000000004) scale(1)`.
- First-to-mid movement: `7.7690118419268686`.
- Mid-to-settled movement: `33.671927565852236`.

Additional read-only QA audit:

- `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/manualQa.md`
- That audit verified availability, Log tab, and area mission labels on a fresh read-only pass.
- It marked full fresh live mutation verification as blocked because the audit prompt was read-only and did not allow POST/UI mutation actions. The mutating flow is covered by `browser-qa.mjs` and the screenshots above.

## Cleanup / Server State

Old QA listeners on 8000/4173 were stopped before restart.

Fresh QA servers are intentionally left running for direct user QA:

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://127.0.0.1:4173`
