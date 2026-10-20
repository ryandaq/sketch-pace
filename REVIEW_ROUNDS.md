# Five review rounds

Two independent agents reviewed the application after the initial build. The effectiveness reviewer checked scoring, interaction logic, progression, and tests. The aesthetics reviewer checked visual hierarchy, feel, motivation, and modes. Neither edited the files. Browser preview of local files and localhost was blocked by platform policy, so all five reviews are source-based; real iPad and Apple Pencil behavior remains to be tested on a device.

| Round | Effectiveness | Aesthetics | Feedback implemented |
| --- | ---: | ---: | --- |
| 1 | 7/10 | 7/10 | Fixed focus undo/restart accounting, added focus history, restored touch after pen input, cancelled strokes on resize, added ellipse wobble check, clarified levels, compressed tablet layout, added visible focus milestones and a richer circuit result. |
| 2 | 8/10 | 8/10 | Cleared stale milestone on resize, moved tablet skill choices before canvas, showed milestones below canvas, added Pencil-only input, and added a five-target challenge. |
| 3 | 9/10 | 9/10 | Varied box and cup targets, showed challenge scores in progress, named the selected skill on the challenge button, kept input mode visible on narrow layouts, retained lifetime score counts and bests, and batched pointer rendering by animation frame. |
| 4 | 9/10 | 9/10 | Added a skill selector beside the mode launches, concise input labels, JSON backup export/import, challenge result dismissal to inspect the final mark, and regression checks for animation-frame drawing. |
| 5 | 9/10 | 9/10 | Rejected malformed imported circuit drill scores and retained a compact challenge recap after revealing the final mark. |

The numeric scores are expert judgments from code and mocked interactions, not usability study results. Automated checks are in `sources/test-scoring.js`. Both reviewers withheld 10/10 because Pencil behavior and the rendered responsive UI could not be observed on a real device. Pencil and visual QA remain the next release checks.

## Later update

The five rounds above reviewed the previous build. A later user request added random line, ellipse, and box targets; configurable size mixes and guide visibility; immediate line/ellipse progression with the previous result above the canvas; and stricter box placement scoring. Those additions have automated geometry and progression checks, but were not part of the five agent ratings.

## Current redesign

The subsequent version 5 request removed product form, circuit, skill selection, and scoring levels. It now has endless mixed Practice and finite mixed Tests, with guide and drill switches together. Box scoring waits for the whole drawing and matches edges without regard to order. Line endpoints have no A/B labels and accept either direction. The mix controls display independent 0–5 weights rather than changing percentages. The version 5 automated checks and benchmark are in `sources/`; this redesign has not received a new agent rating or real-device visual review.

Through-dot lines were later added as a fourth selectable drill. Their score compares the stroke with two checkpoint dots without matching stroke endpoints; the weaker crossing carries 70% of accuracy and straightness carries 30%. This addition has automated checks, but no new agent or iPad review.
