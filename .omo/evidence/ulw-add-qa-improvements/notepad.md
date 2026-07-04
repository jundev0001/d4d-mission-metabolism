# ULW Add QA Improvements Notepad

## Tier

HEAVY. The request changes cross-layer mission behavior, domain state, frontend COP visualization, controls, tests, and browser-facing QA.

## Skills

- `omo:ulw-plan`: Used for heavy multi-step planning discipline, but execution continues because the user explicitly requested `ulw add` with concrete implementation items.
- `omo:programming`: Required for TypeScript/Python changes; loaded TypeScript and Python references.
- `omo:frontend`: Required for React UI, layout, motion, and design-system compliance; loaded design and perfection rules plus project `DESIGN.md`.
- `omo:visual-qa`: Required after UI changes; will capture browser evidence at desktop/tablet/mobile and action states.
- `omo:review-work`: Required after significant implementation; will run independent review gates.

## Success Criteria

1. Log tab shows actual computation/replay evidence: black box entries, KPI deltas, mission calculations, and decisions are visible without guessing.
2. COP visibly explains decisions: initial GCS staging, approved allocation movement, ongoing area missions, reserve posture, and recommendation action paths are animated or otherwise spatially legible.
3. Vehicle type/status parameters are adjustable from the UI and change scenario capability state through the backend contract, with typed validation and test coverage.
4. Each area visibly states its mission, priority, threat, and capability demand on the COP and associated panels.
5. Initial scenario starts with UxVs staged at GCS, requires approval for optimized A/B/C task force assignment, keeps surplus as reserve, and supports priority-based reserve/cross-area recovery.

## Real-Surface Scenarios

- Browser scenario A: `http://127.0.0.1:4173`, reset mission, verify all assets start at GCS, click initial allocation approval, observe COP movement trails and area mission labels.
- Browser scenario B: inject a B-area event, approve recommendation, verify reserve or lower-priority drawdown path is shown on COP and reflected in logs.
- Browser scenario C: open Log tab, verify calculation entries show MCC/collapse/debt/CCR inputs and output deltas.
- Browser scenario D: adjust vehicle status/type parameters, apply, verify metric changes and recalculation log.

## Current Findings

- Existing backend already records black box entries and an approved optimized allocation event.
- Existing frontend already has workspace tabs, recommendation cards, COP map, custom mission/fleet controls, and replay API plumbing.
- Missing user-visible surfaces are calculation log as a first-class tab, explicit mission labels per area, and animation traces/path explanation tied to approvals/events.

## Implementation Notes

- Added backend `CalculationTrace` plus replay entries for reset, configuration, allocation, event injection, decision, and vehicle-parameter tuning recalculations.
- Added `POST /fleet/vehicle/tune` so UI parameter changes update vehicle health/status and trigger fresh metrics/replay data.
- Added frontend `계산 로그` tab backed by black box replay parsing, with MCC, baseline MCC, collapse probability, autonomy debt, CCR, assigned assets, and area MCC detail.
- Added COP area mission labels, priority/threat readouts, subtle active mission paths, and animated approved/manual recommendation action paths.
- Added per-vehicle battery/link/nav/sensor/status controls in the fleet panel and wired them to the new tune API.
- Added client-side COP asset position interpolation so UxV glyphs and info cards move between old and new coordinates instead of teleporting when backend state changes.
- Added a `편성 승인` control to the visible `임무 판단` UxV panel so the operator can approve optimized A/B/C allocation while the COP remains on screen.

## Gate Results

- RED targeted frontend tests failed before implementation for missing log tab, calculation details, tuning controls, and COP action/mission labels.
- RED backend API test failed before implementation because `/fleet/vehicle/tune` returned `404`.
- Backend targeted API test after implementation: `14 passed, 1 warning`.
- Frontend targeted tests after implementation: `4 files, 12 tests passed`.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend full Vitest: `10 files, 34 tests passed`.
- Frontend build: passed.
- Backend ruff: passed.
- Backend pytest: `45 passed, 1 warning`.
- Backend basedpyright: failed with existing repository-wide Pydantic member/type inference errors (`593 errors`), including many pre-existing `model_copy`/model member unknown-type reports outside this change scope.
- Follow-up animation targeted tests after movement fix: `3 files, 13 tests passed`.
- Follow-up animation frontend lint/typecheck/build: passed.

## Post-Review Fixes

- Code reviewer initially returned `BLOCK` in `.omo/evidence/ulw-add-qa-improvements-code-review.md`.
- Fixed stale calculation detail by showing the latest calculation when the selected replay row is non-calculation.
- Added realistic chronological replay coverage for the log tab.
- Fixed vehicle tuning baseline semantics: tuned health/status now updates the current fleet and paired baseline fleet before metrics are refreshed.
- Replaced raw JSON substring backend assertion with `CalculationTrace.model_validate_json`.
- Split COP path overlay logic from `MapView.tsx` into `MapPathOverlays.tsx`.
- Split runtime support from `state.py` into `runtime_support.py`.
- Removed the `VehicleStatus` type assertion in the fleet parameter select.
- Pure LOC after split:
  - `backend/src/d4d_mission/state.py`: 241
  - `backend/src/d4d_mission/runtime_support.py`: 80
  - `frontend/src/components/MapView.tsx`: 213
  - `frontend/src/components/MapPathOverlays.tsx`: 152
  - `frontend/src/components/FleetAssetList.tsx`: 228
  - `frontend/src/types.ts`: 250

## Browser QA

- Fresh servers:
  - backend: `http://127.0.0.1:8000`
  - frontend: `http://127.0.0.1:4173`
- Browser QA script: `.omo/evidence/ulw-add-qa-improvements/browser-qa.mjs`.
- Browser QA summary: `.omo/evidence/ulw-add-qa-improvements/browser-qa-summary.json`.
- Asset animation QA script: `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa.mjs`.
- Asset animation QA summary: `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa-summary.json`.
- Screenshots:
  - `.omo/evidence/ulw-add-qa-improvements/screenshots/01-desktop-initial-gcs.png`
  - `.omo/evidence/ulw-add-qa-improvements/screenshots/02-desktop-allocation-paths.png`
  - `.omo/evidence/ulw-add-qa-improvements/screenshots/03-desktop-event-approved-paths.png`
  - `.omo/evidence/ulw-add-qa-improvements/screenshots/04-desktop-log-and-tune.png`
  - `.omo/evidence/ulw-add-qa-improvements/screenshots/05-mobile-mission-view.png`
  - `.omo/evidence/ulw-add-qa-improvements/screenshots/06-desktop-allocation-motion-midframe.png`
- Browser QA result:
  - initial all GCS: true
  - final MCC: 0.874
  - final collapse probability: 0.417
  - final autonomy debt: 25.1
  - replay entries: 32
  - calculation entries: 13
- Asset animation QA result:
  - vehicle: `UxV-01`
  - before transform: `translate(50 70.1) scale(1)`
  - first animation frame: `translate(50.011 70.056) scale(1)`
  - 300ms mid frame: `translate(51.855 62.509) scale(1)`
  - settled frame: `translate(59.849999999999994 29.800000000000004) scale(1)`
  - total sampled movement: `41.486292917058755`
  - first-to-mid movement: `7.7690118419268686`
  - mid-to-settled movement: `33.671927565852236`
- Read-only QA executor added `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/manualQa.md` and blocked only the fresh mutation reproduction because it was instructed not to mutate live state. The mutating path is covered by the saved Playwright QA script and screenshots above.
