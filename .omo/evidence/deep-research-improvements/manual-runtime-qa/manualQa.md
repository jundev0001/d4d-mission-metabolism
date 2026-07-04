# Manual Runtime QA Matrix

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| MI-APPLY-01 | Custom Mission Intent apply path persists objective, constraints, approval policy, autonomy level, and area metadata | HTTP API | `curl.exe -i -X POST http://127.0.0.1:8011/mission/configure -H "Origin: http://qa.example.test" -H "Content-Type: application/json" --data-binary "@.omo/evidence/deep-research-improvements/manual-runtime-qa/mission-config-payload.json"` | PASS | A1, A2, A3 |
| WS-LIVE-01 | WebSocket live update path emits changed dashboard snapshots after REST state mutation | WebSocket + HTTP API | `node -e "... new WebSocket('ws://127.0.0.1:8011/ws/state') ... fetch('http://127.0.0.1:8011/event/inject', ...) ..."` | PASS | A9 |
| METRIC-OP-01 | Event injection must not increment operator-action metric before human decision | HTTP API | `curl.exe -i http://127.0.0.1:8011/metrics`; `curl.exe -i -X POST http://127.0.0.1:8011/event/inject -H "Content-Type: application/json" --data-raw '{"event_type":"battery_drop","target":"UxV-02","severity":0.9}'`; `curl.exe -i http://127.0.0.1:8011/metrics` | PASS | A5, A6, A7, A8 |
| CORS-ENV-01 | `D4D_CORS_ORIGINS` allows configured origins | HTTP CORS preflight | Backend launched with `PYTHONPATH=src; D4D_CORS_ORIGINS="http://qa.example.test, http://127.0.0.1:4173"`; `curl.exe -i -X OPTIONS http://127.0.0.1:8011/mission/configure -H "Origin: http://qa.example.test" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"` | PASS | A10 |
| REGRESS-BE-01 | Focused backend regression tests for mission config, action count, CORS | CLI | `C:\Users\Jun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m pytest tests\test_api.py -k "mission_configure or event_injection_does_not_count_as_operator_action or cors"` | PASS | A12 |
| REGRESS-FE-01 | Focused frontend regression tests for store mission payload and websocket handling | CLI | `npm run test -- store.test.ts custom-scenario.test.ts` | PASS | A13 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| MI-ADV-01 | Mission Intent apply path | Non-default governance values | Non-default constraints/autonomy must round-trip exactly, not be replaced by defaults | PASS | A1, A2, A3 |
| WS-ADV-01 | WebSocket live update path | State change after socket connection | Socket should receive a later snapshot with `events=1`, `recommendations=1`; malformed/no-change inference is not accepted | PASS | A9 |
| METRIC-ADV-01 | Operator-action integrity | Event injection without human approval | Event creates recommendation/event but leaves `operator_actions` and `assisted_operator_actions` at 1 | PASS | A5, A6, A7, A8 |
| CORS-ADV-01 | CORS environment behavior | Unconfigured origin | Preflight from blocked origin should fail and not return `access-control-allow-origin` | PASS | A11 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | request payload | Mission configure payload with non-default governance fields | `.omo/evidence/deep-research-improvements/manual-runtime-qa/mission-config-payload.json` |
| A2 | curl transcript | Mission configure response, HTTP 200 and custom mission body | `.omo/evidence/deep-research-improvements/manual-runtime-qa/02-mission-configure.txt` |
| A3 | curl transcript | GET state after mission configure persisted custom values | `.omo/evidence/deep-research-improvements/manual-runtime-qa/03-state-after-configure.txt` |
| A5 | curl transcript | Metrics before event injection | `.omo/evidence/deep-research-improvements/manual-runtime-qa/05-metrics-before-event.txt` |
| A6 | curl transcript | Event inject response with one event and one recommendation | `.omo/evidence/deep-research-improvements/manual-runtime-qa/06-event-inject.txt` |
| A7 | curl transcript | Metrics after event injection | `.omo/evidence/deep-research-improvements/manual-runtime-qa/07-metrics-after-event.txt` |
| A8 | parsed summary | Parsed operator-action summary before/after injection | `.omo/evidence/deep-research-improvements/manual-runtime-qa/08-operator-action-summary.txt` |
| A9 | websocket transcript | WebSocket initial and post-injection live snapshot summary | `.omo/evidence/deep-research-improvements/manual-runtime-qa/09-websocket-live-update.txt` |
| A10 | curl transcript | Configured CORS origin accepted | `.omo/evidence/deep-research-improvements/manual-runtime-qa/10-cors-allowed-custom-origin.txt` |
| A11 | curl transcript | Unconfigured CORS origin rejected | `.omo/evidence/deep-research-improvements/manual-runtime-qa/11-cors-blocked-origin.txt` |
| A12 | CLI transcript | Backend focused pytest | `.omo/evidence/deep-research-improvements/manual-runtime-qa/12-backend-focused-pytest.txt` |
| A13 | CLI transcript | Frontend focused Vitest | `.omo/evidence/deep-research-improvements/manual-runtime-qa/13-frontend-focused-vitest.txt` |
