# ULW Add QA Improvements Gate Re-Review

## recommendation

APPROVE

## blockers

None for the previous blocker or immediate regression scope.

## originalIntent

Re-review only the prior gate blocker after the executor removed `dict[str, object]` from `backend/src/d4d_mission/runtime_support.py` and the same update-dictionary pattern from `backend/src/d4d_mission/state.py`.

## desiredOutcome

Return PASS/BLOCK for the previous blocker and any immediate regression from the fix, with direct source inspection and feasible focused verification.

## userOutcomeReview

The prior production slop blocker is resolved. `backend/src/d4d_mission/runtime_support.py` now computes concrete `vehicles` / `baseline_vehicles` values and passes literal `model_copy(update=...)` dictionaries without annotating `object`. `backend/src/d4d_mission/state.py` now delegates allocation refresh to `refresh_allocation_snapshot`, removing the previous `updates: dict[str, object]` pattern from the runtime method.

No immediate allocation/tuning regression was found in source inspection. The new helper preserves the old allocation semantics:

- no events: update vehicles, assignments, baseline mission, baseline vehicles, and baseline assignments before `refresh_snapshot`
- after events: update only active vehicles and assignments before `refresh_snapshot`
- tuning: update active vehicles and, when present, paired baseline vehicles before `refresh_snapshot`

## checkedArtifactPaths

- `backend/src/d4d_mission/runtime_support.py`
- `backend/src/d4d_mission/state.py`
- `backend/tests/test_api.py`
- `.omo/evidence/ulw-add-qa-improvements-gate-review.md`

## directEvidence

- Loaded and applied `omo:remove-ai-slops`.
- Loaded and applied `omo:programming`, including Python README and code-smells reference.
- CodeGraph inspected the current call path: `MissionRuntime.allocation` -> `refresh_allocation_snapshot` -> `refresh_snapshot`.
- Focused source scan:
  - `rg -n "dict\\[str, object\\]|\\bas object\\b| as VehicleStatus" backend/src frontend/src`
  - result: no matches
- Focused no-excuse source scan over `state.py` and `runtime_support.py` found no `object`, `Any`, `cast`, type-ignore, pyright-ignore, broad except, or bare except matches.
- Pure LOC:
  - `backend/src/d4d_mission/state.py`: 237
  - `backend/src/d4d_mission/runtime_support.py`: 103
  - `frontend/src/components/MapView.tsx`: 213
  - `frontend/src/components/MapPathOverlays.tsx`: 152
  - `frontend/src/components/FleetAssetList.tsx`: 228
  - `frontend/src/types.ts`: 250
- Live server smoke checks:
  - `GET http://127.0.0.1:8000` returned 200
  - `GET http://127.0.0.1:4173` returned 200
  - `GET http://127.0.0.1:8000/` returned mission id `mission-seoul-isr`
  - `GET http://127.0.0.1:8000/replay` returned mission and calculation entries

## exactEvidenceGaps

- Backend `ruff` and `pytest` could not be independently rerun in this shell. `uv` is unavailable in PowerShell and Git Bash, no local `.venv` was present, and no local `pytest.exe` / `ruff.exe` binaries were found. The user reported both backend gates pass; this re-review could not verify those commands directly.
- I did not run mutating live API calls because the requested scope was read-only re-review of the previous production-code blocker and immediate source regression.

## conclusion

The previous blocker is cleared, and no immediate regression was found in the focused source and live-read checks.
