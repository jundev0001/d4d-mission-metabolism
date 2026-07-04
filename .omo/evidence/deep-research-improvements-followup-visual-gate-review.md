# Deep Research Improvements Follow-Up Visual Gate Review

## recommendation

REJECT

## originalIntent

Re-review refreshed D4D `deep-research-improvements` screenshots after the previous visual rejection. Decide whether the prior blockers are resolved without editing source files.

## desiredOutcome

The COP asset glyphs and labels should be distinguishable on desktop and mobile, and the EvaluationPanel should be evidenced and readable on mobile with no clipping, overlap, or awkward CJK word breaks.

## userOutcomeReview

The refreshed evidence resolves one prior blocker: `mobile-mission.png` now exists and shows the mobile mission tab including the EvaluationPanel. The COP cluster is also substantially improved because glyphs are spread in display space. However, approval is not supported yet: one COP label collision remains visible, and the mobile EvaluationPanel CCR band splits the Korean word `승인당` across lines as `승` / `인당`, which is a mobile text layout regression in the newly evidenced EvaluationPanel.

## checkedArtifactPaths

- `.omo/evidence/deep-research-improvements/desktop-mission.png` (1440 x 2507, captured 2026-07-05 01:40:18 KST)
- `.omo/evidence/deep-research-improvements/mobile-mission.png` (390 x 4430, captured 2026-07-05 01:40:18 KST)
- `.omo/evidence/deep-research-improvements/desktop-builder.png` (1440 x 2289, captured 2026-07-05 01:40:18 KST)
- `.omo/evidence/deep-research-improvements/mobile-builder.png` (390 x 3466, captured 2026-07-05 01:40:22 KST)
- `.omo/evidence/deep-research-improvements/verification.md`
- Previous stale reject artifact consulted for prior-blocker comparison:
  - `.omo/evidence/deep-research-improvements-visual-gate-review.md`

## blockers

1. Mobile EvaluationPanel CCR copy has an unnatural Korean word break.
   - Evidence: `mobile-mission.png`, EvaluationPanel CCR band near the lower part of the screenshot.
   - Visible text: `baseline 대비 외부 / 승` on one line and `인당 내부` on the next line.
   - User impact: `승인당` is split mid-word, which is a CJK precision failure and makes the mobile EvaluationPanel look unpolished in the exact viewport that was missing before.
   - Fix direction: shorten the CCR explanation, separate labels into stacked rows, or prevent the word `승인당` from breaking.

2. COP labels are improved but not fully resolved.
   - Evidence: `desktop-mission.png` and `mobile-mission.png`, COP map bottom cluster.
   - Visible issue: `UxV-05` and `UxV-01` collide/merge visually in the bottom-center label row.
   - User impact: the worst prior pile-up is fixed, but at least one asset identity remains unreadable, so the previous map readability blocker is only partially resolved.
   - Fix direction: include label dimensions in the collision/offset pass or stack the bottom-row labels with deterministic vertical offsets.

## polishItems

1. Builder flow/link labels remain heavily truncated on desktop and mobile.
   - Evidence: `desktop-builder.png` right-side link list and `mobile-builder.png` link rows.
   - This was previously classified as polish, not a blocker.

2. Builder canvas still has large unused vertical space before the visible flow graph.
   - Evidence: `desktop-builder.png` and `mobile-builder.png`.
   - This remains a usability polish issue rather than a blocker for the specific follow-up.

## directRemoveAiSlopsPass

Scope was read-only. The refreshed verification note no longer has the previous evidence gap for mobile mission, but the screenshots still show false-confidence risk: the report says mobile mission renders EvaluationPanel and CCR, while the screenshot reveals a CJK word-break issue in that CCR band. No test or source change was evaluated as cleanup.

## directProgrammingPass

Scope was read-only. No source edits were made. From the UI artifact perspective, the remaining issues are presentation/layout defects rather than TypeScript correctness findings. The gate remains rejected because the user-visible outcome is not clean.

## evidenceGaps

- No automated visual assertion demonstrates that COP text labels, not just glyph transforms, are collision-free.
- No independent visual oracle report is present in the refreshed evidence bundle.

