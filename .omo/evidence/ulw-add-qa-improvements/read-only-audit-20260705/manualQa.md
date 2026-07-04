# Read-only Manual QA Matrix - ULW Add QA Improvements

Overall verdict: BLOCK for full fresh live verification under read-only constraints. Fresh passive checks PASS calculation trace visibility, area mission labels, and tuning controls. Fresh passive checks cannot reproduce COP action-path overlays or tuning apply effects because the browser load reset the live app to T+0 and the requested audit disallowed mutating POST/UI actions.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S-LOG-TRACE | Log tab calculation trace | Browser UI + backend replay GET | Browser: navigate `http://127.0.0.1:4173`, click `getByRole('button', { name: '계산 로그' })`, capture screenshot and DOM probe. HTTP: `curl.exe -i http://127.0.0.1:8000/replay` | PASS | A-BROWSER-LOG, A-BROWSER-LOG-PROBE, A-CURL-REPLAY, A-REPLAY-FACTS |
| S-COP-PATHS | COP path overlays | Browser UI, read-only passive state | Browser: navigate `http://127.0.0.1:4173`, evaluate `[data-testid^="action-path-"]` and `.mission-activity-path`; HTTP: `curl.exe -i http://127.0.0.1:8000/` | BLOCK | A-BROWSER-INITIAL, A-BROWSER-INITIAL-PROBE, A-CURL-ROOT, A-ROOT-FACTS, A-PRIOR-PATH-1, A-PRIOR-PATH-2 |
| S-VEHICLE-TUNE | Vehicle parameter tuning | Browser UI + backend state GET | Browser: navigate `http://127.0.0.1:4173`, inspect visible vehicle rows for battery/link/nav/sensor/status/apply controls; HTTP: `curl.exe -i http://127.0.0.1:8000/` | BLOCK | A-BROWSER-INITIAL, A-BROWSER-INITIAL-PROBE, A-CURL-ROOT, A-ROOT-FACTS, A-PRIOR-TUNE |
| S-AREA-LABELS | Area mission labels | Browser UI + backend state GET | Browser: navigate `http://127.0.0.1:4173`, inspect COP labels; HTTP: `curl.exe -i http://127.0.0.1:8000/` | PASS | A-BROWSER-INITIAL, A-BROWSER-INITIAL-PROBE, A-CURL-ROOT, A-ROOT-FACTS |
| S-HTTP-UP | Live app/backend availability | HTTP | `curl.exe -i http://127.0.0.1:4173/`; `curl.exe -i http://127.0.0.1:8000/metrics` | PASS | A-CURL-FRONTEND, A-CURL-METRICS |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A-INIT-NO-FAKE-PATHS | COP path overlays | Initial T+0 state with zero assignments | No fake action paths should be rendered before allocation/event state exists | PASS | A-BROWSER-INITIAL-PROBE, A-ROOT-FACTS |
| A-LOG-ACCESSIBLE-NAME | Log tab calculation trace | Accessible-name mismatch | Combined visible text locator should not be required; button exposes `aria-label="계산 로그"` and role locator works | PASS | A-LOG-BUTTONS, A-LOG-LOCATORS, A-BROWSER-LOG |
| A-READONLY-MUTATION | Vehicle parameter tuning and COP path overlays | Read-only audit boundary | Do not POST `/allocate`, `/event/inject`, `/decision`, or `/vehicle/tune`; mutation-dependent behavior must be marked BLOCK unless already visible in current live state | PASS | A-BROWSER-INITIAL-PROBE, A-ROOT-FACTS, A-PRIOR-PATH-1, A-PRIOR-PATH-2, A-PRIOR-TUNE |
| A-TRACE-CURRENT-STATE | Log tab calculation trace | Current state only has initialization calculation | Calculation panel should still show concrete formula fields, not an empty/static placeholder | PASS | A-BROWSER-LOG, A-BROWSER-LOG-PROBE, A-REPLAY-FACTS |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A-BROWSER-INITIAL | screenshot | Fresh passive browser screenshot of initial live app at T+0 | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/browser-initial.png` |
| A-BROWSER-INITIAL-PROBE | json | Fresh passive DOM probe: area labels, tuning controls, zero path overlays | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/browser-initial-probe.json` |
| A-BROWSER-LOG | screenshot | Fresh browser screenshot after switching to calculation log tab | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/browser-log-tab.png` |
| A-BROWSER-LOG-PROBE | json | Fresh DOM probe for log tab calculation fields | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/browser-log-probe.json` |
| A-CURL-ROOT | http transcript | Fresh `curl -i http://127.0.0.1:8000/` output | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/curl-root.txt` |
| A-CURL-REPLAY | http transcript | Fresh `curl -i http://127.0.0.1:8000/replay` output | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/curl-replay.txt` |
| A-CURL-METRICS | http transcript | Fresh `curl -i http://127.0.0.1:8000/metrics` output | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/curl-metrics.txt` |
| A-CURL-FRONTEND | http transcript | Fresh `curl -i http://127.0.0.1:4173/` output | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/curl-frontend.txt` |
| A-ROOT-FACTS | json | Parsed facts from fresh backend root state | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/api-root-facts.json` |
| A-REPLAY-FACTS | json | Parsed facts from fresh replay state | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/api-replay-facts.json` |
| A-LOG-BUTTONS | json | Browser button details showing `aria-label="계산 로그"` | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/log-button-details.json` |
| A-LOG-LOCATORS | text | Failed/successful locator counts for log tab | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/log-locator-count.txt` |
| A-PRIOR-PATH-1 | screenshot | Inspected prior allocation-path overlay screenshot | `.omo/evidence/ulw-add-qa-improvements/screenshots/02-desktop-allocation-paths.png` |
| A-PRIOR-PATH-2 | screenshot | Inspected prior event-approved path overlay screenshot | `.omo/evidence/ulw-add-qa-improvements/screenshots/03-desktop-event-approved-paths.png` |
| A-PRIOR-TUNE | screenshot | Inspected prior log/tune screenshot showing `vehicle_parameter_tune` | `.omo/evidence/ulw-add-qa-improvements/screenshots/04-desktop-log-and-tune.png` |
| A-NOTEPAD | markdown | Audit notepad | `.omo/evidence/ulw-add-qa-improvements/read-only-audit-20260705/notepad.md` |

## Concrete findings

- Fresh live frontend/backend are reachable by HTTP.
- Fresh passive browser state reset to T+0 on load. Backend facts show `assignments=0`, `events=0`, and replay has only one calculation entry, so fresh read-only verification cannot show allocation/action paths or `vehicle_parameter_tune` effects.
- Fresh log tab is not static: it exposes `mission_initialized`, MCC, baseline MCC, collapse, autonomy debt, CCR, assigned assets, and per-area MCC.
- Fresh COP area labels are visible: Area A `구역 정찰`, Area B `중계 임무`, Area C `지속 감시`, with priority/EW metadata.
- Fresh vehicle tuning controls are visible for deployed assets: battery/link/nav/sensor/status/apply controls appear, but applying them was not executed due to read-only scope.
- Inspected existing screenshots support the earlier mutation-run claims for path overlays and vehicle tune trace, but they are not fresh-live reproduction under the read-only constraint.

