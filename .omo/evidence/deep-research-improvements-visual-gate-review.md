# Deep Research Improvements Visual Gate Review

## recommendation

REJECT

## originalIntent

Review the D4D `deep-research-improvements` screenshots in read-only mode and report visible UI regressions, text overlap, clipping, unusable controls, and mobile issues introduced by the Mission Intent and EvaluationPanel changes.

## desiredOutcome

Mission Intent controls and the EvaluationPanel should render cleanly on desktop and mobile with no text overlap, clipping, unusable controls, or narrow-viewport regressions. Evidence should include all affected surfaces needed to judge the change.

## userOutcomeReview

The current screenshots do not support approval. The new Mission Intent controls are generally legible on desktop and mobile, and the desktop EvaluationPanel is readable. However, the reviewed evidence shows visible overlap/clipping in the desktop mission map, mobile and desktop builder controls include heavily truncated flow/link labels, and there is no mobile mission/EvaluationPanel screenshot, so the mobile impact of the EvaluationPanel change is unverified.

## checkedArtifactPaths

- `.omo/evidence/deep-research-improvements/desktop-mission.png` (1440 x 2507, captured 2026-07-05 01:22:39 KST)
- `.omo/evidence/deep-research-improvements/desktop-builder.png` (1440 x 2289, captured 2026-07-05 01:22:40 KST)
- `.omo/evidence/deep-research-improvements/mobile-builder.png` (390 x 3448, captured 2026-07-05 01:22:41 KST)
- `.omo/evidence/deep-research-improvements/verification.md`
- Relevant diff/source inspected read-only:
  - `frontend/src/components/EvaluationPanel.tsx`
  - `frontend/src/components/ScenarioBuilderPanel.tsx`
  - `frontend/src/styles/builder.css`
  - `frontend/tests/evaluation-panel.test.tsx`

## blockers

1. Desktop mission map has overlapping and partially clipped asset labels/icons at the bottom of the COP map.
   - Evidence: `desktop-mission.png`, COP map bottom edge, around the clustered `UxV-*` labels near Area C.
   - User impact: asset identities are unreadable and visually collide with each other and the map boundary. This is a blocking visual defect for a mission supervision surface because the operator cannot distinguish those vehicles.
   - Fix direction: reserve bottom padding inside the map viewport or apply collision avoidance/label offsetting for clustered assets; ensure map markers and labels remain fully inside the map frame.

2. Mobile EvaluationPanel state is not evidenced.
   - Evidence gap: the evidence set includes `mobile-builder.png` only. There is no mobile screenshot of the mission tab containing the EvaluationPanel.
   - User impact: the EvaluationPanel change cannot be approved for mobile. The changed CCR text (`28.0x / 1.0x` plus explanatory copy) may wrap or clip on the narrow mission panel, but that viewport/state is absent.
   - Fix direction: add a fresh mobile mission screenshot that includes the EvaluationPanel and inspect its CCR band/table wrapping.

## polishItems

1. Desktop and mobile builder flow/link labels are truncated enough to reduce scanability.
   - Evidence: `desktop-builder.png` right-side link list and `mobile-builder.png` flow editor link rows.
   - Impact: users can see that connections exist, but not reliably inspect full source/destination labels. This is especially weak on mobile.
   - Fix direction: allow two-line labels, expose full labels on hover/focus, or show source and destination as separate compact tokens.

2. Desktop builder has excessive vertical whitespace before the flow graph content.
   - Evidence: `desktop-builder.png`, large empty builder canvas before the event nodes.
   - Impact: active editing content is pushed far down the page, and on mobile the page becomes very long.
   - Fix direction: reduce fixed canvas height or fit the initial graph closer to the panel top while preserving drag space.

3. Mobile builder command buttons are crowded but still usable.
   - Evidence: `mobile-builder.png`, command row under `Custom scenario builder`.
   - Impact: no clipping observed, but the five commands consume two tight rows and `Apply mission` has little spare width.
   - Fix direction: use a compact action menu or prioritize primary actions on mobile.

4. EvaluationPanel summary copy is visually readable but semantically dense.
   - Evidence: `desktop-mission.png`, `CCR 28.0x / 1.0x baseline 대비 외부 / 승인당 내부`.
   - Impact: no clipping in desktop evidence, but the mixed-language explanatory phrase may become hard to read if it wraps on mobile.
   - Fix direction: verify mobile wrapping and consider shorter localized labels.

## directRemoveAiSlopsPass

Scope was read-only. I inspected the visual artifacts, verification note, and relevant diff. No source edits were made. From the requested visual gate perspective, the main slop risk is not excessive test/code cleanup but false confidence from a verification claim that mobile controls are unclipped while no mobile mission/EvaluationPanel capture is present. The evidence is therefore insufficient for approval.

## directProgrammingPass

Scope was read-only. Relevant TypeScript component changes were inspected via CodeGraph and `git diff`. The visual gate did not validate full type or behavior correctness beyond the provided verification note. The report rejects because the artifact set does not prove the changed mobile EvaluationPanel behavior and because a visible operator-surface overlap remains.

## evidenceGaps

- No mobile mission/EvaluationPanel screenshot.
- No before screenshots, so introduction by the Mission Intent/EvaluationPanel changes cannot be proven from pixels alone.
- No independent visual oracle/subagent report was available in the provided artifact set.
- The verification note claims mobile builder controls have no visible overlap or clipped primary controls, but it does not discuss the desktop map overlap, truncated flow/link labels, or missing mobile EvaluationPanel viewport.

