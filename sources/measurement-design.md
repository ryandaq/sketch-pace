# Sketch Pace measurement design (version 5)

Scores are heuristic control feedback. Component weights and tolerances have not been calibrated against expert judgments or learning outcomes. Every drill uses one 0–100 accuracy scale in Practice and Test.

## Shared geometry

Browser pointer coordinates are kept as drawn. Before a path metric, `resample` interpolates equal-distance samples along the raw stroke, so a slow or high-frequency part of the stroke does not dominate because it generated more pointer events. Lines use 64 samples and ellipses use 96. Nearest-polyline searches project a query point onto each segment, compare squared distances, and take a square root once. These choices follow the methods discussed in the [repository catalog](repositories.md).

## Lines

Two target dots and their ideal line segment are known. The user's first and last points are assigned to the two dots in whichever direction has less total endpoint error. Thus reversing a geometrically identical stroke gives the same score. Each dot score falls linearly to zero at an error of 10% of target length. Straightness measures average distance from the user's own endpoint-to-endpoint chord, plus a penalty for excess travel or doubling back.

`Accuracy = 0.5 × endpoint score + 0.5 × straightness score`.

Short, medium, and long target lengths are sampled from independent relative weights. The angle and location are randomized. Disabling the dotted guide leaves both target dots visible.

## Through-dot lines

This drill uses two open checkpoint dots on a randomized line. Its optional dotted guide extends beyond them. The user can start and finish anywhere. For each dot, the closest point on the **whole user stroke polyline** determines proximity. The weaker dot crossing sets the dot component, so missing either one is costly. There is no comparison between either stroke endpoint and either dot. Straightness uses the user's own start-to-end chord, mean deviation from it, and excess travel, so a wandering or doubled-back path through the dots still loses points.

`Accuracy = 0.7 × weaker checkpoint-dot proximity + 0.3 × straightness`.

Through-dot lines share the short/medium/long relative weights with endpoint lines, but have their own drill and guide switches. The score is direction-independent and permits different amounts of extension before and after the dots.

## Ellipses

Four open dots mark the ends of the ellipse's two axes. The axis component averages the nearest raw-stroke-polyline distance from each dot. The curve component uses 96 equal-distance samples and a normalized radial residual in the target's rotated coordinate frame. It also penalizes incomplete angular coverage, a gap between stroke endpoints, excess perimeter travel, and short-scale radial wobble. The target's center and axes remain fixed for scoring, so a well-formed loop in the wrong place scores poorly.

`Accuracy = 0.5 × axis-dot score + 0.5 × curve score`.

Small, medium, and large targets sample from independent relative weights; circles, tilted ellipses, and varied proportions can appear. Disabling dotted axes leaves the four open dots visible.

## Perspective boxes

The generator samples three silhouette classes: **tall**, **wide**, and **balanced**. It computes actual pixel-space width and height of the resulting vertices, rejects off-canvas or incorrectly proportioned candidates, and then returns nine target edges. Tall means vertical span at least 1.12 times horizontal span; wide means vertical span no more than 0.86 times horizontal span.

The user draws one edge per stroke, in any order, and chooses **Score box** when done. For every user-stroke/target-edge pair, the app computes a strict line score. Edge placement is 65% endpoint control and 35% mean distance to the ideal edge; the edge score is 70% placement and 30% straightness. A dynamic-programming assignment over the nine target edges selects the maximum total score while using each user stroke and each target edge at most once. Unmatched target edges contribute zero; unmatched user strokes reduce the result by 6% each, to a floor of 40% of the matched score. The displayed box components average placement and straightness over all nine target edges, with missing edges at zero.

This assignment costs `O(s × 2^9 × 9)` for `s` user strokes. Since a normal box has roughly nine strokes, the cost is bounded and small in practice. Tests cover reversed directions, arbitrary edge order, missing edges, and extra marks.

## Session data and limits

Practice stores count, sum of scores, and sum of target times for each of the four types, solely to show its two averages. Test stores bounded session records with overall mean accuracy, total target time, date, enabled types, and target count. The score version is 5 and uses a new local-storage key; older scores remain separate. Existing version 5 records gain empty through-dot averages without changing prior scores. Guide visibility does not alter target geometry or score. A device resize restarts the current target if any mark has been drawn.

The algorithm does not yet use coalesced pen events and has not been validated on Apple Pencil. A future calibration study should compare these scores with blind rankings by experienced sketchers and adjust weights where they disagree.
