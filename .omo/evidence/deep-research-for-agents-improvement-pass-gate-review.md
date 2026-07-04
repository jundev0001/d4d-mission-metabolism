# Deep Research for AGENTS Improvement Pass Gate Review

recommendation: REJECT

## blockers

1. Unresolved `omo:programming` size/slop blocker in changed frontend source.
   - Direct check: changed source files still exceed the strict 250 pure-LOC ceiling.
   - Newly introduced/worsened cases:
     - `frontend/src/components/MapView.tsx`: HEAD 194 pure LOC, current 284 pure LOC. The pass added 102 lines, including cluster/display helpers at `frontend/src/components/MapView.tsx:217`, `frontend/src/components/MapView.tsx:248`, `frontend/src/components/MapView.tsx:267`, `frontend/src/components/MapView.tsx:283`, `frontend/src/components/MapView.tsx:297`, and `frontend/src/components/MapView.tsx:301`.
     - `frontend/src/store.ts`: HEAD 231 pure LOC, current 274 pure LOC. The pass added WebSocket fallback/parsing logic at `frontend/src/store.ts:200` and `frontend/src/store.ts:250`.
     - `frontend/src/components/ScenarioBuilderPanel.tsx`: HEAD 269 pure LOC, current 274 pure LOC after being touched.
   - Evidence confirms this was knowingly deferred: `.omo/evidence/deep-research-improvements/review-criteria.md:23` and `.omo/evidence/deep-research-improvements/review-criteria.md:25`.
   - Gate impact: the loaded programming criteria treat >250 pure LOC as a defect, not a later polish item. Approval would accept unresolved maintenance burden introduced by the pass.

2. Evidence bundle still contains unsupported or contradictory review claims.
   - `.omo/evidence/frontend-follow-up-code-review.md:59` claims `npm test -- store.test.ts evaluation-panel.test.tsx mission-intent-controls.test.tsx` passed, but `frontend/tests/mission-intent-controls.test.tsx` does not exist. Direct file listing found only `frontend/tests/store.test.ts` and `frontend/tests/evaluation-panel.test.tsx` for those names.
   - `.omo/evidence/deep-research-improvements-followup-visual-gate-review.md:3` is still a `REJECT`, with blockers described at `.omo/evidence/deep-research-improvements-followup-visual-gate-review.md:17` and `.omo/evidence/deep-research-improvements-followup-visual-gate-review.md:29`.
   - `.omo/evidence/deep-research-improvements/verification.md:27` claims browser QA passed, while the preserved follow-up visual gate rejects. The current screenshots appear to resolve the old CCR word-break issue, but no fresh approving visual gate artifact supersedes the reject.
   - Gate impact: final claims are not fully supported by the artifact set. Counts and summaries cannot override an unsupported command claim and an unresolved reject artifact.

3. Python strict test typecheck remains an explicit evidence gap.
   - Supported claim: configured production backend `basedpyright` passes for `src` with the bundled Python path. I independently ran it and got `0 errors, 0 warnings, 0 notes`.
   - Remaining gap: `.omo/evidence/deep-research-improvements/verification.md:62` says `basedpyright src tests` still reports 160 strict test-only errors. The changed backend test file `backend/tests/test_api.py` is therefore not covered by a clean strict Python type gate.
   - Gate impact: not a runtime failure, but it prevents the evidence bundle from satisfying the stronger programming claim that changed Python tests are strict-clean.

## originalIntent

Review the current uncommitted Deep-Research-for-AGENTS improvement pass from the user's perspective. The expected outcome is a defensible pass that closes the prior P0/P1 gaps: backend paired baseline metrics, Mission Intent governance, operator-action integrity, CORS/basedpyright path hardening, WebSocket fallback, visual evidence, and review/slop evidence without unsupported final claims.

## desiredOutcome

The user should be able to trust that:

- Backend paired baseline metrics are real state fields, not frontend hardcoding.
- Backend typecheck is reproducible on this Windows Codex host with the documented path fix.
- Evidence artifacts are current, mutually consistent, and support the final claims.
- `remove-ai-slops` and `programming` criteria have no unresolved blockers.

## userOutcomeReview

The latest backend-focused work is mostly supported:

