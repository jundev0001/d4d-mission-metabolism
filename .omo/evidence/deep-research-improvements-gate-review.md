# Deep Research Improvements Gate Review

recommendation: REJECT

## blockers

1. Missing code-review/slop report required by the gate.
   - Checked: `.omo/evidence/deep-research-improvements/verification.md`, `.omo/evidence/deep-research-improvements/todo.md`, all files under `.omo/evidence/deep-research-improvements/`.
   - Evidence gap: the evidence set contains a todo, verification summary, preview/build logs, and screenshots, but no code review report that explicitly applies `remove-ai-slops` and `programming` criteria or covers overfit/slop risks.
   - The only adjacent note is an escape-hatch scan in `.omo/evidence/deep-research-improvements/verification.md:21`; it does not cover excessive tests, tautological tests, implementation-mirroring tests, oversized modules, or unnecessary extraction/normalization.

2. P0 A/B evaluation integrity is still not satisfied by the implementation.
   - Original backlog required measured or paired baseline handling: `Deep-Research-for-AGENTS.md:116`, `Deep-Research-for-AGENTS.md:134`, and `Deep-Research-for-AGENTS.md:147`.
   - Current implementation derives baseline replan/collapse from formulas instead of a stored/measured baseline: `frontend/src/components/EvaluationPanel.tsx:13-17`.
   - The regression test locks those formulas by asserting `48s`, `50%`, and `18pp`: `frontend/tests/evaluation-panel.test.tsx:12-28`.
   - Direct slop pass result: this is an implementation-mirroring test over a synthetic formula. It removes the old fixed literals but still does not prove a real paired A/B baseline, so the user-visible claim remains weak.

3. Programming size/slop issue introduced into an already oversized TSX component.
   - `frontend/src/components/ScenarioBuilderPanel.tsx` was already 269 pure LOC at `HEAD` and is now 359 pure LOC.
   - The implementation added `MissionIntentControls` inside that same component at `frontend/src/components/ScenarioBuilderPanel.tsx:294`.
   - Direct programming pass result: this violates the 250 pure LOC ceiling and creates maintenance burden rather than splitting the new Mission Intent controls into a focused component.

4. Backend type gate is not green and no baseline comparison proves the failures are pre-existing.
   - `.omo/evidence/deep-research-improvements/verification.md:46-48` documents basedpyright as a known gap.
   - Independent run with bundled Python: `basedpyright src` failed with 534 errors.
   - Runtime tests and ruff pass, but the typecheck gap means the programming gate is not satisfied for Python changes without a pre/post baseline proving no new type errors.

## originalIntent

The implementation pass was expected to harden the findings from `Deep-Research-for-AGENTS.md`: complete P0/P1 improvements with real code and tests, preserve an explicit evidence trail under `.omo/evidence/deep-research-improvements`, and document deferred P2 work without overclaiming it.

## desiredOutcome

The user-visible outcome should be a defensible Capability-centric Mission Metabolism MVP pass where:

- P0/P1 claims map to production code and meaningful regressions.
- Evaluation/A-B metrics are not merely re-skinned hardcoded or synthetic values.
- Evidence artifacts include todo, validation output, manual QA, and review/slop coverage.
- P2 items are clearly deferred.

## userOutcomeReview

The implementation partially satisfies the desired outcome:

- Operator-action integrity maps to code and tests: `backend/src/d4d_mission/scenario.py:45`, `backend/src/d4d_mission/immune.py:41-66`, `backend/tests/test_api.py:249-269`.
- Mission Intent round-trip maps to code and tests: `backend/src/d4d_mission/main.py:64-69`, `backend/src/d4d_mission/main.py:185-202`, `frontend/src/components/ScenarioBuilderPanel.tsx:294-380`, `frontend/src/store.ts:248-267`, `backend/tests/test_api.py:181-235`, `frontend/tests/store.test.ts:112-130`.
- `/ws/state` and CORS P1 claims map to code and tests: `frontend/src/App.tsx:27-36`, `frontend/src/store.ts:199-231`, `backend/src/d4d_mission/main.py:206`, `backend/tests/test_api.py:272-285`, `frontend/tests/store.test.ts:133-147`.
- Deferred P2 items are documented in `.omo/evidence/deep-research-improvements/todo.md:17-20` and `.omo/evidence/deep-research-improvements/verification.md:50-53`.

The outcome is not approvable because the A/B evaluation P0 remains synthetic, the review/slop evidence is absent, an oversized component grew further, and backend typecheck is not green.

## checked artifact paths

- `Deep-Research-for-AGENTS.md`
- `.omo/evidence/deep-research-improvements/todo.md`
- `.omo/evidence/deep-research-improvements/verification.md`
- `.omo/evidence/deep-research-improvements/frontend-build-8001.log`
- `.omo/evidence/deep-research-improvements/backend-preview.log`
- `.omo/evidence/deep-research-improvements/backend-preview-8001.log`
- `.omo/evidence/deep-research-improvements/frontend-preview.log`
- `.omo/evidence/deep-research-improvements/frontend-preview-4174.log`
- `.omo/evidence/deep-research-improvements/desktop-mission.png`
- `.omo/evidence/deep-research-improvements/desktop-builder.png`
- `.omo/evidence/deep-research-improvements/mobile-builder.png`
- `backend/src/d4d_mission/main.py`
- `backend/src/d4d_mission/scenario.py`
- `backend/src/d4d_mission/immune.py`
- `backend/tests/test_api.py`
- `frontend/src/App.tsx`
- `frontend/src/store.ts`
- `frontend/src/components/EvaluationPanel.tsx`
- `frontend/src/components/ScenarioBuilderPanel.tsx`
- `frontend/tests/evaluation-panel.test.tsx`
- `frontend/tests/store.test.ts`
- `frontend/tests/custom-scenario.test.ts`
- `frontend/tests/app-tabs.test.tsx`

## validation commands inspected

Local commands run:

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 8 files / 28 tests.
- Bundled Python `-m pytest`: PASS, 41 tests, 1 Starlette/httpx deprecation warning.
- Bundled Python `-m ruff check src tests`: PASS.
- Bundled Python `-m basedpyright src`: FAIL, 534 errors.

Artifact logs inspected:

- `frontend-build-8001.log` shows `tsc -b && vite build` passed.
- Backend preview logs include bind failures on occupied ports before later request lines; they are not clean validation transcripts.
- Manual QA is summarized in `verification.md` and supported by three screenshots, but no Playwright script/output transcript is preserved.

## exact evidence gaps

- No code-review report artifact with `remove-ai-slops`, `programming`, and overfit/slop criterion coverage.
- No preserved transcript files for `npm run lint`, `npm run typecheck`, `npm run test`, backend `ruff`, backend `pytest`, or backend `basedpyright`.
- No baseline comparison artifact showing basedpyright failures are pre-existing rather than introduced.
- No manual QA matrix with step/result rows; only a prose summary plus screenshots.
- No notepad path was provided in the input bundle.

## non-blocking gaps

- `backend-preview.log` and `backend-preview-8001.log` contain port bind failures, so future evidence should record the final successful listener separately.
- The evidence says isolated QA used frontend `127.0.0.1:4174`, while `frontend-preview-4174.log` shows Vite fell through to `4176`; screenshots still demonstrate rendered UI, but the port story is muddy.
- `python` in the artifact command is not reproducible from PATH in this shell; the backend gates required the bundled Codex Python path.
