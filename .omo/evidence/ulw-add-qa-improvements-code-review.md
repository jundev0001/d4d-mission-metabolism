# ULW Add QA Improvements Code Review

Review date: 2026-07-05 KST
Workspace: `C:\Users\Jun\Documents\D4D`
Review mode: read-only code quality review; no implementation files edited.

## Status

- `codeQualityStatus`: `BLOCK`
- `recommendation`: `REQUEST_CHANGES`
- `reportPath`: `.omo/evidence/ulw-add-qa-improvements-code-review.md`

## Skill Perspective Check

- `remove-ai-slops`: Ran by loading `C:\Users\Jun\.codex\plugins\cache\sisyphuslabs\omo\4.15.1\skills\remove-ai-slops\SKILL.md` and applying its overfit/slop review criteria to production and tests.
- `programming`: Ran by loading `C:\Users\Jun\.codex\plugins\cache\sisyphuslabs\omo\4.15.1\skills\programming\SKILL.md`, plus the Python and TypeScript reference README files.
- Result: The diff violates both perspectives. The largest violations are oversized changed modules, an overfit blackbox test that misses realistic replay ordering, and a TypeScript type assertion escape hatch.

## Verification Performed

- `npm test -- tests/app-tabs.test.tsx tests/fleet-deployment-panel.test.tsx tests/map-view.test.tsx tests/blackbox-panel.test.tsx` from `frontend`: PASS, 4 files / 12 tests.
- `npm run typecheck` from `frontend`: PASS.
- `npm run lint` from `frontend`: PASS.
- Escape-hatch scan across scoped backend/frontend files found one TypeScript assertion: `frontend/src/components/FleetAssetList.tsx:128`.
- Pure LOC scan:
  - `backend/src/d4d_mission/state.py`: 276 current, 230 at `HEAD`.
  - `frontend/src/components/MapView.tsx`: 372 current, 198 at `HEAD`.
  - `frontend/src/types.ts`: 250 current, 230 at `HEAD`.
  - `frontend/src/components/FleetAssetList.tsx`: 226 current, 62 at `HEAD`.
- Backend API tests were not runnable in this session: `uv` was unavailable in Git Bash, and only the Windows Store Python shim was visible from PowerShell. The user-provided gate note says backend ruff/pytest pass, but I could not independently rerun them.

## CRITICAL

None.

## HIGH

1. Oversized changed modules violate the project programming and remove-ai-slops thresholds.

   - `C:\Users\Jun\Documents\D4D\frontend\src\components\MapView.tsx:280`
   - `C:\Users\Jun\Documents\D4D\frontend\src\components\MapView.tsx:310`
   - `C:\Users\Jun\Documents\D4D\frontend\src\components\MapView.tsx:350`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\state.py:186`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\state.py:289`

   The rollout added path-building helpers directly into `MapView.tsx`, growing it from 198 to 372 pure LOC, and added tuning/logging behavior to `state.py`, growing it from 230 to 276 pure LOC. The loaded `programming` and `remove-ai-slops` skills both treat files above 250 pure LOC as a defect, not a style preference. This is a blocker because it concentrates rendering, COP interaction, path derivation, and action overlay logic in one component, making the live demo path behavior harder to review and extend safely.