- `backend/src/d4d_mission/scenario.py` keeps baseline mission/fleet/assignment state and computes `baseline_metrics` from that track.
- `frontend/src/components/EvaluationPanel.tsx` now renders `dashboard.baseline_metrics` rather than hardcoded or frontend-derived baseline constants.
- `backend/pyproject.toml:28` adds `executionEnvironments = [{ root = "src", extraPaths = ["src"] }]`; my independent `python -m basedpyright` run passed with the bundled Python path.
- Backend pytest, backend ruff, frontend lint, frontend typecheck, and frontend tests all passed in this gate review.

The overall user-visible outcome is not approvable because the evidence bundle still overclaims review/test coverage, a preserved visual review remains rejected, and the diff introduces or leaves changed files over the strict programming LOC gate.

## checked artifact paths

- `Deep-Research-for-AGENTS.md`
- `.omo/evidence/deep-research-improvements/verification.md`
- `.omo/evidence/deep-research-improvements/review-criteria.md`
- `.omo/evidence/deep-research-improvements/todo.md`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/manualQa.md`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/02-mission-configure.txt`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/08-operator-action-summary.txt`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/09-websocket-live-update.txt`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/10-cors-allowed-custom-origin.txt`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/11-cors-blocked-origin.txt`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/12-backend-focused-pytest.txt`
- `.omo/evidence/deep-research-improvements/manual-runtime-qa/13-frontend-focused-vitest.txt`
- `.omo/evidence/deep-research-improvements/desktop-mission.png`
- `.omo/evidence/deep-research-improvements/mobile-mission.png`
- `.omo/evidence/deep-research-improvements/desktop-builder.png`
- `.omo/evidence/deep-research-improvements/mobile-builder.png`
- `.omo/evidence/deep-research-improvements-gate-review.md`
- `.omo/evidence/deep-research-improvements-backend-code-review.md`
- `.omo/evidence/frontend-working-tree-diff-code-review.md`
- `.omo/evidence/frontend-follow-up-code-review.md`
- `.omo/evidence/deep-research-improvements-visual-gate-review.md`
- `.omo/evidence/deep-research-improvements-followup-visual-gate-review.md`
- `backend/pyproject.toml`
- `backend/src/d4d_mission/main.py`
- `backend/src/d4d_mission/scenario.py`
- `backend/src/d4d_mission/state.py`
- `backend/src/d4d_mission/deployment.py`
- `backend/tests/test_api.py`
- `frontend/src/App.tsx`
- `frontend/src/store.ts`
- `frontend/src/types.ts`
- `frontend/src/components/EvaluationPanel.tsx`
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/MapAssetGlyph.tsx`
- `frontend/src/components/MissionIntentControls.tsx`
- `frontend/src/components/ScenarioBuilderPanel.tsx`
- `frontend/tests/evaluation-panel.test.tsx`
- `frontend/tests/store.test.ts`

## direct verification

- `backend`: `python -m pytest` passed, 44 tests, 1 Starlette/httpx deprecation warning.
- `backend`: `python -m ruff check src tests` passed.
- `backend`: `python -m basedpyright` passed, 0 errors / 0 warnings / 0 notes, with `C:/Users/Jun/.cache/codex-runtimes/codex-primary-runtime/dependencies/python` prepended to `PATH`.
- `frontend`: `npm run typecheck` passed.
- `frontend`: `npm run lint` passed.
- `frontend`: `npm run test` passed, 8 files / 29 tests.
- `git diff --check` passed aside from LF-to-CRLF warnings.
- Direct API serialization check passed with `PYTHONPATH=src`: public dashboard JSON includes `baseline_metrics` and excludes `baseline_mission`, `baseline_vehicles`, and `baseline_assignments`.

## exact evidence gaps

- No approving final visual gate artifact supersedes `.omo/evidence/deep-research-improvements-followup-visual-gate-review.md`.
- The frontend follow-up review references a nonexistent test file, so its verification statement is unsupported.
- The evidence acknowledges changed files above 250 pure LOC but defers the split instead of resolving the programming blocker.
- The configured backend type gate covers `src`, but the evidence says `basedpyright src tests` remains dirty and provides no clean pre/post baseline for changed test files.
- No notepad path was provided in the input bundle.
