# Frontend Working Tree Diff Code Review

Repository: `C:\Users\Jun\Documents\D4D`

Scope reviewed:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/store.ts`
- `frontend/src/customScenario.ts`
- `frontend/src/defaultCustomScenario.ts`
- `frontend/src/types.ts`
- `frontend/src/components/ScenarioBuilderPanel.tsx`
- `frontend/src/components/EvaluationPanel.tsx`
- `frontend/src/styles/builder.css`
- related frontend tests

Status: BLOCK

Recommendation: REQUEST_CHANGES

## Skill Perspective Check

Ran required skill-perspective review before judging:
- `omo:remove-ai-slops`: applied review criteria for overfit/slop tests, implementation-mirroring tests, needless production complexity, deletion-only tests, and false confidence.
- `omo:programming`: loaded TypeScript reference and applied strict TS review criteria for typed boundaries, brittle tests, no untyped escape hatches, unnecessary abstraction, and parse-at-boundary discipline.

Violations found:
- `remove-ai-slops`: `frontend/tests/evaluation-panel.test.tsx` mirrors newly introduced implementation constants/formulas instead of proving an observable baseline metric contract.
- `programming`: production `EvaluationPanel` derives evaluation baseline values from current assisted metrics, which is a domain/data-contract issue rather than type-level proof; tests do not guard the boundary where real baseline metrics should enter.

## Evidence

Commands run:
- `git status --short`
- `git diff -- <requested frontend files and frontend/tests>`
- `git diff --cached -- <requested frontend files and frontend/tests>`
- `npm test -- store.test.ts custom-scenario.test.ts app-tabs.test.tsx evaluation-panel.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm test`

Results:
- Targeted frontend tests: PASS, 4 files / 15 tests.
- Frontend typecheck: PASS.
- Frontend lint: PASS.
- Full frontend tests: PASS, 8 files / 28 tests.
- No staged frontend diff in the requested scope.

## CRITICAL

None.

## HIGH

### Blocking: EvaluationPanel presents synthetic baseline metrics as evidence

Files:
- `frontend/src/components/EvaluationPanel.tsx:11`
- `frontend/src/components/EvaluationPanel.tsx:13`
- `frontend/src/components/EvaluationPanel.tsx:14`
- `frontend/src/components/EvaluationPanel.tsx:15`
- `frontend/src/components/EvaluationPanel.tsx:37`
- `frontend/src/components/EvaluationPanel.tsx:43`
- `frontend/src/components/EvaluationPanel.tsx:49`
- `frontend/tests/evaluation-panel.test.tsx:12`
- `frontend/tests/evaluation-panel.test.tsx:30`
- `frontend/tests/evaluation-panel.test.tsx:31`
- `frontend/tests/evaluation-panel.test.tsx:32`

`EvaluationPanel` labels values as baseline/support comparison, but derives baseline replan time as `baseline_operator_actions * 4` and baseline collapse probability as `current collapse + 0.18`. That is still a fabricated baseline, just no longer a literal hard-coded `46s` / `64%`. It can overstate improvement and undermines the A/B evaluation claim the dashboard is supposed to support.

The new test locks those formulas (`48s`, `50%`, `18pp`) instead of a real data contract, so it creates false confidence and will pass as long as the arbitrary constants remain.

Blocking: yes. The panel should either consume explicit baseline metrics/counterfactual data from the backend or clearly label these values as estimates and test that contract.

### Blocking: WebSocket lifecycle has no close/error fallback or stale-state signal

Files:
- `frontend/src/App.tsx:33`
- `frontend/src/App.tsx:35`
- `frontend/src/store.ts:199`
- `frontend/src/store.ts:200`
- `frontend/src/store.ts:201`
- `frontend/src/store.ts:207`
- `frontend/tests/store.test.ts:133`
- `frontend/tests/store.test.ts:145`

`App` starts `hydrate()` and immediately opens the live WebSocket, but `connectLive` only handles `message` and cleanup. There is no `error` or `close` handler, no retry/backoff, no REST polling fallback, and no `lastError`/stale-state indication if the live feed dies after initial hydration.

The test only proves valid messages update state and `cleanup()` closes the socket. It does not cover socket construction failure, server close, error events, reconnect, or REST fallback behavior.

Blocking: yes for the requested WebSocket lifecycle/fallback review. A live mission dashboard should not silently freeze when the socket drops.

## MEDIUM

### Mission Intent controls are not covered at the UI/control-state level

Files:
- `frontend/src/components/ScenarioBuilderPanel.tsx:240`
- `frontend/src/components/ScenarioBuilderPanel.tsx:294`
- `frontend/src/components/ScenarioBuilderPanel.tsx:312`
- `frontend/src/components/ScenarioBuilderPanel.tsx:316`
- `frontend/src/components/ScenarioBuilderPanel.tsx:342`
- `frontend/src/components/ScenarioBuilderPanel.tsx:356`
- `frontend/tests/app-tabs.test.tsx:63`
- `frontend/tests/store.test.ts:112`

The new `MissionIntentControls` UI is not rendered by the current tests. `app-tabs.test.tsx` mocks `ScenarioBuilderPanel`, and `store.test.ts` checks only the default scenario payload. A broken range/checkbox UI, failed `onChange`, or changed custom scenario value not reaching `configureCustomMission` would not be caught.

Blocking: no, but this is a meaningful coverage gap for new user-facing controls.

### Relay minimum can exceed the displayed UI limit

Files:
- `frontend/src/components/ScenarioBuilderPanel.tsx:356`
- `frontend/src/components/ScenarioBuilderPanel.tsx:359`
- `frontend/src/components/ScenarioBuilderPanel.tsx:360`
- `frontend/src/components/ScenarioBuilderPanel.tsx:362`
- `frontend/src/customScenario.ts:27`
- `backend/src/d4d_mission/models.py:94`

The `Relay min` input declares `max={4}`, but the state update uses `Number(event.currentTarget.value)` without clamping. Because there is no form submission constraint gate, manual input can still put a value above 4 into scenario state and send it to the backend. The schemas only enforce nonnegative integers.

Blocking: no, but it can produce mission constraints that the UI appears to disallow.

### API payload shape is only tested through a mocked API seam

Files:
- `frontend/src/api.ts:32`
- `frontend/src/api.ts:68`
- `frontend/src/store.ts:248`
- `frontend/src/store.ts:255`
- `frontend/src/store.ts:256`
- `frontend/tests/store.test.ts:118`
- `backend/src/d4d_mission/main.py:64`
- `backend/src/d4d_mission/main.py:68`
- `backend/src/d4d_mission/main.py:69`

The frontend payload shape matches the backend request model by inspection: `constraints` and `autonomy_level` are accepted by `MissionConfigureRequest`. The current frontend test, however, mocks `configureMission`; it does not exercise `api.ts` serialization or a real request boundary.

Blocking: no, because the live contract appears aligned, but the test does not prove it.

## LOW

### Import/flow errors are visual only, not announced

Files:
- `frontend/src/components/ScenarioBuilderPanel.tsx:215`
- `frontend/src/components/ScenarioBuilderPanel.tsx:217`
- `frontend/src/components/ScenarioBuilderPanel.tsx:218`

Import and graph connection errors render as plain paragraphs without `role="alert"` or an `aria-live` region. Keyboard and screen-reader users can miss these state changes.

Blocking: no.

### Manual CustomMissionIntent type can drift from the Zod schema

Files:
- `frontend/src/customScenario.ts:22`
- `frontend/src/customScenario.ts:37`
- `frontend/src/customScenario.ts:98`

`MissionIntentSchema` defines the runtime parse/default behavior, but `CustomMissionIntent` is manually declared rather than inferred from that schema. It is currently equivalent enough for this diff, but it creates a maintenance drift path.

Blocking: no.

## Non-Issues Verified

- Legacy custom scenarios without `intent` are accepted by the Zod default path in `CustomScenarioDocumentSchema`.
- The frontend mission configuration payload includes governance fields, and the backend request model accepts them.
- The added Mission Intent controls have accessible names through wrapping `<label>` elements.
- No staged diff exists in the requested frontend scope.

## Blockers

1. Replace or relabel synthetic EvaluationPanel baseline metrics and update tests so they assert the intended data contract rather than implementation constants.
2. Add WebSocket close/error handling with retry, REST fallback, or stale-state signaling, and cover failure/fallback behavior in tests.
