# Visual QA Pass A Gate Review

## recommendation

APPROVE

## blockers

None.

## originalIntent

The user complained that UxV assets teleport on the COP when their coordinates change. This read-only Pass A review verifies whether the current D4D frontend now renders smooth, meaningful state-driven UxV movement and exposes initial allocation approval on the same mission/COP surface.

## desiredOutcome

- UxV movement must be real DOM/SVG behavior driven by dashboard vehicle state, not a fake screenshot or decorative-only motion.
- Movement must be design-system compatible: transform-only glyph/info-card updates, no decorative drift, and reduced-motion snap behavior.
- The mission surface must let the operator approve allocation while the COP remains visible.
- No current blockers in hook order, stale maps, runaway requestAnimationFrame, cleanup, type escape hatches, or overfit/brittle tests.

## userOutcomeReview

PASS. The current source and evidence support the requested outcome.

`frontend/src/components/MapView.tsx` computes target display positions from `dashboard.vehicles` and passes them through `useAnimatedAssetPositions` before rendering `MapAssetGlyph` and `MapAssetInfoCard`, so glyph and info-card transforms are state-driven. The Playwright QA script clicks the live `편성 승인` button, samples the actual `[data-asset-id="UxV-01"]` SVG `transform` over first/mid/settled frames, and fails if motion stops between sampled frames. The saved summary shows real movement from `translate(50 70.1)` through `translate(52.329 60.57)` to `translate(59.85 29.8)`.

The allocation approval is now on the same mission workspace as the COP: `App.tsx` renders `FleetDeploymentPanel` in the left rail and `MapView` in the center stage for the `임무 판단` workspace, and `FleetDeploymentPanel` wires `편성 승인` to `useMissionStore().allocateMission()`, which posts `/allocate` and refreshes dashboard/replay state.

## checkedArtifactPaths

- `frontend/src/mapAssetAnimation.ts`
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/MapAssetGlyph.tsx`
- `frontend/src/components/FleetDeploymentPanel.tsx`
- `frontend/src/App.tsx`
- `frontend/src/store.ts`
- `frontend/src/api.ts`
- `frontend/src/styles/deployment.css`
- `frontend/src/styles/map.css`
- `frontend/src/styles/panels.css`
- `frontend/src/styles/responsive.css`
- `frontend/tests/mapAssetAnimation.test.ts`
- `frontend/tests/fleet-deployment-panel.test.tsx`
- `frontend/tests/map-view.test.tsx`
- `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa.mjs`
- `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa-summary.json`
- `.omo/evidence/ulw-add-qa-improvements/screenshots/06-desktop-allocation-motion-midframe.png`
- `.omo/evidence/ulw-add-qa-improvements/screenshots/02-desktop-allocation-paths.png`
- `.omo/evidence/ulw-add-qa-improvements/screenshots/05-mobile-mission-view.png`
- `.omo/evidence/ulw-add-qa-improvements/gate-evidence.md`
- `.omo/evidence/ulw-add-qa-improvements/notepad.md`
- `.omo/evidence/ulw-add-qa-improvements-code-review.md`
- `.omo/evidence/ulw-add-qa-improvements-gate-review.md`

## directEvidence

- Loaded and applied `omo:visual-qa` Pass A criteria.
- Loaded and applied `omo:programming` TypeScript and code-smell criteria.
- Loaded and applied `omo:remove-ai-slops` overfit/slop criteria directly over production code, tests, and QA script.
- Used CodeGraph before direct file reads because the repo has `.codegraph/`.
- Ran `npm run test -- mapAssetAnimation.test.ts fleet-deployment-panel.test.tsx map-view.test.tsx`: PASS, 3 files / 13 tests.
- Ran `npm run lint`: PASS, `biome check . && oxlint`.
- Ran `npm run typecheck`: PASS, `tsc -b`.
- Pure LOC for scoped files is below the 250 LOC production threshold: `mapAssetAnimation.ts` 115, `MapView.tsx` 218, `FleetDeploymentPanel.tsx` 179, `deployment.css` 172.
- Escape-hatch scan over scoped production/test/QA files found no `as any`, `@ts-ignore`, `@ts-expect-error`, skipped tests, or snapshot-only assertions.
- Motion cleanup is present: `useAnimatedAssetPositions` cancels pending frames on target change/unmount and clears `frameRef`.
- Reduced motion is present in source: `motionShouldReduce()` snaps animation to target when `prefers-reduced-motion: reduce`; CSS disables action-path pulsing under the same media query.

## removeAiSlopsProgrammingReview

- No fake-image anti-pattern found: the COP is rendered as SVG elements and live React components, not a screenshot/background stand-in.
- No decorative asset drift found: UxV motion is triggered only by changed target positions from dashboard state.
- Tests are not deletion-only or tautological for the key behavior: the pure animation tests cover interpolation, new asset start, and removed asset absence; the browser QA samples live SVG transforms after a real allocation action.
- The allocation button unit test is intentionally narrow and mock-based, but the browser QA script covers the real surface flow, preventing false confidence from the mock alone.
- No current hook-order blocker found: `useAnimatedAssetPositions` is called before the `dashboard` early return with an empty target map fallback.

## exactEvidenceGaps

- The earlier `.omo/evidence/ulw-add-qa-improvements-code-review.md` is an initial BLOCK report from before later fixes; the later gate re-review approved a backend blocker but predates the newest frontend animation/allocation evidence. This Pass A review does not treat those older reports as final coverage for the current frontend change.
- I did not rerun `.omo/evidence/ulw-add-qa-improvements/asset-animation-qa.mjs` because it performs live POST/UI mutation and overwrites evidence files; that would conflict with the user-requested read-only Pass A. I inspected the script, summary JSON, and screenshots, then reran non-mutating lint/typecheck/targeted tests.
- Backend gates were outside this visual Pass A scope and were not rerun.

