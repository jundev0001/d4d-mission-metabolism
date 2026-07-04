# Deep Research Improvements Backend Code Review

Repository: `C:\Users\Jun\Documents\D4D`
Review scope: read-only backend review of:

- `backend/src/d4d_mission/main.py`
- `backend/src/d4d_mission/scenario.py`
- `backend/src/d4d_mission/allocator.py`
- `backend/src/d4d_mission/response_planner.py`
- `backend/tests/test_api.py`
- `backend/tests/test_allocator.py`

## Skill Perspective Check

- `omo:remove-ai-slops`: loaded and applied as a review lens for production and test diff. No deletion-only tests, tautological tests, implementation-constant-only tests, or needless production parsing/normalization were found in the backend scope. The new tests exercise API behavior through FastAPI `TestClient`.
- `omo:programming`: loaded, plus `references/python/README.md` for Python backend review. The backend diff keeps typed Pydantic boundaries for mission configuration and does not introduce `Any`, `type: ignore`, broad `except`, or untyped dict signatures in the reviewed changes.
- Verdict: no CRITICAL/HIGH violation of either skill perspective. One LOW CORS configuration edge is listed below.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

1. `backend/src/d4d_mission/main.py:205` - Blank-but-present `D4D_CORS_ORIGINS` disables all CORS origins instead of preserving the localhost defaults.

   Blocking: no.

   `_cors_origins()` falls back only when the env var is absent. If the variable is present but empty or whitespace, the parsed list is empty, and even the expected local QA origin is rejected. I verified this in a temp backend copy with `D4D_CORS_ORIGINS='   '`: preflight from `http://127.0.0.1:4173` returned `400` with no `access-control-allow-origin`. If blank config is meant to mean "no browser origins", document it. Otherwise, treat an empty parsed list like unset and add a regression test.

## Backend Behavior Review

- Operator-action metric integrity: `backend/src/d4d_mission/scenario.py:59` no longer increments `assisted_operator_actions` during event injection. Human decisions still increment via `backend/src/d4d_mission/immune_actions.py:119`, where `set_recommendation_status()` applies `DecisionImpact.operator_delta`.
- Mission Intent constraints/autonomy round-trip: `backend/src/d4d_mission/main.py:64` adds `constraints` and `autonomy_level` to the configure request, and `backend/src/d4d_mission/main.py:185` passes them into `Mission`. The API test at `backend/tests/test_api.py:176` asserts the response contains the submitted constraints and autonomy value, then allocates within the custom areas.
- CORS origins: default localhost origins are still covered by `backend/tests/test_api.py:10`; populated env override is covered by `backend/tests/test_api.py:272`. The LOW finding above is limited to blank env input.
- Recommendation card behavior: event injection still inserts the recommendation card into state with an `event_id` at `backend/src/d4d_mission/scenario.py:58`, and the new operator-action regression at `backend/tests/test_api.py:249` drives event injection followed by approval through the HTTP surface.
- Allocator and response planner reviewed changes are formatting-only in the backend diff.

## Verification

To avoid mutating the checkout, backend commands were run from a temporary copy:

`C:\Users\Jun\AppData\Local\Temp\d4d-backend-review-c0f2531105584d2caf13f67baebe7abe\backend`

Commands and outcomes:

- `git diff --check -- backend/src/d4d_mission/main.py backend/src/d4d_mission/scenario.py backend/src/d4d_mission/allocator.py backend/src/d4d_mission/response_planner.py backend/tests/test_api.py backend/tests/test_allocator.py`: pass; only Git LF-to-CRLF warnings.
- `uv run pytest tests/test_api.py tests/test_allocator.py`: 20 passed, 1 Starlette/httpx deprecation warning.
- `uv run pytest`: 41 passed, 1 Starlette/httpx deprecation warning.
- `uv run ruff check src tests`: pass.
- `uv run basedpyright`: 0 errors, 0 warnings, 0 notes.

Existing `.omo/evidence/deep-research-improvements/verification.md` was inspected but treated as untrusted. Its backend preview logs include port bind failures, so the review relies on the fresh temp-copy command results above rather than those preview logs.

## Status

codeQualityStatus: WATCH
recommendation: APPROVE
blockers: none