2. The calculation log can show stale math while newer calculation entries exist.

   - `C:\Users\Jun\Documents\D4D\frontend\src\components\BlackBoxPanel.tsx:10`
   - `C:\Users\Jun\Documents\D4D\frontend\src\components\BlackBoxPanel.tsx:101`
   - `C:\Users\Jun\Documents\D4D\frontend\src\store.ts:67`
   - `C:\Users\Jun\Documents\D4D\frontend\src\store.ts:98`
   - `C:\Users\Jun\Documents\D4D\frontend\src\store.ts:108`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\state.py:81`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\state.py:87`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\blackbox.py:31`

   Backend replay is chronological and starts with `mission initialized`, then `mission_initialized` calculation, then later tune/event/decision calculations. The store initializes or resets `selectedReplayIndex` to `0`, and tune/event paths keep the old selection. `BlackBoxPanel` parses the selected entry, and if that is not a calculation, falls back to `firstCalculationTrace(replay)`, which iterates from the beginning. In a realistic replay after vehicle tuning or event injection, the detail panel can therefore show the earliest initialization calculation while newer `vehicle_parameter_tune` or `event_*` calculations exist. That directly conflicts with the requested "Log tab showing actual calculations" and is a stale UI risk for live demo QA.

3. Vehicle parameter tuning skews paired baseline metrics.

   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\state.py:195`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\state.py:201`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\scenario.py:46`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\scenario.py:142`
   - `C:\Users\Jun\Documents\D4D\backend\src\d4d_mission\scenario.py:185`

   `tune_vehicle` updates only `snapshot.vehicles`; it does not update `baseline_vehicles`. Since `create_initial_snapshot` sets `baseline_vehicles`, `_baseline_projection` continues to evaluate the baseline against the old vehicle health/status after a tune. If tuning is the demo control for scenario parameters, the baseline and assisted run should start from the same tuned fleet condition; otherwise the A/B metrics and calculation trace `baseline_mcc` can look better or worse for reasons unrelated to the assisted mission logic.

## MEDIUM

1. Tests do not cover the realistic replay ordering that the log panel receives.

   - `C:\Users\Jun\Documents\D4D\frontend\tests\blackbox-panel.test.tsx:9`
   - `C:\Users\Jun\Documents\D4D\frontend\tests\blackbox-panel.test.tsx:33`

   The test fixture contains exactly one replay entry and it is already a calculation entry. It would pass even if the panel showed the first calculation forever in real chronological replay. This is an overfit test under the remove-ai-slops perspective because it proves the happy rendering of a hand-picked payload, not the log tab behavior after mission initialization plus later tune/event calculations.

2. Backend calculation-log test checks raw JSON substring rather than parsing the contract.

   - `C:\Users\Jun\Documents\D4D\backend\tests\test_api.py:354`
   - `C:\Users\Jun\Documents\D4D\backend\tests\test_api.py:358`

   The test confirms a calculation entry exists and then asserts a literal JSON substring. That is brittle and does not verify the calculation trace shape, values, or area MCC content through the same schema the frontend depends on.

3. COP path tests assert existence, not animation behavior or mission-path behavior.

   - `C:\Users\Jun\Documents\D4D\frontend\tests\map-view.test.tsx:110`
   - `C:\Users\Jun\Documents\D4D\frontend\tests\map-view.test.tsx:136`

   The test checks mission label text and one action-path element. It does not verify the mission activity path layer, allocation approval paths, or that animation classes/styles are actually applied. This is a coverage gap for the requested "COP mission/action path animation" behavior.

## LOW

1. TypeScript status select uses a type assertion escape hatch.

   - `C:\Users\Jun\Documents\D4D\frontend\src\components\FleetAssetList.tsx:128`

   `event.currentTarget.value as VehicleStatus` bypasses the TypeScript parser/narrowing rule from the loaded programming perspective. The DOM options are controlled, so this is not currently a demo blocker, but it should be narrowed through the known `STATUS_OPTIONS` values instead of asserted.

## Blockers

- Split or otherwise reduce the newly oversized `MapView.tsx` and `state.py` responsibilities so changed production files comply with the 250 pure LOC threshold or carry an explicit, justified project-approved exception.
- Make the calculation log select/show the latest relevant calculation or the calculation corresponding to the selected row; add a test with realistic chronological replay containing mission, calculation, tune/event, and later calculation entries.
- Decide the intended semantics of vehicle tuning and fix/test the paired baseline accordingly. If tuning is scenario-state input, update baseline projection state consistently; if it is an assisted intervention, label and test it as such.

